var stage;

const TURN_TIMEOUT = 90;

var params = {};
params.token = localStorage.getItem('token');
params.gameid = localStorage.getItem('gameid');

function CardView(model, card, parent, view) {
    BasicCardView.call(this, card, parent);

    this.view = view;
    this.model = model;

    this._init();
}

CardView.prototype = {
    __proto__: BasicCardView.prototype,

    _init: function() {
        this._addVisualState();

        this._queuePositionUpdate();
        this.card.on('changed::state', this._onStateChanged.bind(this));
        this.model.on('reposition', this._queuePositionUpdate.bind(this));

        this.card.on('attackPlayer', this._animateAttackPlayer.bind(this));
        this.card.on('attack', this._animateAttackCard.bind(this));
        this.card.on('playSpell', this._animatePlaySpell.bind(this));

        this.group.addEventListener("mousedown", this._onMouseDown.bind(this));
        this.group.addEventListener("pressmove", this._onMouseDrag.bind(this));
        this.group.addEventListener("pressup", this._onMouseUp.bind(this));

        if (this.card.owner === Owner.ME) {
            this.model.on('changed::turn', this._updateHighlite.bind(this));
            this.card.on('changed::attacksLeft', this._updateHighlite.bind(this));
            this.model.me.on('changed::mana', this._updateHighlite.bind(this));
            this._updateHighlite();
        }
        // FIXME: remove unneeded cache call
        this._cache();
    },

    _onStateChanged: function() {
        var self = this;
        if (this.card.state === CardState.DEAD) {
            this._animateDeath();
            return;
        }

        if (this.card.state !== CardState.DECK && !this.group.visible) {
            this.group.visible = true;
            this._cache();
        }
        this._queuePositionUpdate();
        if (this.card.state === CardState.TABLE && this.card.shield) {
            this.view.queueAction(true, function() {
                return new Promise(function(resolve, reject) {
                    self.view.playSound('shield');
                    resolve();
                });
            });
        }
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
            self._cache();
        }
        this.card.on('changed::visualState', update);
        update();
    },

    _animateAttackPlayer: function() {
        if (this.card.owner === Owner.ME)
            return;

        var self = this;
        this.view.queueAction(true, function () {
            return new Promise(function (resolve, reject) {
                self.group.bringToFront();

                var bounds = self.view.myHealth.getBounds();
                var p = { x: self.view.myHealth.x + bounds.width / 2, y: self.view.myHealth.y + bounds.height / 2};
                resolve(p);
            }).then(function (p) {
                if (self.card.damage >= 6)
                    self.view.playSound('attack2');
                else
                    self.view.playSound('attack');

                return self._animatePositionUpdate(p.x - self.group.getBounds().width, p.y - self.group.getBounds().height);
            }).then(function () {
                return self._updatePosition();
            });
        });
    },

    _animatePlaySpell: function(other) {
        if (this.card.owner === Owner.ME)
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
                return self._animatePositionUpdate(p.x, p.y);
            }).then(function() {
                return new Promise(function (resolve, reject) {
                    if (self.view._animationDisabled) {
                        resolve();
                        return;
                    }
                    setTimeout(function() {
                        resolve();
                    }, 400);
                });
            }).then(function () {
                var deadCards = this.model._cards.filter(function(c) {
                    return c.state === CardState.DEAD;
                });
                if (deadCards)
                    return;
                return self._updatePosition();
            });
        });
    },

    _animateAttackCard: function(other) {
        if (this.card.owner === Owner.ME)
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
                if (self.card.owner !== other.owner) {
                    if (self.card.damage >= 6)
                        self.view.playSound('attack2');
                    else
                        self.view.playSound('attack');
                }

                if (self.card.state === CardState.DEAD || other.state === CardState.DEAD)
                    return;

                return self._updatePosition();
            });
        });
    },

    _animateDeath: function() {
        var self = this;
        this.view.queueAction(true, function() {
            return new Promise(function (resolve, reject) {
                if (self.view._animationDisabled || self.card.cardType === CardType.SPELL) {
                    self.group.remove();
                    resolve();
                    return;
                }
                self.group.uncache();
                var death = UIUtils.raster('death');
                death.x = 0;
                death.y = 0;
                death.alpha = 0;
                self._group.addChild(death);

                createjs.Tween.get(death).to({ alpha:1 }, 1000).call(function() {
                    self.group.remove();
                    resolve();
                });
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
            if (newX === self._x && newY === self._y) {
                resolve();
                return;
            }
            self._x = newX;
            self._y = newY;

            createjs.Tween.get(self.group).to({ x: newX, y: newY }, 700).call(resolve);
        });
    },

    _updateHighlite: function() {
        var value = true;

        if (this.model.turn !== this.card.owner)
            value = false;

        if (this.card.owner !== Owner.ME || this.card.id === undefined)
            value = false;

        if (this.card.state === CardState.DECK || this.card.state === CardState.DEAD)
            value = false;

        if (!value) {
            this.highlite = false;
            return;
        }

        if (value && !(myController.canPlayCard(this.card.id)
                       || myController.canAttack(this.card.id)
                       || myController.canPlaySpell(this.card.id))) {
            value = false;
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
        this.group.uncache();

        var graphics = new createjs.Graphics().beginFill("#000000").drawRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        var bg = new createjs.Shape(graphics);

        group.addChild(bg);

        var heroName = heroes[this.card.type].name;
        var txt = new createjs.Text();
        txt.x = 920
        txt.y = 60;
        txt.text = heroName;
        txt.font = "40px Lobster";
        txt.color = "#dddddd";
        txt.textAlign = "center";
        group.addChild(txt);


        var description = [];
        if (heroes[this.card.type].ultimateDescription) {
            description.push('Ultimate: ' + heroes[this.card.type].ultimateDescription);
        }
        if (heroes[this.card.type].description)
            description = description.concat(heroes[this.card.type].description);

        for (var i = 0, y = 250; i < description.length; i++, y+=40) {
            var d = description[i];

            var txt = new createjs.Text();
            txt.x = 920;
            txt.y = y;
            txt.text = d;
            txt.font = "30px Niconne";
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

        var time = 700;
        var prevScale = this.group.scaleX;

        var origX = self.group.x, origY = self.group.y;
        fg.addEventListener('mousedown', function(event) {
            event.propagationStopped = true;

            createjs.Tween.get(self.group).to({ x: origX, y: origY }, time).call(function() {
                fg.remove();
                group.remove();
                self.view.unblockAnimation();
                self._cache();
            });
            createjs.Tween.get(self.group).to({ scaleX: prevScale, scaleY: prevScale }, time);
            createjs.Tween.get(group).to({ alpha: 0 }, time);
        });
        this.parent.addChild(fg);
//        this.fg.bringToFront();

        this.view.blockAnimation();

        var c = SCREEN_HEIGHT / self.group.getBounds().height;
        createjs.Tween.get(this.group).to({ scaleX: c, scaleY: c }, time);
        createjs.Tween.get(group).to({ alpha: 1 }, time);
        createjs.Tween.get(this.group).to({ x: 0, y: 0 }, time);
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

        if (this.card.state === CardState.HAND) {
            if (this.card.cardType === CardType.HERO) {
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
                    if (this === other)
                        continue;
                    if (other.card.state !== CardState.TABLE)
                        continue;
                    if (other.card.owner !== this.card.owner)
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
        if (this.card.state === CardState.TABLE) {
            var point = this.view.opponentHealth.globalToLocal(event.stageX, event.stageY);
            if (this.view.opponentHealth.hitTest(point.x, point.y) && myController.canAttackOpponent()) {
                gameAction('attack_player', this.card.id);
                myController.attackPlayer(this.card.id);
                if (this.card.damage >= 6)
                    this.view.playSound('attack2');
                else
                    this.view.playSound('attack');
                this._updatePosition();
                return;
            }
            for (var i = 0; i < this.view.cards.length; i++) {
                //FIXME:
                var other = this.view.cards[i];
                if (this === other)
                    continue;
                if (other.card.state !== CardState.TABLE)
                    continue;
                point = other.group.globalToLocal(event.stageX, event.stageY);
                if (!other.group.hitTest(point.x, point.y))
                    continue;
                if (myController.canAttackCard(this.card.id, other.card.id)) {
                    gameAction('attack', this.card.id, other.card.id);
                    myController.attack(this.card.id, other.card.id);

                    if (this.card.owner !== other.card.owner) {
                        if (this.card.damage >= 6)
                            this.view.playSound('attack2');
                        else
                            this.view.playSound('attack');
                    }

                    this._updatePosition();
                    return;
                } else {
                    if (!other.card.shield && other.card.owner !== this.card.owner && myController.opponentHasShield()) {
                        //FIXME: convert to promise
                        showDialog('You must attack a minion with shield.', undefined, 'assets/taunt.png');
                    }
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
            return c.owner === card.owner && c.state === card.state;
        });
        var index = cards.indexOf(card);
        if (index === -1)
            return;

        if (this.card.state === CardState.DECK) {
            var old = this.group.visible;
            this.group.visible = index === 0;
            if (old !== this.group.visible)
                this._cache();
        }

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
                if (card.owner === Owner.ME) {
                    newY = SCREEN_HEIGHT - cardView.getBounds().height;
                    //  newY = SCREEN_HEIGHT - cardView.bounds.height - 18;
                } else {
                    newY =  44 - cardView.getBounds().height;
                }
            }
            break;
        case CardState.TABLE:
            newX = 20 * (index + 1) + index * cardView.getBounds().width;
            if (card.owner === Owner.ME) {
                newY = 304 + 15;
            } else {
                newY = 304 - 15 - cardView.getBounds().height;
            }
            break;
        case CardState.DECK:
            newX = SCREEN_WIDTH - cardView.getBounds().width;
            if (card.owner === Owner.ME) {
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
    bg.scaleX = SCREEN_WIDTH / bg.getBounds().width;
    bg.scaleY = SCREEN_HEIGHT / bg.getBounds().height;
    bg.cache(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    this._all.addChild(bg);

    this.model.on('ready', this._init.bind(this));
    this.model.on('onNewCard', this._onNewCard.bind(this));
    this.model.on('oldMovesDone', (function() {
        this.queueAction(true, (function() {
            this._animationDisabled = false;
            return new Promise(function (resolve) {resolve()});
        }).bind(this));
    }).bind(this));

    this.model.on('OpponentLeft', function() {
        showDialog('Opponent has left the game.', undefined, 'assets/exit.png');
    });

    this.model.on('changed::state', (function() {
        if (this.state !== GameState.IN_PROGRESS)
            this._endScreen();
    }).bind(this));

    this._requestExp((function(d) {
        this.exp = JSON.parse(d);
    }).bind(this));

    this.model.on('HandLimit', this._showHandLimit.bind(this));
    this.model.on('EmptyDeck', this._showEmptyDeck.bind(this));

    this.model.on('sound', (function(id) {
        this.playSound(id);
    }).bind(this));
}

GameStateView.prototype = {
    _init: function() {
        this._addNextTurnButton();
        this._addOpponentHealth();
        this._addPlayerInfo();
        this._addTimer();
    },

    _requestExp: function(cb) {
        var uri = this.model._host + 'v1/info/' + this.model._token;
        _network.ajax(uri, undefined, cb, 30000);
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
        showDialog('Your Hand Is Too Full!', undefined, 'assets/full_hand.png');
    },

    _showEmptyDeck: function() {
        if (this._animationDisabled)
            return;

        //FIXME: exclusive action
        showDialog('Your Deck Is Empty!', undefined, 'assets/no_card.png');
    },

    cardView: function(card) {
        for (var i = 0; i < this.cards.length; i++) {
            if (this.cards[i].card == card)
                return this.cards[i];
        }

        assert(false);
    },

    playSound: function(id) {
        if (!this._animationDisabled)
            createjs.Sound.play(id, { volume: 0.4 });
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
        healthTxt.y = 98;
        healthTxt.text = '\u2764' + player.health;

        player.on('changed::health', function() {
            healthTxt.text = '\u2764' + player.health;
        });
        healthTxt.font = "26px Courier";
        group.addChild(healthTxt);

        var txt = new createjs.Text();
        txt.x = 80;
        txt.y = 19;
        txt.text = '\u262F' + player.mana;
        player.on('changed::mana', function() {
            txt.text = '\u262F' + player.mana;
        });
        txt.font = "26px Courier";
        group.addChild(txt);

        var nameTxt = new createjs.Text()
        nameTxt.x = 108;
        nameTxt.y = 64;
        nameTxt.text = player.name.length > 12 ? player.name.substr(0, 10) + '...' : player.name;
        nameTxt.font = "22px Courier";
        nameTxt.color = "#ffffff";

        nameTxt.textAlign = "center";
        group.addChild(nameTxt);

        _group.scaleX = 145 / group.getBounds().height;
        _group.scaleY = _group.scaleX;

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

    _addTimer: function() {
        var txt = new createjs.Text();
        txt.x = 1055
        txt.y = 235;
        txt.font = "bold 40px Courier";
        txt.color = "#dddddd";
        txt.textAlign = "center";
        this._all.addChild(txt);

        var start = new Date();
        this.model.on('changed::turn', function () {
            start = new Date();
        });
        var update = (function() {
            if (this.model.turn === Owner.ME) {
                var d = Math.floor(((new Date()) - start) / 1000);
                var t = TURN_TIMEOUT - d;
                if (t >= 0) {
                    txt.visible = true;
                    var m = String(Math.floor(t / 60));
                    var s = String(t % 60);
                    if (m.length < 2)
                        m = '0' + m;
                    if (s.length < 2)
                        s = '0' + s;
                    txt.text = m + ':' + s;
                } else {
                    txt.visible = false;
                    if (this._endTurnButton.visible) {
                        if (this.model.turn === Owner.ME) {
                            gameAction(END_TURN);

                            this.playSound('endturn');
                        }
                        this._endTurnButton.visible = false;
                    }
                }
                if (!this._endTurnButton.visible)
                    txt.visible = false;
            } else {
                txt.visible = false;
            }
        }).bind(this)
        update();
        setInterval(update, 1000);
    },

    _addNextTurnButton: function() {
        var group = new createjs.Container();
        this._endTurnButton = group;

        var border = UIUtils.raster('end_turn');
        border.x = 0;
        border.y = 0;
        group.addChild(border);

        border.scaleX = 219 / group.getBounds().height;
        border.scaleY = border.scaleX;

        group.x = 980;
        group.y = SCREEN_HEIGHT / 2 - group.getBounds().height / 2;

        this._all.addChild(group);

        var self = this;
        group.addEventListener('pressup', function(event) {
            //FIXME:
            gameAction(END_TURN);

            self.playSound('endturn');
            group.visible = false;
        });

        group.visible = this.model.turn === Owner.ME;

        this.model.on('changed::turn', function () {
            group.visible = self.model.turn === Owner.ME;
        });
    },

    _onNewCard: function(card) {
        var self = this;
        var cardView = new CardView(this.model, card, this._all, this);

        this.cards.push(cardView);
    },

    _endScreen: function() {
        assert(this.model.state !== GameState.IN_PROGRESS);
        this.queueAction(true, (function() {
        this._requestExp((function(exp) {
            createjs.Sound.stop();
            exp = JSON.parse(exp);

            $('#myCanvas').addClass('hidden');
            var bg = '#lose';
            if (this.model.state === GameState.WIN) {
                bg = '#win';
                createjs.Sound.play('win', { volume: 0.5 });
            } else {
                createjs.Sound.play('lose', { volume: 0.5 });
            }
            $(bg).addClass('bg').removeClass('hidden');
            $('#glass_bg').addClass('bg').removeClass('hidden').css({ "z-index": -1 });

            var textNode = $('<div/>').text('LVL:' + this.exp.lvl);
            textNode.css({ position: 'fixed', top: '10%', left: '10%',
                           "z-index": '1', "font-family": '"Comic Sans MS", cursive, sans-serif',
                           "font-size": '50px', color: 'white' });
            $('body').append(textNode);

            var e = $('<meter/>');
            e.css({ position: 'fixed', top: '90%', left: '30%',
                    width: '40%', "z-index": '1',
                    background: 'white', padding: '2px' });
            $('body').append(e);

            e.attr('min', this.exp.lvlExp).attr('max', this.exp.nextLvlExp).attr('value', this.exp.exp);
            var animate = (function () {
                createjs.Tween.get(e[0]).to({ value: exp.exp }, 2000);
            }).bind(this);
            if (exp.exp > this.exp.nextLvlExp) {
                createjs.Tween.get(e[0]).to({ value: this.exp.nextLvlExp }, 2000).call(function() {
                    e[0].min = exp.lvlExp;
                    e[0].max = exp.nextLvlExp;
                    textNode.text('LVL:' + exp.lvl);
                    animate();
                });
            } else
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

var model, myController, opponentController;

window.addEventListener("load", function() {
    createjs.Sound.registerSound("assets/audio/mixdown1.mp3", 'mixdown1');
    createjs.Sound.registerSound("assets/audio/attack.mp3", 'attack');
    createjs.Sound.registerSound("assets/audio/shield.mp3", 'shield');
    createjs.Sound.registerSound("assets/audio/endturn.mp3", 'endturn');
    createjs.Sound.registerSound("assets/audio/win.mp3", 'win');
    createjs.Sound.registerSound("assets/audio/lose.mp3", 'lose');
    createjs.Sound.registerSound("assets/audio/attack2.mp3", 'attack2');
    createjs.Sound.registerSound("assets/audio/heal.mp3", 'heal');
    createjs.Sound.registerSound("assets/audio/ultimate.mp3", 'ultimate');

    createjs.Sound.on("fileload", function(event) {
        if (event.src === "assets/audio/mixdown1.mp3")
            createjs.Sound.play('mixdown1', { loop: -1, volume: 0.4 });
    });

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
