var params = {};
params.token = localStorage.getItem('token');

function MyCards(stage) {
    EventEmitter2.call(this);

    this._all = new createjs.Container();
    stage.addChild(this._all);

    var bg = new createjs.Bitmap(document.getElementById('bg'));
    bg.scaleX = SCREEN_WIDTH / bg.getBounds().width;
    bg.scaleY = SCREEN_HEIGHT / bg.getBounds().height;
    bg.cache(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    this._all.addChild(bg);

    this._cardsContainer = new createjs.Container();
    this._all.addChild(this._cardsContainer);

    this._cards = [];
    this._views = [];

    this._addScroll();
    this._addSaveButton();

    this._initCards();
}

MyCards.prototype = {
    __proto__: EventEmitter2.prototype,

    _initCards: function() {
        var self = this;
        function addCb(view) {
            view.group.addEventListener("pressup", function() {
                view.highlite = !view.highlite;
            });
        }
        _network.ajax(host + 'v1/my_cards/' + params.token, undefined, function(data) {
            var data = JSON.parse(data);
            var x = 30;
            var y = 10;
            for (var i = 0; i < data.length; i++) {
                var card = self._createCard(Owner.ME, data[i].type, CardState.HAND, data[i].id);
                var view = new BasicCardView(card, self._cardsContainer);
                self._views.push(view);

                self.emit('newCard', view);

                view.group.x = x;
                view.group.y = y;

                x += view.group.getBounds().width + 40;

                if (x + view.group.getBounds().width > SCREEN_WIDTH) {
                    x = 30;
                    y += view.group.getBounds().height + 20;
                }

                if (data[i].selected)
                    view.highlite = true;
                addCb(view);
            }
            if (window.location.hash === '#end') {
                var newY = -self._cardsContainer.getBounds().height + 2 * self._views[0].group.getBounds().height;
                self._cardsContainer.y = newY;
            }
        });
    },

    _addScroll: function() {
        var up = UIUtils.raster('arrow');
        up.scaleX = 144 / up.getBounds().width;
        up.scaleY = up.scaleX;
        up.x = SCREEN_WIDTH - 144;

        var down = UIUtils.raster('arrow');
        down.rotation = 180;
        down.scaleX = up.scaleX;
        down.scaleY = up.scaleX;
        down.x = SCREEN_WIDTH;
        down.y = SCREEN_HEIGHT;

        var self = this;
        down.addEventListener("pressup", function() {
            var newY = self._cardsContainer.y - self._views[0].group.getBounds().height;
            newY = -Math.min(-newY, self._cardsContainer.getBounds().height - self._views[0].group.getBounds().height);
            createjs.Tween.get(self._cardsContainer).to({ y: newY }, 500);
        });
        up.addEventListener("pressup", function() {
            var newY = self._cardsContainer.y + self._views[0].group.getBounds().height;
            newY = Math.min(newY, 0);
            createjs.Tween.get(self._cardsContainer).to({ y: newY }, 500);
        });

        this._all.addChild(up);
        this._all.addChild(down);
    },

    _selectedCards: function() {
        return this._views.filter(function(o){return o.highlite;}).map(function(o) {return o.card.id;});
    },

    _addSaveButton: function() {
        var save = UIUtils.raster('ok');
        save.scaleX = 144 / save.getBounds().width;
        save.scaleY = save.scaleX;
        save.x = SCREEN_WIDTH - 144;
        save.y = SCREEN_HEIGHT / 2 - 144 / 2;
        this._all.addChild(save);

        var self = this;
        save.addEventListener("pressup", function() {
            var deck = self._selectedCards();
            assert(deck.length === 30);

            _network.ajax(host + 'v1/my_cards/' + params.token + '/set', { deck: deck }, function(data) {
                console.log(data);
            });
        });

        var txt = new createjs.Text()
        txt.x = 1210;
        txt.y = 290;
        txt.font = "22px Courier";
        txt.color = "#ffffff";

        txt.textAlign = "center";

        this._all.addChild(txt);
        function updateText() {
            var selected = self._selectedCards().length;
            txt.text = selected + '/30';

            save.visible = selected === 30;
        }

        self.on('newCard', function(card) {
            card.on('changed::highlite', updateText);
        });
        updateText();
    },

    _createCard: function(owner, type, state, id) {
        var card = new GObject({ owner: owner,
                                 type: type,
                                 id: id,
                                 state: state,

                                 damage: undefined,
                                 health: undefined,
                                 maxHealth: undefined,
                                 cost: undefined,
                                 shield: undefined,
                                 cardType: CardType.UNKNOWN });

        this._initCard({ type: type, id: id }, card);

        this._cards.push(card);

        return card;
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

insertHeroImages();
window.addEventListener("load", function() {
    stage = new createjs.Stage("myCanvas");
    createjs.Touch.enable(stage);
    stage.canvas.width = SCREEN_WIDTH;
    stage.canvas.height = SCREEN_HEIGHT;

    new MyCards(stage);
    createjs.Ticker.timingMode = createjs.Ticker.RAF;
	createjs.Ticker.addEventListener("tick", function tick(event) {
        stage.update(event);
    });
});
