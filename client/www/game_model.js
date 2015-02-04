var runningUnderNode = typeof exports !== 'undefined';

if (runningUnderNode) {
    EventEmitter2 = require('events').EventEmitter;

    heroes = require('./heroes').heroes;
    CardType = require('./heroes').CardType;
}

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
            if (self['__' + prop] === val)
                return;
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
    TABLE: 3,
    DEAD: 99
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
var PLAY_SPELL = 'spell';
var DRAW_CARD = 'draw_card';
var CONCEDE = 'concede';

var HAND_LIMIT = 10;
var TABLE_LIMIT = 5;

function callHelper(f, arg1, arg2, arg3) {
    var func;
    eval('func = ' + f);
    return func(arg1, arg2, arg3);
}

function StateModelCommon() {
    EventEmitter2.call(this);
}

StateModelCommon.prototype = {
    __proto__: EventEmitter2.prototype,
    healCard: function(card, h) {
        card.health = Math.min(card.health + h, card.maxHealth);

        this.emit('sound', 'heal');
    },
    increaseCardHealth: function(card, h) {
        card.health += h;
        card.maxHealth += h;

        this.emit('sound', 'heal');
    },
    dealDamageToCard: function(card, h) {
        if (card.dealDamage)
            return callHelper(card.dealDamage.cast, card, h, this);
        h = Math.min(h, card.health);
        card.health -= h;
        return h;
    },
    otherOwner: function(owner) {
        if (owner == Owner.ME)
            return Owner.OPPONENT;
        return Owner.ME;
    },
    massAttack: function(owner, d) {
        var total = 0;
        for (var i = 0; i < this._cards.length; i++) {
            if (owner !== this._cards[i].owner)
                continue;
            if (this._cards[i].state === CardState.TABLE) {
                total += this.dealDamageToCard(this._cards[i], d);
            }
        }
        this.emit('mass_attack', owner);
        return total;
    }
};

function GameStateModel(host, token, gameid) {
    StateModelCommon.call(this);

    defineGProperty(this, 'state', GameState.IN_PROGRESS);
    defineGProperty(this, 'turn', Owner.OPPONENT);
    this._nextCardUniqId = 1;
    this._token = token;
    this._gameid = gameid;
    this._host = host;


    this._requestGameState(this._init.bind(this));
    // signals: ready, onNewCard, reposition, oldMovesDone, HandLimit

    this.setMaxListeners(70);
}

GameStateModel.prototype = {
    __proto__: StateModelCommon.prototype,
    _createPlayer: function(mana, maxMana, health, owner, name) {
        var player =  new GObject({ mana: mana,
                                    maxMana: maxMana,
                                    health: health });

        player.owner = owner;
        player.name = name;

        player.setMaxListeners(35);
        return player;
    },

    createCard: function(o) {
        assert(o.id);
        o.id = String(o.id);

        var card = this._createCard(o.owner, o.type, o.state, o.id, o.attacksLeft);
    },

    _createCard: function(owner, type, state, id, attacksLeft) {
        var card = new GObject({ owner: owner,
                                 type: type,
                                 id: id,
                                 state: state,
                                 visualState: '',

                                 damage: undefined,
                                 health: undefined,
                                 maxHealth: undefined,
                                 cost: undefined,
                                 shield: undefined,
                                 cardType: CardType.UNKNOWN,
                                 attacksLeft: attacksLeft });

        if (type)
            this._initCard({ type: type, id: id }, card);

        card.__cardUniqField = this._nextCardUniqId++;
        this._cards.push(card);

        //emits attackPlayer, attack
        this.emit('onNewCard', card);

        var self = this;
        card.on('changed::state', function() {
            // FIXME:
            if (card.state !== CardState.DEAD)
                self.emit('reposition');
        });

        return card;
    },

    _requestGameState: function(cb) {
        var uri = this._host + 'v1/game_state/' + this._token + '/' + this._gameid;

        if (runningUnderNode) {
            function doRequest(url, cb) {
                var options = require('url').parse(url);
                options.headers = { 'valhalla-client': '3' };
                require('http').request(options, function(res) {
                    res.setEncoding('utf8');
                    var data = "";
                    res.on('data', function (chunk) {
                        data += chunk;
                    }).on('end', function () {
                        cb(data);
                    });
                }).on('error', function(e) {
                    console.log("Got error: " + e.message);
                }).end();
            }
            doRequest(uri, cb);
        } else {
            _network.ajax(uri, undefined, cb, 10000);
        }
    },

    _init: function(data) {
        var self = this;
        self._cards = [];

        var data = JSON.parse(data);
        self.me = self._createPlayer(data.initial.my.mana, data.initial.my.maxMana, data.initial.my.health, Owner.ME, data.initial.my.name);
        self.opponent = self._createPlayer(data.initial.opponent.mana, data.initial.opponent.maxMana, data.initial.opponent.health, Owner.OPPONENT, data.initial.opponent.name);

        this.me.on('changed::health', this._onHealthChanged.bind(this));
        this.opponent.on('changed::health', this._onHealthChanged.bind(this));
        self.players = [self.me, self.opponent];

        self._initial = data.initial;
        self._log = [];

        this.data = JSON.parse(JSON.stringify(data.initial.data));
        if (runningUnderNode)
            this.random = require('./random').createRandomGenerator(this.data.seed);
        else
            this.random = createRandomGenerator(this.data.seed);

        for (var i = 0; i < data.initial.my.hand.length; i++) {
            var card = data.initial.my.hand[i];
            self._createCard(Owner.ME, card.type, CardState.HAND, card.id, 0);
        }
        for (var i = 0; i < data.initial.my.deckSize; i++) {
            self._createCard(Owner.ME, undefined, CardState.DECK, undefined, 0);
        }

        for (var i = 0; i < data.initial.opponent.deckSize; i++) {
            self._createCard(Owner.OPPONENT, undefined, CardState.DECK, undefined, 0);
        }
        for (var i = 0; i < data.initial.opponent.handSize; i++) {
            self._createCard(Owner.OPPONENT, undefined, CardState.HAND, undefined, 0);
        }

        self.emit('ready');

        if (data.initial.turn)
            self.turn = Owner.ME;

        for (var i = 0; i < data.log.length; i++) {
            self._handleAction(data.log[i]);
            if (data.log[i].action === DRAW_CARD)
                self._log.push(data.log[i]);
        }

        self.emit('oldMovesDone');

        function doRequest() {
            self._requestGameState(function (data) {
                self._updateState(data)
                setTimeout(doRequest, 2000);
            });
        }
        setTimeout(doRequest, 2000);
    },

    _onHealthChanged: function() {
        if (this.me.health <= 0 && this.opponent.health <= 0)
            this.state = GameState.WIN;
        if (this.me.health <= 0)
            this.state = GameState.LOSE;
        if (this.opponent.health <= 0)
            this.state = GameState.WIN;
    },

    setMyController: function(controller) {
        this._myController = controller;
    },

    setOpponentController: function(controller) {
        this._opponentController = controller;
    },

    getController: function(owner) {
        if (owner === this._myController.owner)
            return this._myController;
        if (owner === this._opponentController.owner)
            return this._opponentController;
        assert(false);
    },

    _handleAction: function(e) {
        var controller = this._opponentController;
        if (e.me)
            controller = this._myController;
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
        case PLAY_SPELL:
            controller.playSpell(e.params[0].id, e.params[1], e.params[0]);
            break;
        case END_TURN:
            controller.endTurn(null, e.params[1]);
            break;
        case DRAW_CARD:
            controller.drawCard(e.params[0]);
            break;
        case CONCEDE:
            controller.concede();
        default:
            assert(false);
        };
    },

    _compareLogEntries: function(e1, e2) {
        if (e1.action !== e2.action)
            return false;

        if (e1.me !== e2.me)
            return false;

        if (typeof(e1.params[0]) === 'string' && e1.params[0] !== e1.params[0])
            return false;
        if (typeof(e1.params[1]) === 'string' && e1.params[1] !== e1.params[1])
            return false;
        //FIXME: compare card id in params
        return true;
    },

    _updateState: function(data) {
        var data = JSON.parse(data);
        if (!runningUnderNode)
            assert(_.isEqual(data.initial, this._initial));

        for (var i = 0; i < Math.min(data.log.length, this._log.length); i++) {
            if (!this._compareLogEntries(data.log[i], this._log[i])) {
                if (data.log[i].action === DRAW_CARD && this._log[i].action !== DRAW_CARD) {
                    this._log.splice(i, 0, data.log[i]);
                    this._handleAction(data.log[i]);
                    return;
                }
                console.warn('different log');
                console.warn(data.log[i])
                console.warn(this._log[i])
            }
        }

        for (var i = this._log.length; i < data.log.length; i++) {
            this._handleAction(data.log[i]);
            if (data.log[i].action === DRAW_CARD)
                this._log.push(data.log[i]);
        }
    },

    _initCard: function(desc, card) {
        var type = desc['type'];

        card.type = type;
        card.id = desc.id;

        card.shield = !!heroes[type].shield;
        card.cardType = heroes[type].cardType;
        card.onDeath = heroes[type].onDeath;
        card.dealDamage = heroes[type].dealDamage;
        card.canAttackCard = heroes[type].canAttackCard;
        card.onTurnEnd = heroes[type].onTurnEnd;
        card.onPlay = heroes[type].onPlay;
        card.onNewTurn = heroes[type].onNewTurn;
        card.attack = heroes[type].attack;
        card.canBeAttacked = heroes[type].canBeAttacked;

        var props = ['damage', 'health', 'cost'];
        for (var i = 0; i < props.length; i++) {
            var prop = props[i];
            if (!heroes[type][prop] === null)
                continue;
            card[prop] = heroes[type][prop];
        }
        if (card.cardType !== CardType.HERO) {
            card.health = undefined;
            card.damage = undefined;
        } else {
            card.maxHealth = card.health;
        }
    }
};

function GameStateController(model, owner) {
    this.model = model;
    this.owner = owner;

    var self = this;
    //FIXME:
    model.on('ready', function() {
        self._init(model, owner);
    });
}

GameStateController.prototype = {
    _init: function(model, owner) {
        assert(model.players.length === 2);
        this.me = model.players.filter(function (p) {return p.owner === owner;})[0];
        this.opponent = model.players.filter(function (p) {return p.owner !== owner;})[0];
    },

    isFinished: function() {
        return this.me.health <= 0 || this.opponent.health <= 0;
    },

    _log: function(action, p1, p2) {
        var r = {action: action, params: [p1, p2]};
        if (this.me.owner === Owner.ME)
            r.me = true;

        this.model._log.push(r);
    },

    _card: function(id) {
        var r = this.model._cards.filter(function (c) {return c.id === id;});

        if (r.length !== 1)
            throw new Error('incorrect card id');

        r = r[0];

        return r;
    },

    _myCard: function(id) {
        var r = this._card(id);

        assert(r.owner === this.owner);

        return r;
    },

    _opponentCard: function(id) {
        var r = this._card(id);

        assert(r.owner !== this.owner);

        return r;
    },

    _removeDeadCards: function() {
        function isAlive(card) {
            return card.health > 0 || card.state !== CardState.TABLE;
        }
        for (var i = 0; i < this.model._cards.length; i++) {
            var card = this.model._cards[i];
            if (isAlive(card))
                continue;
            if (card.onDeath)
                callHelper(card.onDeath.cast, card);
            if (!isAlive(card))
                card.state = CardState.DEAD;
        }
        this.model._cards = this.model._cards.filter(isAlive);
        this.model.emit('reposition');
    },

    opponentHasShield: function() {
        var self = this;
        var shields = this.model._cards.filter(function (c) {
            return c.owner !== self.owner && c.state === CardState.TABLE && c.health > 0 && c.shield;
        });
        return shields.length;
    },

    canAttack: function(id1) {
        var card = this._myCard(id1);

        if (card.state !== CardState.TABLE || this.model.turn !== this.owner)
            return false;

        if (card.attacksLeft <= 0)
            return false;

        return true;
    },

    canAttackCard: function(id1, id2) {
        var card1 = this._myCard(id1);
        if (card1.canAttackCard) {
            var card2 = this._card(id2);
            return callHelper(card1.canAttackCard.cast, card1, card2, this.canBeAttacked(id2));
        } else
            return this.canBeAttacked(id2);
    },

    canAttackOpponent: function() {
        if (this.opponentHasShield())
            return false;

        return true;
    },

    canBeAttacked: function(id2) {
        try {
            var card = this._opponentCard(id2);
        } catch (e) {return false;}

        if (card.state !== CardState.TABLE)
            return false;

        if (!card.shield && this.opponentHasShield())
            return false;

        if (card.canBeAttacked)
            return callHelper(card.canBeAttacked.cast, card);

        return true;
    },

    canPlayCard: function(id1) {
        var card = this._myCard(id1);

        if (card.state !== CardState.HAND || card.cost > this.me.mana
            || this.model.turn !== this.owner || card.cardType !== CardType.HERO)
            return false;
        var table = this.model._cards.filter(function (c) {
            return c.owner === card.owner && c.state === CardState.TABLE && c.health > 0;
        });
        if (table.length >= TABLE_LIMIT)
            return false;

        return true;
    },

    canPlaySpell: function(id1) {
        var card = this._myCard(id1);

        if (card.state !== CardState.HAND || card.cost > this.me.mana
            || this.model.turn !== this.owner || card.cardType !== CardType.SPELL)
            return false;

        return true;
    },

    attackPlayer: function(id1) {
        if (!this.canAttack(id1) || !this.canAttackOpponent())
            throw new Error('invalid action');

        var card = this._myCard(id1);
        card.attacksLeft--;

        card.emit('attackPlayer');

        this.opponent.health -= card.damage;

        this._log(ATTACK_PLAYER, id1);
    },

    playSpell: function(id1, id2, _card) {
        var self = this;
        try {
            this._myCard(id1);
        } catch (e) {
            if (_card) {
                var deck = this.model._cards.filter(function(c) {
                    return c.owner === self.owner && c.state === CardState.HAND;
                });
                assert(deck.length);
                var c = deck[0];

                this.model._initCard(_card, c);
            } else
                throw e;
        }

        if (!this.canPlaySpell(id1))
            throw new Error('invalid action');

        var card1 = this._myCard(id1), card2 = this._myCard(id2);

        card1.emit('playSpell', card2);
        heroes[card1.type].cast(card2, this.model._cards, this.model);

        card1.state = CardState.DEAD;

        this.me.mana -= card1.cost;
        this.model._cards.splice(this.model._cards.indexOf(card1), 1);

        this._removeDeadCards();
        this._log(PLAY_SPELL, card1, card2.id);
    },

    attack: function(id1, id2) {
        if (!this.canAttack(id1) || !this.canAttackCard(id1, id2))
            throw new Error('invalid action');

        var card1 = this._myCard(id1), card2 = this._card(id2);
        card1.emit('attack', card2);

        if (card1.attack) {
            callHelper(card1.attack, card1, card2, this.model);
        } else {
            card1.attacksLeft--;

            // damage can increase during dealDamageToCard
            var damage1 = card1.damage;
            var damage2 = card2.damage;
            this.model.dealDamageToCard(card2, damage1);
            this.model.dealDamageToCard(card1, damage2);
        }

        this._removeDeadCards();

        this._log(ATTACK, id1, id2);
    },

    concede: function() {
        if (this.owner !== Owner.ME)
            this.model.emit('OpponentLeft');
        this.me.health = 0;
        this._log(CONCEDE);
    },

    playCard: function(id1, _card) {
        var self = this;
        try {
            this._myCard(id1);
        } catch (e) {
            if (_card) {
                var deck = this.model._cards.filter(function(c) {
                    return c.owner === self.owner && c.state === CardState.HAND;
                });
                assert(deck.length);
                var c = deck[0];

                this.model._initCard(_card, c);
            } else
                throw e;
        }

        if (!this.canPlayCard(id1))
            throw new Error('invalid action');

        var card = this._myCard(id1);
        card.state = CardState.TABLE;
        card.attacksLeft = 0;
        this.me.mana -= card.cost;

        if (card.onPlay)
            callHelper(card.onPlay.cast, card, this.model);

        this._log(PLAY_CARD, id1, card);
    },

    _drawCard: function(owner, a1) {
        var self = this;
        var hand = this.model._cards.filter(function(card) {
            return card.owner === owner && card.state === CardState.HAND;
        });

        if (hand.length + 1 > HAND_LIMIT) {
            if (owner === Owner.ME)
                this.model.emit("HandLimit");
            return null;
        }

        var deck = this.model._cards.filter(function(card) {
            return card.owner === owner && card.state === CardState.DECK;
        });

        if (!deck.length) {
            if (owner === Owner.ME)
                this.model.emit("EmptyDeck");
            //FIXME: deal damage to hero
            return null;
        }
        if (runningUnderNode && this.model.server) {

            var card = deck[0];
            card.attacksLeft = 0;
            card.state = CardState.HAND;
            return card;
        } else {
            assert(a1 || a1 === null);

            var card = deck[0];
            card.attacksLeft = 0;
            card.state = CardState.HAND;

            assert(card.owner !== Owner.ME || a1);
            if (a1) {
                this.model._initCard(a1, card);
                var r = this.model._cards.filter(function (c) {return c.id === card.id;});
                assert(r.length === 1);
            }
            return card;
        }
    },

    drawCard: function(a1) {
        // a1 - can be null. null represent opponent's card
        if (!((a1 || a1 === null) || this.model.server))
            return;
        var card = this._drawCard(this.owner, a1);
        if (!card)
            card = null;
        if (runningUnderNode && this.model.server)
            this._log(DRAW_CARD, card, this.owner);
    },

    endTurn: function(a1, a2) {
        var opponent = this.owner === Owner.ME ? Owner.OPPONENT: Owner.ME;
        assert(this.model.turn === this.owner);

        var self = this;
        this.model._cards.forEach(function(card, index, array) {
            if (card.state !== CardState.TABLE || card.owner !== self.owner)
                return;
            if (card.onTurnEnd)
                callHelper(card.onTurnEnd.cast, card, self.model._cards, self.model);
        });

        this.model._cards.forEach(function(card, index, array) {
            if (card.state !== CardState.TABLE || card.owner !== opponent)
                return;
            card.attacksLeft = 1;
            if (card.onNewTurn) {
                callHelper(card.onNewTurn.cast, card, self.model);
            }
        });
        this._removeDeadCards();

        var deck = this.model._cards.filter(function(card) {
            return card.owner === opponent && card.state === CardState.DECK;
        });

        var card = this._drawCard(opponent, a2);
        this._log(END_TURN, null, card);

        this.opponent.maxMana = Math.min(10, this.opponent.maxMana + 1);
        this.opponent.mana = this.opponent.maxMana;
        this.model.turn = opponent;
    }
};

if (runningUnderNode) {
    exports.GameStateModel = GameStateModel;
    exports.GameStateController = GameStateController;
    exports.StateModelCommon = StateModelCommon;
    exports.Owner = Owner;
    exports.CardState = CardState;
    exports.GameState = GameState;
}
