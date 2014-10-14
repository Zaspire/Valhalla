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


var params = {};
params.token = localStorage.getItem('token');
params.gameid = localStorage.getItem('gameid');

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

        var p = this.view.myHealth.bounds.center;
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

        var p = otherView.group.bounds.center;

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
        this._mouseDownTime = new Date();
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

    _magnify: function() {
        this.group.bringToFront();

        var group = new Group();
        this.parent.addChild(group);
        group.opacity = 0;

        var bg = new Path.Rectangle(new Rectangle(new Point(0, 0), new Size(SCREEN_WIDTH, SCREEN_HEIGHT)));
        bg.fillColor="#000000";
        group.addChild(bg);

        var heroName = heroes[this.card.type].name;
        var ability = "";
        if (heroes[this.card.type].abilities) {
            var z = heroes[this.card.type].abilities[0];
            ability = z.castType + ': ' + z.abilityType;
        }
        var ulti = "Collest ulti ever";
        var txt = new PointText(new Point(920,60));
        txt.content = heroName;
        txt.characterStyle= {
            font:"Courier",
            fontSize:40,
            fillColor:"#dddddd"
        }
        txt.paragraphStyle = {
            justification:"center"
        };
        group.addChild(txt);

        txt = new PointText(new Point(920,200));
        txt.content = ability;
        txt.characterStyle= {
            font:"Courier",
            fontSize:30,
            fillColor:"#dddddd"
        }
        txt.paragraphStyle = {
            justification:"center"
        };
        group.addChild(txt);
        txt = new PointText(new Point(920,250));
        txt.content = ulti;
        txt.characterStyle= {
            font:"Courier",
            fontSize:30,
            fillColor:"#dddddd"
        }
        txt.paragraphStyle = {
            justification:"center"
        };
        group.addChild(txt);

        this.group.bringToFront();

        var fg = new Path.Rectangle(new Rectangle(new Point(0, 0), new Size(SCREEN_WIDTH, SCREEN_HEIGHT)));
        fg.fillColor="#ff0000";
        fg.opacity = 0;
//FIXME: add only after complete
        var self = this;

        var time = 1;
        var transition = "easeInCubic";
        var prevHeight = this.group.bounds.height;
        var origX = self.group.position.x, origY = self.group.position.y;
        fg.onMouseDown = function() {
            Tweener.addTween(self.group.position, { x: origX, y: origY, time: 1,
                                                    transition: transition,
                                                    onComplete: function() {
                fg.remove();
                group.remove();
                self.view.unblockAnimation();
            } })
            var o = {height: self.group.bounds.height};
            Tweener.addTween(o, { height: prevHeight, time: time,
                                  transition: transition,
                                  onUpdate: function() {self.group.matrix.scale(o.height/self.group.bounds.height)} });
            Tweener.addTween(group, { opacity: 0, time: time, transition: transition });
        }
        this.parent.addChild(fg);
        fg.bringToFront();

        this.view.blockAnimation();

        var o = {height: prevHeight};
        Tweener.addTween(o, { height: SCREEN_HEIGHT, time: time, transition: transition,
                              onUpdate: function() {self.group.matrix.scale(o.height/self.group.bounds.height)} });
        Tweener.addTween(group, { opacity: 1, time: time, transition: transition });
        Tweener.addTween(this.group.position, { x: 0, y: 0, time: time,
                                                transition: transition });
    },

    _onMouseUp: function(event) {
        if (new Date() - this._mouseDownTime < 200) {
            this._magnify();
            return;
        }
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

    blockAnimation: function() {
        this._blockAnimation = true;
    },

    unblockAnimation: function() {
        this._blockAnimation = false;
        this._startNextAnimation();
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

        if (this._blockAnimation)
            return;

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

        var bg;

        //FIXME: Draw
        if (this.model.state == GameState.WIN)
            bg = new Raster('win');
        else
            bg = new Raster('lose');
        bg.pivot = bg.bounds.topLeft;
        bg.position.x = 0;
        bg.position.y = 0;
        bg.scale(Math.min(SCREEN_WIDTH / bg.bounds.width, SCREEN_HEIGHT / bg.bounds.height))

        this._all.addChild(bg);
        this._all.onMouseDown = function() {
            window.location = "mainmenu.html";
        }
        paper.view.update();
    }
};

var model = new GameStateModel(host, params.token, params.gameid);
var myController = new GameStateController(model, Owner.ME);
var opponentController = new GameStateController(model, Owner.OPPONENT);
model.setOpponentController(opponentController);
model.setMyController(myController);

var view = new GameStateView(model);

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
