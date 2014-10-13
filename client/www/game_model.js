function assert(a) {
    if (!a)
        throw new Error();
}

function defineGProperty(self, prop, val) {
    self['__' + prop] = val;
    Object.defineProperty(self, prop, {
        get: function() {
            return self['__' + prop];
        },
        set: function(val) {
            self['__' + prop] = val;

            self.emit('changed::' + prop);
        }
    });
}

function GObject(props) {
    EventEmitter2.call(this);

    for (var prop in props) {
        defineGProperty(this, prop, props[prop]);
    }
}
GObject.prototype.__proto__ = EventEmitter2.prototype;

var CardState = {
    DECK: 1,
    HAND: 2,
    TABLE: 3
};

var GameState = {
    IN_PROGRESS: 1,
    WIN: 2,
    LOSE: 3,
    DRAW: 4
};
var Owner = {
    ME: 1,
    OPPONENT: 2
};

var ATTACK_PLAYER = 'attack_player';
var END_TURN = 'finish';
var PLAY_CARD = 'card';
var ATTACK = 'attack';

function GameStateModel() {
    EventEmitter2.call(this);

    defineGProperty(this, 'state', GameState.IN_PROGRESS);
    defineGProperty(this, 'turn', Owner.OPPONENT);
    this._nextCardUniqId = 1;


    this._requestGameState(this._init.bind(this));
    // signals: ready, onNewCard, reposition, oldMovesDone

    this.setMaxListeners(70);
}

GameStateModel.prototype = {
    __proto__: EventEmitter2.prototype,
    _createPlayer: function(mana, maxMana, health, owner) {
        var player =  new GObject({ mana: mana,
                                    maxMana: maxMana,
                                    health: health });

        player.owner = owner;

        player.setMaxListeners(35);
        return player;
    },

    _createCard: function(owner, type, attacksLeft, state, id, damage, health, cost) {
        var card = new GObject({ owner: owner,
                                 type: type,
                                 damage: damage,
                                 health: health,
                                 cost: cost,
                                 id: id,
                                 attacksLeft: attacksLeft,
                                 state: state });

        card.__cardUniqField = this._nextCardUniqId++;
        //emits attackPlayer, attack

        this.emit('onNewCard', card);

        var self = this;
        card.on('changed::state', function() {
            // FIXME:
            self.emit('reposition');
        });

        return card;
    },

    _requestGameState: function(cb) {
        var self = this;
        var uri = host + 'v1/game_state/' + params.token + '/' + params.gameid;

        $.ajax({ url: uri }).done(cb).fail(function() {
            //FIXME
        });
    },

    _init: function(data) {
        var self = this;
        self._cards = [];

        var data = JSON.parse(data);
        self.me = self._createPlayer(data.initial.my.mana, data.initial.my.maxMana, data.initial.my.health, Owner.ME);
        self.opponent = self._createPlayer(data.initial.opponent.mana, data.initial.opponent.maxMana, data.initial.opponent.health, Owner.OPPONENT);

        this.me.on('changed::health', function() {
            //FIXME:
            if (self.me.health <= 0 && self.opponent.health <= 0)
                self.state = GameState.WIN;
            if (self.me.health <= 0)
                self.state = GameState.LOSE;
            if (self.opponent.health <= 0)
                self.state = GameState.WIN;
        });
        self.players = [self.me, self.opponent];

        self._initial = data.initial;
        self._log = [];

        if (data.initial.turn)
            self.turn = Owner.ME;

        for (var i = 0; i < data.initial.my.hand.length; i++) {
            var card = data.initial.my.hand[i];
            var c = self._createCard(Owner.ME, card.type, 0, CardState.HAND, card.id, card.damage, card.health, card.cost);
            self._cards.push(c);
        }
        for (var i = 0; i < data.initial.my.deckSize; i++) {
            var c = self._createCard(Owner.ME, undefined, 0, CardState.DECK, undefined);
            self._cards.push(c);
        }

        for (var i = 0; i < data.initial.opponent.deckSize; i++) {
            var c = self._createCard(Owner.OPPONENT, undefined, 0, CardState.DECK, undefined);
            self._cards.push(c);
        }
        for (var i = 0; i < data.initial.opponent.handSize; i++) {
            var c = self._createCard(Owner.OPPONENT, undefined, 0, CardState.HAND, undefined);
            self._cards.push(c);
        }

        self.emit('ready');

        myController.blockLog = true;
        for (var i = 0; i < data.log.length; i++) {
            self._handleAction(data.log[i]);
        }
        //FIXME:
        myController.blockLog = false;

        self.emit('oldMovesDone');

        setInterval(function() {
            self._requestGameState(self._updateState.bind(self));
        }, 1000);
    },

    _handleAction: function(e) {
        var controller = opponentController;
        if (e.me)
            controller = myController;
        switch (e.action) {
        case ATTACK_PLAYER:
            controller.attackPlayer(e.params[0]);
            break;
        case ATTACK:
            controller.attack(e.params[0], e.params[1]);
            break;
        case PLAY_CARD:
            controller.playCard(e.params[0], e.params[1]);
            break;
        case END_TURN:
            controller.endTurn(null, e.params[1]);
            break;
        default:
            assert(false);
        };
    },

    _compareLogEntries: function(e1, e2) {
        if (e1.action != e2.action)
            return false;

        if (e1.me != e2.me)
            return false;

        if (typeof(e1.params[0]) == 'string' && e1.params[0] != e1.params[0])
            return false;
        if (typeof(e1.params[1]) == 'string' && e1.params[1] != e1.params[1])
            return false;
        //FIXME: compare card id in params
        return true;
    },

    _updateState: function(data) {
        var data = JSON.parse(data);

        assert(_.isEqual(data.initial, this._initial));

        //FIXME:
        if (data.log.length <  this._log.length) {
            console.log(data.log);
            console.log(this._log)
        }
        assert(data.log.length >= this._log.length);
        for (var i = 0; i < this._log.length; i++) {
            if (!this._compareLogEntries(data.log[i], this._log[i])) {
                console.warn('different log');
                console.warn(data.log[i])
                console.warn(this._log[i])
            }
        }

        for (var i = this._log.length; i < data.log.length; i++) {
            this._handleAction(data.log[i]);
        }
    },

    cardPosition: function(card) {
        var arr;
        arr = this._cards.filter(function(c) {
            return c.owner == card.owner && c.state == card.state;
        });
        var t = arr.indexOf(card)
        if (t == -1)
            return arr.length;
        return t;
    }
};
