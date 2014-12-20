var stage;

var params = {};
params.token = localStorage.getItem('token');
params.gameid = localStorage.getItem('gameid');

UIUtils = {
    raster: function(id) {
        return new createjs.Bitmap(document.getElementById(id));
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
        var group = new createjs.Container();
        this._group = group;
        this.group = new createjs.Container();
        this.group.addChild(this._group);

        group.setTransform(0, 0, 0.3917, 0.3917);

        this._x = 0;
        this._y = 0;

        this._addBG();
        this._addHighlite();
        this._addDamage();
        this._addHealth();
        this._addCost();
        this._addShield();
        this._addHeroImage();
        this._addVisualState();

        this._queuePositionUpdate();
        this.card.on('changed::state', this._onStateChanged.bind(this));
        this.model.on('reposition', this._queuePositionUpdate.bind(this));

        this.card.on('attackPlayer', this._animateAttackPlayer.bind(this));
        this.card.on('attack', this._animateAttackCard.bind(this));

        this.group.addEventListener("mousedown", this._onMouseDown.bind(this));
        this.group.addEventListener("pressmove", this._onMouseDrag.bind(this));
        this.group.addEventListener("pressup", this._onMouseUp.bind(this));

        this.parent.addChild(this.group);

        if (this.card.owner == Owner.ME) {
            this.model.on('changed::turn', this._updateHighlite.bind(this));
            this.card.on('changed::attacksLeft', this._updateHighlite.bind(this));
            this.model.me.on('changed::mana', this._updateHighlite.bind(this));
            this._updateHighlite();
        }
    },

    _onStateChanged: function() {
        if (this.card.state == CardState.DEAD) {
            this._animateDeath();
            return;
        }
        this._queuePositionUpdate();
    },

    _addVisualState: function() {
        var fg = {};

        var self = this;
        function update() {
            var visual = self.card.visualState.split(',');
            for (var i in fg) {
                if (visual.indexOf(i) == -1) {
                    fg[i].remove();
                    delete fg[i];
                }
            }
            for (var i = 0; i < visual.length; i++) {
                if (!visual[i])
                    continue;
                fg[visual[i]] = UIUtils.raster(visual[i]);
                self._group.addChild(fg[visual[i]]);
            }
        }
        this.card.on('changed::visualState', update);
        update();
    },

    _addBG: function() {
        var bg = UIUtils.raster('bs');
        this._bg = bg;
        bg.x = 0;
        bg.y = 0;
        this._group.addChild(bg);

        var self = this;
        function update() {
            var source = 'bs';
            if (self.card.state == CardState.DEAD || self.card.state == CardState.TABLE || self.card.state == CardState.HAND && self.card.owner == Owner.ME)
                source = 'fg';
            bg.image = document.getElementById(source);
        }
        this.card.on('changed::state', update);
        update();
    },

    _animateAttackPlayer: function() {
        if (this.card.owner == Owner.ME)
            return;

        var self = this;
        this.view.queueAction(true, function () {
            return new Promise(function (resolve, reject) {
                self.group.bringToFront();

                var bounds = self.view.myHealth.getBounds();
                var p = { x: self.view.myHealth.x + bounds.width / 2, y: self.view.myHealth.y + bounds.height / 2};
                resolve(p);
            }).then(function (p) {
                return self._animatePositionUpdate(p.x - self.group.getBounds().width, p.y - self.group.getBounds().height);
            }).then(function () {
                return self._updatePosition();
            });
        });
    },

    _animateAttackCard: function(other) {
        if (this.card.owner == Owner.ME)
            return;

        var self = this;
        this.view.queueAction(true, function () {
            return new Promise(function (resolve, reject) {
                var otherView = self.view.cardView(other);

                if (!self.view._animationDisabled)
                    self.group.bringToFront();

                var bounds = otherView.group.getBounds();
                var p = { x: otherView.group.x + bounds.width / 2, y: otherView.group.y + bounds.height / 2};
                resolve(p);
            }).then(function (p) {
                return self._animatePositionUpdate(p.x - self.group.getBounds().width, p.y - self.group.getBounds().height);
            }).then(function () {
                return self._updatePosition();
            });
        });
    },

    _animateDeath: function() {
        var self = this;
        this.view.queueAction(true, function() {
            return new Promise(function (resolve, reject) {
                if (self.view._animationDisabled || self.card.cardType == CardType.SPELL) {
                    self.group.remove();
                    resolve();
                    return;
                }

                var death = UIUtils.raster('death');
                death.x = 0;
                death.y = 0;
                death.alpha = 0;
                self._group.addChild(death);

                var params = { alpha: 1, time: 1.3, transition: "linear",
                               onComplete: function() {
                                   resolve();
                                   self.group.remove();
                               } };
                Tweener.addTween(death, params);
            });
        });
    },

    _animatePositionUpdate: function(newX, newY) {
        var self = this;
        return new Promise(function (resolve, reject) {
            if (self.view._animationDisabled) {
                self.group.x = newX;
                self.group.y = newY;
                resolve();
                return;
            }
            if (newX == self._x && newY == self._y) {
                resolve();
                return;
            }
            self._x = newX;
            self._y = newY;

            var params = { x: newX, y: newY,
                           time: 1, transition: "easeInCubic",
                           onComplete: function() { resolve(); } };
            Tweener.addTween(self.group, params);
        });
    },

    _addHeroImage: function() {
        var self = this;
        var hero = null;
        function update() {
            if (hero)
                hero.remove();
            if (self.card.type && heroes[self.card.type].img) {
                hero = UIUtils.raster(self.card.type);
                self._group.addChild(hero);
            }
        }
        this.card.on('changed::type', update);
        update();
    },

    _updateHighlite: function() {
        var value = true;

        if (this.model.turn != this.card.owner)
            value = false;

        if (this.card.owner != Owner.ME)
            value = false;

        if (this.card.state == CardState.DECK)
            value = false;

        //FIXME: remove try statement
        try {
            if (value && !(myController.canPlayCard(this.card.id)
                           || myController.canAttack(this.card.id)
                           || myController.canPlaySpell(this.card.id))) {
                value = false;
            }
        } catch (e) {
            value = false;
            console.log(e);
        }
        this.highlite = value;
    },

    _onMouseDown: function(event) {
        this._mouseDownTime = new Date();
        if (!this.highlite)
            return;
        event.propagationStopped = true;
        this.group.bringToFront();
    },

    _onMouseDrag: function(event) {
        if (!this.highlite)
            return;
        this.group.x = event.stageX;
        this.group.y = event.stageY;

        this._x = this.group.x;
        this._y = this.group.y;

        event.propagationStopped = true;
    },

    _magnify: function(event) {
        var group = new createjs.Container();
        this.parent.addChild(group);
        group.alpha = 0;

        this.group.bringToFront();

        var graphics = new createjs.Graphics().beginFill("#000000").drawRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        var bg = new createjs.Shape(graphics);

        group.addChild(bg);

        var heroName = heroes[this.card.type].name;
        var ulti = "";
        if (heroes[this.card.type].ultimateDescription) {
            ulti = heroes[this.card.type].ultimateDescription;
        }
        var txt = new createjs.Text();
        txt.x = 920
        txt.y = 60;
        txt.text = heroName;
        txt.font = "40px Courier";
        txt.color = "#dddddd";
        txt.textAlign = "center";
        group.addChild(txt);

        var txt = new createjs.Text();
        txt.x = 920;
        txt.y = 250;
        if (ulti)
            ulti = 'Ultimate: ' + ulti;
        txt.text = ulti;
        txt.font = "30px Courier";
        txt.color = "#dddddd"
        txt.textAlign = "center";
        group.addChild(txt);

        for (var i = 0, y = 290; heroes[this.card.type].description && i < heroes[this.card.type].description.length; i++, y+=40) {
            var d = heroes[this.card.type].description[i];

            var txt = new createjs.Text();
            txt.x = 920;
            txt.y = y;
            txt.text = d;
            txt.font = "30px Courier";
            txt.color = "#dddddd";
            txt.textAlign = "center";
            group.addChild(txt);
        }

//        this.group.bringToFront();
        graphics = new createjs.Graphics().beginFill("#ff0000").drawRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        var fg = new createjs.Shape(graphics);
        fg.alpha = 0.01;

//FIXME: add only after complete
        var self = this;

        var time = 1;
        var transition = "easeInCubic";
        var prevHeight = this.group.getBounds().height;
        var origX = self.group.x, origY = self.group.y;
        fg.addEventListener('mousedown', function(event) {
            event.propagationStopped = true;

            Tweener.addTween(self.group, { x: origX, y: origY, time: 1,
                                           transition: transition,
                                           onComplete: function() {
                fg.remove();
                group.remove();
                self.view.unblockAnimation();
            } })
            var o = {height: self.group.getBounds().height};
            Tweener.addTween(o, { height: prevHeight, time: time,
                                  transition: transition,
                                  onUpdate: function() {
                                      var c = o.height/self._group.getBounds().height;
                                      self._group.setTransform(0, 0, c, c);
                                  } });
            Tweener.addTween(group, { alpha: 0, time: time, transition: transition });
        });
        this.parent.addChild(fg);
//        this.fg.bringToFront();

        this.view.blockAnimation();

        var o = {height: prevHeight};
        Tweener.addTween(o, { height: SCREEN_HEIGHT, time: time, transition: transition,
                              onUpdate: function() {
                                  var c = o.height/self._group.getBounds().height;
                                  self._group.setTransform(0, 0, c, c);
                              } });
        Tweener.addTween(group, { alpha: 1, time: time, transition: transition });
        Tweener.addTween(this.group, { x: 0, y: 0, time: time,
                                       transition: transition });
    },

    _onMouseUp: function(event) {
        if (this.card.state === CardState.DECK)
            return;

        if (new Date() - this._mouseDownTime < 200) {
            this._magnify();
            return;
        }
        if (!this.highlite)
            return;

        if (this.card.state == CardState.HAND) {
            if (this.card.cardType == CardType.HERO) {
                if (this.group.y >= SCREEN_HEIGHT - this.group.getBounds().height) {
                    this._updatePosition();
                    return;
                }

                myController.playCard(this.card.id);
                gameAction(PLAY_CARD, this.card.id);
                return;
            } else {
                for (var i = 0; i < this.view.cards.length; i++) {
                    var other = this.view.cards[i]
                    if (this == other)
                        continue;
                    if (other.card.state != CardState.TABLE)
                        continue;
                    if (other.card.owner != this.card.owner)
                        continue;
                    point = other.group.globalToLocal(event.stageX, event.stageY);
                    if (other.group.hitTest(point.x, point.y)) {
                        gameAction(PLAY_SPELL, this.card.id, other.card.id);
                        myController.playSpell(this.card.id, other.card.id);
                        this._updatePosition();
                        return;
                    }
                }
                this._updatePosition();
                return;
            }
        }
        if (this.card.state == CardState.TABLE) {
            var point = this.view.opponentHealth.globalToLocal(event.stageX, event.stageY);
            if (this.view.opponentHealth.hitTest(point.x, point.y) && myController.canAttackOpponent()) {
                gameAction('attack_player', this.card.id);
                myController.attackPlayer(this.card.id);
                this._updatePosition();
                return;
            }
            for (var i = 0; i < this.view.cards.length; i++) {
                //FIXME:
                var other = this.view.cards[i];
                if (this == other)
                    continue;
                if (other.card.state != CardState.TABLE)
                    continue;
                point = other.group.globalToLocal(event.stageX, event.stageY);
                if (!other.group.hitTest(point.x, point.y))
                    continue;
                if (myController.canAttackCard(this.card.id, other.card.id)) {
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

    _queuePositionUpdate: function() {
        var self = this;
        this._updateHighlite();
        this.view.queueAction(false, function() {
            return self._updatePosition();
        });
    },

    _updatePosition: function() {
        var card = this.card;
        var cardView = this.group;

        var cards = this.model._cards.filter(function(c) {
            return c.owner == card.owner && c.state == card.state;
        });
        var index = cards.indexOf(card);
        if (index == -1)
            return;

        var newX, newY;

        switch (card.state) {
        case CardState.HAND:
            {
                var required = cards.length * (20 + cardView.getBounds().width);
                var avaliable = SCREEN_WIDTH - this.view.myHealth.getBounds().width;

                var offset = 0;
                if (required > avaliable) {
                    offset = (required - avaliable) / (cards.length - 1);
                }
                newX = 20 * (index + 1) + index * (cardView.getBounds().width - offset);
                if (card.owner == Owner.ME) {
                    newY = SCREEN_HEIGHT - cardView.getBounds().height;
                    //  newY = SCREEN_HEIGHT - cardView.bounds.height - 18;
                } else {
                    newY =  44 - cardView.getBounds().height;
                }
            }
            break;
        case CardState.TABLE:
            newX = 20 * (index + 1) + index * cardView.getBounds().width;
            if (card.owner == Owner.ME) {
                newY = 304 + 15;
            } else {
                newY = 304 - 15 - cardView.getBounds().height;
            }
            break;
        case CardState.DECK:
            newX = SCREEN_WIDTH - cardView.getBounds().width;
            if (card.owner == Owner.ME) {
                newY = SCREEN_HEIGHT / 2 + 5;
            } else {
                newY = SCREEN_HEIGHT / 2 - 5 - cardView.getBounds().height;
            }
            break;
        case CardState.DEAD:
            newX = cardView.x;
            newY = cardView.y;
            break;
        }
        return this._animatePositionUpdate(newX, newY);
    },

    _addHighlite: function() {
        var graphics = new createjs.Graphics().setStrokeStyle(3).beginStroke("#00ff00").drawRect(0, 0, 378, 512);
        var border = new createjs.Shape(graphics);

        var self = this;
        function updateVisibility() {
            border.visible = self.highlite;
        }
        updateVisibility();
        this.on('changed::highlite', updateVisibility);

        this._group.addChild(border);
        //this._bg.bringToFront();
    },

    _addDamage: function() {
        var sword = UIUtils.raster('sword');
        sword.x = 105;
        sword.y = 426;

        var dTxt = new createjs.Text();
        dTxt.x = 55;
        dTxt.y = 426;
        dTxt.font = "80px Courier";

        var self = this;
        function updateText() {
            dTxt.text = self.card.damage;
            dTxt.visible = self.card.damage !== undefined;
            sword.visible = self.card.damage !== undefined;
        }
        updateText();
        this.card.on('changed::damage', updateText);

        this._group.addChild(dTxt);
        this._group.addChild(sword);
    },

    _addHealth: function() {
        var heart = UIUtils.raster('heart');
        heart.x = 225;
        heart.y = 426;

        var hTxt = new createjs.Text();
        hTxt.x = 290
        hTxt.y = 426;
        hTxt.font = "80px Courier";

        var self = this;
        function updateText() {
            var visible = self.card.health !== undefined;
            hTxt.visible = visible;
            heart.visible = visible;
            if (visible) {
                if (self.card.health == self.card.maxHealth) {
                    if (self.card.health > heroes[self.card.type].health)
                        hTxt.color = "#008400";
                    else
                        hTxt.color = "#000000";
                } else
                    hTxt.color = "#ff0000";
                hTxt.text = self.card.health;
            }
        }
        updateText();
        this.card.on('changed::health', updateText);
        this.card.on('changed::maxHealth', updateText);

        this._group.addChild(heart);
        this._group.addChild(hTxt);
    },

    _addCost: function() {
        var circle = UIUtils.raster('circle');
        circle.x = 7;
        circle.y = 7;

        var cTxt = new createjs.Text();
        cTxt.x = 33;
        cTxt.y = 23;
        cTxt.font = "80px Courier";

        var self = this;
        function updateText() {
            cTxt.text = self.card.cost;
            cTxt.visible = self.card.cost !== undefined;
            circle.visible = self.card.cost !== undefined;
        }
        updateText();
        this.card.on('changed::cost', updateText);

        this._group.addChild(circle);
        this._group.addChild(cTxt);
    },
    _addShield: function() {
        var bg = UIUtils.raster('shield');
        bg.x = 280;
        bg.y = 10;

        var self = this;
        function update() {
            bg.visible = self.card.shield;
            bg.bringToFront();
        }
        this.card.on('changed::shield', update);

        this._group.addChild(bg);
        update();
    }
};

function GameStateView(model) {
    this.model = model;

    this.cards = [];

    this._exclusiveAction = new Promise(function (resolve) {resolve()});
    this._promiseQueue = [];
    this._animationDisabled = true;
    this._activeAnimations = 0;

    this._all = new createjs.Container();
    stage.addChild(this._all);

    var bg = new createjs.Bitmap(document.getElementById('bg'));
    bg.setTransform(0, 0, SCREEN_WIDTH / bg.getBounds().width, SCREEN_HEIGHT / bg.getBounds().height);
    this._all.addChild(bg);

    this.model.on('ready', this._init.bind(this));
    this.model.on('onNewCard', this._onNewCard.bind(this));
    this.model.on('oldMovesDone', (function() {
        this.queueAction(true, (function() {
            this._animationDisabled = false;
            return new Promise(function (resolve) {resolve()});
        }).bind(this));
    }).bind(this));

    this.model.on('changed::state', (function() {
        if (this.state != GameState.IN_PROGRESS)
            this._endScreen();
    }).bind(this));

    this._requestExp((function(d) {
        this.exp = JSON.parse(d);
    }).bind(this));

    this.model.on('HandLimit', this._showHandLimit.bind(this));
    this.model.on('EmptyDeck', this._showEmptyDeck.bind(this));
}

GameStateView.prototype = {
    _init: function() {
        this._addNextTurnButton();
        this._addOpponentHealth();
        this._addPlayerInfo();
    },

    _requestExp: function(cb) {
        var uri = this.model._host + 'v1/info/' + this.model._token;
        _network.ajax(uri, undefined, cb);
    },

    queueAction: function(exclusive, cb) {
        if (exclusive) {
            var t = this._promiseQueue;
            this._promiseQueue = [];
            t.push(this._exclusiveAction);
            //FIXME: report error if rejected
            this._exclusiveAction = Promise.all(t).then(cb);
        } else {
            this._promiseQueue.push(this._exclusiveAction.then(cb));
        }
    },

    blockAnimation: function() {
        this._blockAnimation = true;
    },

    unblockAnimation: function() {
        this._blockAnimation = false;
    },

    _showHandLimit: function() {
        if (this._animationDisabled)
            return;

        //FIXME: exclusive action
        showDialog('Your Hand Is Too Full!');
    },

    _showEmptyDeck: function() {
        if (this._animationDisabled)
            return;

        //FIXME: exclusive action
        showDialog('Your Deck Is Empty!');
    },

    cardView: function(card) {
        for (var i = 0; i < this.cards.length; i++) {
            if (this.cards[i].card == card)
                return this.cards[i];
        }

        assert(false);
    },

    _createPlayerInfo: function(player) {
        var _group = new createjs.Container();
        var group = new createjs.Container();
        group.addChild(_group);

        var border = UIUtils.raster('hm');
        border.x = 0;
        border.y = 0;
        _group.addChild(border);

        var self = this;

        var healthTxt = new createjs.Text();
        healthTxt.x = 80;
        healthTxt.y = 88;
        healthTxt.text = '\u2764' + player.health;

        player.on('changed::health', function() {
            healthTxt.text = '\u2764' + player.health;
        });
        healthTxt.font = "22px Courier";
        _group.addChild(healthTxt);

        var txt = new createjs.Text();
        txt.x = 80;
        txt.y = 19;
        txt.text = '\u2B1F' + player.mana;
        player.on('changed::mana', function() {
            txt.text = '\u2B1F' + player.mana;
        });
        txt.font = "22px Courier";
        _group.addChild(txt);

        var nameTxt = new createjs.Text()
        nameTxt.x = 97;
        nameTxt.y = 54;
        nameTxt.text = player.name.length > 12 ? player.name.substr(0, 10) + '...' : player.name;
        nameTxt.font = "22px Courier";
        nameTxt.color = "#ffffff";

        nameTxt.textAlign = "center";
        _group.addChild(nameTxt);

        _group.setTransform(0, 0, 145 / group.getBounds().height, 145 / group.getBounds().height);

        return group;
    },

    _addOpponentHealth: function() {
        var group = this._createPlayerInfo(this.model.opponent);
        group.x = SCREEN_WIDTH - group.getBounds().width;
        group.y = 0;
        this._all.addChild(group);

        this.opponentHealth = group;
    },

    _addPlayerInfo: function() {
        var group = this._createPlayerInfo(this.model.me);

        group.x = SCREEN_WIDTH - group.getBounds().width;
        group.y = SCREEN_HEIGHT - group.getBounds().height;
        this._all.addChild(group);

        this.myHealth = group;
    },

    _addNextTurnButton: function() {
        var group = new createjs.Container();

        var border = UIUtils.raster('end_turn');
        border.x = 0;
        border.y = 0;
        group.addChild(border);

        border.setTransform(0, 0, 219 / group.getBounds().height, 219 / group.getBounds().height);

        group.x = 950;
        group.y = SCREEN_HEIGHT / 2 - group.getBounds().height / 2;

        this._all.addChild(group);

        group.addEventListener('pressup', function(event) {
            //FIXME:
            gameAction('finish');
            group.visible = false;
        });

        group.visible = this.model.turn == Owner.ME;

        var self = this;
        this.model.on('changed::turn', function () {
            group.visible = self.model.turn == Owner.ME;
        });
    },

    _onNewCard: function(card) {
        var self = this;
        var cardView = new CardView(this.model, card, this._all, this);

        this.cards.push(cardView);
    },

    _endScreen: function() {
        assert(this.model.state != GameState.IN_PROGRESS);
        this.queueAction(true, (function() {
        this._requestExp((function(exp) {
            exp = JSON.parse(exp);

            $('#myCanvas').addClass('hidden');
            var bg = '#lose';
            if (this.model.state == GameState.WIN)
                bg = '#win';
            $(bg).addClass('bg').removeClass('hidden');
            $('#glass_bg').addClass('bg').removeClass('hidden').css({ "z-index": -1 });

            var textNode = $('<div/>').text('LVL:' + this.exp.lvl);
            textNode.css({ position: 'fixed', top: '10%', left: '10%',
                           "z-index": '1', "font-family": '"Comic Sans MS", cursive, sans-serif',
                           "font-size": '50px', color: 'white' });
            $('body').append(textNode);

            var e = $('<progress/>');
            e.css({ position: 'fixed', top: '90%', left: '30%',
                    width: '40%', "z-index": '1',
                    background: 'white', padding: '2px' });
            $('body').append(e);

            e.attr('max', this.exp.nextLvlExp).attr('value', this.exp.exp);
            var animate = (function () {
                Tweener.addTween(e[0], { time: 2, value: exp.exp });
            }).bind(this);
            if (exp.exp > this.exp.nextLvlExp)
                Tweener.addTween(e[0], { time: 2, value: this.exp.nextLvlExp,
                                         onComplete: function() {
                                             e[0].max = exp.nextLvlExp;
                                             textNode.text('LVL:' + exp.lvl);
                                             animate();
                                         } });
            else
                animate();
            document.body.onclick = function() {
                window.location = "mainmenu.html";
            }
        }).bind(this));
        }).bind(this));
    }
};

function gameAction(action, id1, id2) {
    var uri = host + 'v1/game_action/' + params.token + '/' + params.gameid + '/' + action + '/';

    var data = {};
    if (id1 !== undefined)
        data.id1 = id1;
    if (id2 !== undefined)
        data.id2 = id2;
    _network.ajax(uri, data, null);
}
console.log(createjs.Container.prototype)

createjs.DisplayObject.prototype.bringToFront = function() {
    this.parent.setChildIndex(this, this.parent.children.length - 1);
}

createjs.DisplayObject.prototype.remove = function() {
    this.parent.removeChild(this);
}

var model, myController, opponentController;
window.addEventListener("load", function() {
    stage = new createjs.Stage("myCanvas");
    createjs.Touch.enable(stage);
    stage.canvas.width = SCREEN_WIDTH;
    stage.canvas.height = SCREEN_HEIGHT;
    model = new GameStateModel(host, params.token, params.gameid);
    myController = new GameStateController(model, Owner.ME);
    opponentController = new GameStateController(model, Owner.OPPONENT);
    model.setOpponentController(opponentController);
    model.setMyController(myController);

    var view = new GameStateView(model);

    createjs.Ticker.timingMode = createjs.Ticker.RAF;
	createjs.Ticker.addEventListener("tick", function tick(event) {
        stage.update(event);
    });
});
