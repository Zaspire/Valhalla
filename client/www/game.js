paper.settings.applyMatrix = false;

////// HACK to make dnd work on phone
function onMouseDown(event) {
}

function onMouseDrag(event) {
}

function onMouseUp(event) {
}
//////

////// HACK to make animation work
var onFrame = new Function();
//////


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

var params = {};
params.token = localStorage.getItem('token');
params.gameid = localStorage.getItem('gameid');

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
        assert(model.players.length == 2);
        this.me = model.players.filter(function (p) {return p.owner == owner;})[0];
        this.opponent = model.players.filter(function (p) {return p.owner != owner;})[0];
    },

    isFinished: function() {
        return this.me.health <= 0 || this.opponent.health <= 0;
    },

    _log: function(action, p1, p2) {
/*        if (this.blockLog)
            return;*/
        var r = {action: action, params: [p1, p2]};
        if (this.me.owner == Owner.ME)
            r.me = true;

        this.model._log.push(r);
    },

    _initCard: function(desc, card) {
        var props = ['type', 'attacksLeft', 'id', 'damage', 'health', 'cost'];

        for (var i = 0; i < props.length; i++) {
            var prop = props[i];
            card[prop] = desc[prop];
        }
    },

    _myCard: function(id) {
        var r = this.model._cards.filter(function (c) {return c.id == id;});

        if (!r)
            throw new Error('incorrect card id');
        assert(r.length == 1);
        r = r[0];
        assert(r.owner == this.owner);

        return r;
    },

    _opponentCard: function(id) {
        var r = this.model._cards.filter(function (c) {return c.id == id;});

        if (!r)
            throw new Error('incorrect card id');
        assert(r.length == 1);
        r = r[0];
        assert(r.owner != this.owner);

        return r;
    },

    _removeDeadCards: function() {
        function isAlive(card) {
            return card.health > 0 || card.health === undefined;
        }
        this.model.emit('reposition');
        this.model._cards = this.model._cards.filter(isAlive);
    },

    canAttack: function(id1) {
        var card = this._myCard(id1);

        if (card.state != CardState.TABLE || card.attacksLeft <= 0)
            return false;

        return true;
    },

    canBeAttacked: function(id2) {
        var card = this._opponentCard(id2);

        if (card.state != CardState.TABLE)
            return false;

        return true;
    },

    canPlayCard: function(id1) {
        var card = this._myCard(id1);

        if (card.state == CardState.TABLE || card.cost > this.me.mana)
            return false;

        return true;
    },

    attackPlayer: function(id1) {
        if (!this.canAttack(id1))
            throw new Error('invalid action');

        var card = this._myCard(id1);
        card.attacksLeft--;

        card.emit('attackPlayer');

        this.opponent.health -= card.damage;

//        this.actionsCount++;
        this._log(ATTACK_PLAYER, id1);
    },

    attack: function(id1, id2) {
        if (!this.canAttack(id1) || !this.canBeAttacked(id2))
            throw new Error('invalid action');

        var card1 = this._myCard(id1), card2 = this._opponentCard(id2);

        card1.emit('attack', card2);

        card1.attacksLeft--;

        card2.health -= card1.damage;
        card1.health -= card2.damage;

        this._removeDeadCards();

  //      this.actionsCount++;
        this._log(ATTACK, id1, id2);
    },

    playCard: function(id1, _card) {
        var self = this;
        try {
            var card = this._myCard(id1);
        } catch (e) {
            if (_card) {
                var deck = this.model._cards.filter(function(c) {
                    return c.owner == self.owner && c.state == CardState.HAND;
                });
                assert(deck.length);
                var c = deck[0];

                this._initCard(_card, c);
            } else
                throw e;
        }

        if (!this.canPlayCard(id1))
            throw new Error('invalid action');

        var card = this._myCard(id1);
        card.state = CardState.TABLE;
        card.attacksLeft = 0;
        this.me.mana -= card.cost;

//        this.actionsCount++;
        this._log(PLAY_CARD, id1, card);
    },

    endTurn: function(a1, a2) {
        var opponent = this.owner == Owner.ME ? Owner.OPPONENT: Owner.ME;
        assert(this.model.turn == this.owner);
        this.model.turn = opponent;
        this.opponent.maxMana = Math.min(10, this.opponent.maxMana + 1);
        this.opponent.mana = this.opponent.maxMana;

        this.model._cards.forEach(function(card, index, array) {
            if (card.state != CardState.TABLE || card.owner != opponent)
                return;
            card.attacksLeft = 1;
        });

        var deck = this.model._cards.filter(function(card) {
            return card.owner == opponent && card.state == CardState.DECK;
        });
        // FIXME:
        assert(deck.length);

        var card = deck[0];
        card.attacksLeft = 0;
        card.state = CardState.HAND;

        if (a2) {
            this._initCard(a2, card);
        }

//        this.actionsCount++;
        this._log(END_TURN, null, card);
    }
};

function CardView(model, card, parent, view) {
    EventEmitter2.call(this);

    this.view = view;
    this.card = card;
    this.model = model;
    this.parent = parent;

    defineGProperty(this, 'highlite', false);

    this._init();
}

CardView.prototype = {
    __proto__: EventEmitter2.prototype,

    _init: function() {
        // FIXME: remove all listeners on destroy
        var group = new Group();
        this.group = group;
        var m = new paper.Matrix(0.25, 0, 0, 0.25, 0, 0);
        group.matrix = m;
        group.applyMatrix = false;

        var bg = new Raster('fg');
        this._bg = bg;
        bg.pivot = bg.bounds.topLeft;
        bg.position.x = 0;
        bg.position.y = 0;
        group.addChild(bg);

        this._x = 0;
        this._y = 0;

        this._addHighlite();
        this._addDamage();
        this._addHealth();
        this._addCost();
        this._addHeroImage();

        this._updatePosition();
        this.card.on('changed::state', this._updatePosition.bind(this));
        this.model.on('reposition', this._updatePosition.bind(this));

        this.card.on('attackPlayer', this._animateAttackPlayer.bind(this));
        this.card.on('attack', this._animateAttackCard.bind(this));

        this.group.onMouseDown = this._onMouseDown.bind(this);
        this.group.onMouseDrag = this._onMouseDrag.bind(this);
        this.group.onMouseUp = this._onMouseUp.bind(this);

        this.parent.addChild(this.group);

        if (this.card.owner == Owner.ME) {
            this.model.on('changed::turn', this._updateHighlite.bind(this));
            this.card.on('changed::attacksLeft', this._updateHighlite.bind(this));
            this.card.on('changed::state', this._updateHighlite.bind(this));
            this.model.me.on('changed::mana', this._updateHighlite.bind(this));
            this._updateHighlite();
        }
    },

    _animateAttackPlayer: function() {
        if (this.card.owner == Owner.ME)
            return;

        this.view.addAnimationBarrier();
//FIXME:
        this.group.bringToFront();

        var p = this.view.myHealth.position;
        this._animatePositionUpdate(p.x - this.group.bounds.width, p.y - this.group.bounds.height);

        this.view.addAnimationBarrier();
        this._updatePosition();
        this.view.addAnimationBarrier();
    },

    _animateAttackCard: function(other) {
        if (this.card.owner == Owner.ME)
            return;

        var otherView = this.view.cardView(other);

        this.group.bringToFront();

        var p = otherView.group.position;

        this.view.addAnimationBarrier();
        this._animatePositionUpdate(p.x - this.group.bounds.width, p.y - this.group.bounds.height);

        this.view.addAnimationBarrier();
        this._updatePosition();
        this.view.addAnimationBarrier();
    },

    _animateDeath: function() {
        this.view.addAnimationBarrier();
        this.view.queueAnimation(this.group, { opacity: 0, time: 1, transition: "easeInCubic" });
        this.view.addAnimationBarrier();
    },

    _animatePositionUpdate: function(newX, newY) {
        if (newX != this._x || newY != this._y) {
            this.view.queueAnimation(this.group.position, { x: newX, y: newY,
                                                            time: 1, transition: "easeInCubic" })
            this._x = newX;
            this._y = newY;
        }
    },

    _addHeroImage: function() {
        var self = this;
        function update() {
            if (self.card.type && heroes[self.card.type].img) {
                var hero = new Raster(self.card.type);
                hero.pivot = hero.bounds.topLeft;
                hero.position.x = 0;
                hero.position.y = 0;
                self.group.addChild(hero);
            }
            paper.view.update();
        }
        this.card.on('changed::type', update);
        update();
    },

    _updateHighlite: function() {
        var value = true;

        if (this.model.turn != this.card.owner)
            value = false;

        if (this.card.state == CardState.DECK)
            value = false;

        if (this.card.state == CardState.HAND && this.model.me.mana < this.card.cost)
            value = false;

        if (this.card.state == CardState.TABLE && this.card.attacksLeft <= 0)
            value = false;

        this.highlite = value;
    },

    _onMouseDown: function(event) {
        if (!this.highlite)
            return;

        this.group.bringToFront();
    },

    _onMouseDrag: function(event) {
        if (!this.highlite)
            return;
        this.group.position = this.parent.globalToLocal(event.point);

        this._x = this.group.position._x;
        this._y = this.group.position._y;
    },

    _onMouseUp: function(event) {
        if (!this.highlite)
            return;

        if (this.card.state == CardState.HAND) {
            if (this.group.position.y >= SCREEN_HEIGHT - this.group.bounds.height) {
                this._updatePosition();
                return;
            }

            myController.playCard(this.card.id);
            gameAction('card', this.card.id);
            return;
        }
        if (this.card.state == CardState.TABLE) {
            var point = this.parent.globalToLocal(event.point);

            if (this.view.opponentHealth.contains(point)) {
                gameAction('attack_player', this.card.id);
                myController.attackPlayer(this.card.id);
                this._updatePosition();
                return;
            }
            for (var i = 0; i < this.view.cards.length; i++) {
                //FIXME:
                var other = this.view.cards[i]
                if (this == other)
                    continue;
                if (other.card.state != CardState.TABLE)
                    continue;
                if (other.card.owner == this.card.owner)
                    continue;
                if (other.group.contains(point)) {
                    gameAction('attack', this.card.id, other.card.id);
                    myController.attack(this.card.id, other.card.id);
                    this._updatePosition();
                    return;
                }
            }
            this._updatePosition();
            return;
        }
    },

    _updatePosition: function() {
        var card = this.card;
        var cardView = this.group;
        var index = this.model.cardPosition(card);

        var newX, newY;

        cardView.pivot = this.parent.bounds.topLeft;
        if (card.state == CardState.HAND) {
            newX = 20 * (index + 1) + index * cardView.bounds.width;
            if (card.owner == Owner.ME) {
                newY = SCREEN_HEIGHT - cardView.bounds.height;
            } else {
                newY = 5;
            }
        } else if (card.state == CardState.TABLE) {
            newX = 20 * (index + 1) + index * cardView.bounds.width;
            if (card.owner == Owner.ME) {
                newY = SCREEN_HEIGHT / 2 + 20;
            } else {
                newY = SCREEN_HEIGHT / 2 - 20 - cardView.bounds.height;
            }
        } else {
            newX = SCREEN_WIDTH - cardView.bounds.width;
            if (card.owner == Owner.ME) {
                newY = SCREEN_HEIGHT / 2 + 5;
            } else {
                newY = SCREEN_HEIGHT / 2 - 5 - cardView.bounds.height;
            }
        }
        this._animatePositionUpdate(newX, newY);
    },

    _addHighlite: function() {
        var border = new Path.Rectangle(new Rectangle(new Point(0, 0), new Size(this._bg.bounds.width, this._bg.bounds.height)));
        border.strokeColor = "#00ff00";

        border.strokeWidth = 3;
        var self = this;
        function updateVisibility() {
            border.visible = self.highlite;
        }
        updateVisibility();
        this.on('changed::highlite', updateVisibility);

        this.group.addChild(border);
        this._bg.bringToFront();
    },

    _addDamage: function() {
        var dTxt = new PointText(new Point(55,485));
        dTxt.characterStyle= {
            font:"Courier",
            fontSize:80,
            fillColor:"#000000"
        }
        dTxt.paragraphStyle = {
            justification:"left"
        };

        var self = this;
        function updateText() {
            dTxt.content = self.card.damage;
            dTxt.visible = self.card.damage !== undefined;
            paper.view.update();
        }
        updateText();
        this.card.on('changed::damage', updateText);

        this.group.addChild(dTxt);
    },

    _addHealth: function() {
        var hTxt = new PointText(new Point(290,486));
        hTxt.characterStyle= {
            font:"Courier",
            fontSize:80,
            fillColor:"#000000"
        }
        hTxt.paragraphStyle = {
            justification:"left"
        };

        var self = this;
        function updateText() {
            hTxt.content = self.card.health;
            hTxt.visible = self.card.health !== undefined;

            if (self.card.health !== undefined) {
                if (self.card.health <= 0) {
                    self._animateDeath();
                  //  self.group.remove();
                }
            }
        }
        updateText();
        this.card.on('changed::health', updateText);

        this.group.addChild(hTxt);
    },

    _addCost: function() {
        var cTxt = new PointText(new Point(33,84));
        cTxt.characterStyle= {
            font:"Courier",
            fontSize:80,
            fillColor:"#000000"
        }
        cTxt.paragraphStyle = {
            justification:"left"
        };

        var self = this;
        function updateText() {
            cTxt.content = self.card.cost;
            cTxt.visible = self.card.cost !== undefined;
            paper.view.update();
        }
        updateText();
        this.card.on('changed::cost', updateText);

        this.group.addChild(cTxt);
    }
};

function GameStateView(model) {
    this.model = model;

    this.cards = [];

    this._queue = [];
    this._animationDisabled = true;
    this._activeAnimations = 0;

    this._all = new Group();
    this._all.pivot = this._all.bounds.topLeft;
    this._all.position = [0,0];
    this._all.applyMatrix = false;
    this._all.matrix.scale(view.bounds.width / SCREEN_WIDTH, view.bounds.height / SCREEN_HEIGHT);

    var bg = new Path.Rectangle(new Rectangle(new Point(1, 1), new Size(SCREEN_WIDTH - 1, SCREEN_HEIGHT - 1)));
    bg.fillColor="#ffffff";
    bg.strokeColor="#808080";
    bg.strokeWidth = 1;
    this._all.addChild(bg);
    var midLine = new Path.Line(new Point(0, SCREEN_HEIGHT / 2), new Point(SCREEN_WIDTH, SCREEN_HEIGHT / 2));
    midLine.strokeColor = 'red';
    this._all.addChild(midLine);

    this.model.on('ready', this._init.bind(this));
    this.model.on('onNewCard', this._onNewCard.bind(this));
    this.model.on('oldMovesDone', (function() {
        this._animationDisabled = false;
    }).bind(this));

    this.model.on('changed::state', (function() {
        if (this.state != GameState.IN_PROGRESS)
            this._endScreen();
    }).bind(this));
}

GameStateView.prototype = {
    _init: function() {
        this._addOpponentHealth();
        this._addHealth();
        this._addMana();
        this._addNextTurnButton();
    },

    addAnimationBarrier: function() {
        this._queue.push(null);
    },

    queueAnimation: function(obj, params) {
        assert(!('onComplete' in params));
        this._queue.push({obj: obj, params: params});

        this._startNextAnimation();
    },

    _startNextAnimation: function() {
        var self = this

        if (!this._queue.length)
            return;
        if (this._queue[0] === null) {
            if (this._activeAnimations == 0 || this._animationDisabled) {
                this._queue.shift();
                this._startNextAnimation();
            }
            return;
        }
        var params = this._queue[0].params;
        if (this._animationDisabled)
            params.time = 0;

        this._activeAnimations++;
        params.onComplete = function () {
            self._activeAnimations--;
            self._startNextAnimation();
        }
        Tweener.addTween(this._queue[0].obj, params);
        self._queue.shift();
    },

    cardView: function(card) {
        for (var i = 0; i < this.cards.length; i++) {
            if (this.cards[i].card == card)
                return this.cards[i];
        }

        assert(false);
    },

    _addOpponentHealth: function() {
        var self = this;
        var opponentHealth = new Path.Circle(new Point(1000, 100), 50);
        opponentHealth.fillColor = "#cc00cc";
        opponentHealth.strokeColor = "#808080";
        opponentHealth.strokeWidth = 1;
        this._all.addChild(opponentHealth);

        this.opponentHealth = opponentHealth;

        var txt = new PointText(new Point(1000,70));

        txt.content = '\u2764' + this.model.opponent.health;
        this.model.opponent.on('changed::health', function() {
            txt.content = '\u2764' + self.model.opponent.health;
            paper.view.update();
        });
        txt.characterStyle= {
            font:"Courier",
            fontSize:14,
            fillColor:"#000000"
        }
        txt.paragraphStyle = {
            justification:"left"
        };
        this._all.addChild(txt);
    },

    _addHealth: function() {
        var self = this;
        var selfHealth = new Path.Circle(new Point(1000, 700), 50);
        selfHealth.fillColor="#cc00cc";
        selfHealth.strokeColor="#808080";
        selfHealth.strokeWidth = 1;
        this._all.addChild(selfHealth);

        this.myHealth = selfHealth;
        var txt = new PointText(new Point(1000,700));
        txt.content = '\u2764' + this.model.me.health;
        this.model.me.on('changed::health', function() {
            txt.content = '\u2764' + self.model.me.health;
            paper.view.update();
        });
        txt.characterStyle= {
            font:"Courier",
            fontSize:14,
            fillColor:"#000000"
        }
        txt.paragraphStyle = {
            justification:"left"
        };
        this._all.addChild(txt);
    },

    _addMana: function() {
        var self = this;
        var txt = new PointText(new Point(900,700));
        txt.content = '\u2B1F' + this.model.me.mana;
        this.model.me.on('changed::mana', function() {
            txt.content = '\u2B1F' + self.model.me.mana;
            paper.view.update();
        });
        txt.characterStyle= {
            font:"Courier",
            fontSize:14,
            fillColor:"#000000"
        }
        txt.paragraphStyle = {
            justification:"left"
        };
        this._all.addChild(txt);
    },

    _addNextTurnButton: function() {
        var group = new Group();
        group.position = [1100, 10]

        var border = new Path.Rectangle(new Rectangle(new Point(0, 0), new Size(100, 50)));
        border.fillColor="green";
        border.strokeColor="#808080";
        border.strokeWidth = 1;
        border.pivot = group.bounds.topLeft;

        var dTxt = new PointText(new Point(0, 30));
        dTxt.pivot = dTxt.bounds.topLeft;
        dTxt.content = 'End Turn';
        dTxt.characterStyle= {
            font:"Courier",
            fontSize:22,
            fillColor:"#000000"
        }
        dTxt.paragraphStyle = {
            justification:"left"
        };

        group.onMouseUp = function(event) {
            //FIXME:
            gameAction('finish');
        }

        group.addChild(border);
        group.addChild(dTxt);
        this._all.addChild(group);

        dTxt.bringToFront();

        group.visible = this.model.turn == Owner.ME;

        var self = this;
        this.model.on('changed::turn', function () {
            group.visible = self.model.turn == Owner.ME;
        });
    },

    _onNewCard: function(card) {
        var self = this;
        var cardView = new CardView(this.model, card, this._all, view);

        this.cards.push(cardView);
    },

    _endScreen: function() {
        assert(this.model.state != GameState.IN_PROGRESS);

        this._all.removeChildren();
        var bg = new Path.Rectangle(new Rectangle(new Point(1, 1), new Size(SCREEN_WIDTH - 1, SCREEN_HEIGHT - 1)));
        bg.fillColor="#ffffff";
        bg.strokeColor="#808080";
        bg.strokeWidth = 1;
        this._all.addChild(bg);

        var txt = new PointText(new Point(0,70));

        if (this.model.state == GameState.WIN)
            txt.content = 'WIN';
        else
            txt.content = 'LOSE';
        txt.characterStyle= {
            font:"Courier",
            fontSize:30,
            fillColor:"#000000"
        }
        txt.paragraphStyle = {
            justification:"left"
        };
        this._all.addChild(txt);
        this._all.onMouseDown = function() {
            window.location = "mainmenu.html";
        }
        paper.view.update();
    }
};

var model = new GameStateModel();
var view = new GameStateView(model);
var myController = new GameStateController(model, Owner.ME);
var opponentController = new GameStateController(model, Owner.OPPONENT);

function gameAction(action, id1, id2) {
    var uri = host + 'v1/game_action/' + params.token + '/' + params.gameid + '/' + action + '/';

    var data = {};
    if (id1 !== undefined)
        data.id1 = id1;
    if (id2 !== undefined)
        data.id2 = id2;
    $.ajax({ url: uri, data: data }).done(function(data) {
    }).fail(function() {
        // FIXME:
    });
}
