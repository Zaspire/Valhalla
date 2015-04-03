"use strict";
var UIUtils = {
    raster: function(id) {
        return new createjs.Bitmap(document.getElementById(id));
    }
};

createjs.DisplayObject.prototype.bringToFront = function() {
    this.parent.setChildIndex(this, this.parent.children.length - 1);
}

createjs.DisplayObject.prototype.remove = function() {
    this.parent.removeChild(this);
}

function BasicCardView(card, parent) {
    EventEmitter2.call(this);

    this.card = card;
    this.parent = parent;

    defineGProperty(this, 'highlite', false);

    BasicCardView.prototype._init.call(this);
}

BasicCardView.prototype = {
    __proto__: EventEmitter2.prototype,

    _init: function() {
        // FIXME: remove all listeners on destroy
        let group = new createjs.Container();
        this._group = group;
        this.group = new createjs.Container();
        this.group.addChild(this._group);

        group.scaleX = 0.3917;
        group.scaleY = group.scaleX;

        this._x = 0;
        this._y = 0;

        this._addBG();
        this._addHighlite();
        this._addDamage();
        this._addHealth();
        this._addCost();
        this._addShield();
        this._addHeroImage();

        this.parent.addChild(this.group);
    },

    _cache: function() {
        this.group.cache(0, 0, this.group.getBounds().width, this.group.getBounds().height);
    },

    _addBG: function() {
        let bg = UIUtils.raster('bs');
        this._bg = bg;
        bg.x = 0;
        bg.y = 0;
        this._group.addChild(bg);

        let self = this;
        function update() {
            let source = 'bs';
            if (self.card.state === CardState.DEAD || self.card.state === CardState.TABLE || self.card.state === CardState.HAND && self.card.owner === Owner.ME)
                source = 'fg';
            bg.image = document.getElementById(source);
            self._cache();
        }
        this.card.on('changed::state', update);
        update();
    },

    _addHeroImage: function() {
        let self = this;
        let hero = null;
        function update() {
            if (hero)
                hero.remove();
            if (self.card.type && heroes[self.card.type].img) {
                hero = UIUtils.raster(self.card.type);
                self._group.addChild(hero);
            }
            self._cache();
        }
        this.card.on('changed::type', update);
        update();
    },

    _addHighlite: function() {
        if (this.card.owner === Owner.OPPONENT)
            return;
        let graphics = new createjs.Graphics().setStrokeStyle(8).beginStroke("#00ff00").drawRoundRect(0, 0, 378, 512, 40, 40, 40, 40);
        let border = new createjs.Shape(graphics);

        let self = this;
        function updateVisibility() {
            border.visible = self.highlite;
            self._cache()
        }
        updateVisibility();
        this.on('changed::highlite', updateVisibility);

        this._group.addChild(border);
    },

    _addDamage: function() {
        let sword = UIUtils.raster('sword');
        sword.x = 105;
        sword.y = 426;

        let dTxt = new createjs.Text();
        dTxt.x = 27;
        dTxt.y = 166;
        dTxt.textAlign = "center";
        dTxt.font = "30px Courier";

        let self = this;
        function updateText() {
            dTxt.visible = self.card.damage !== undefined;
            sword.visible = self.card.damage !== undefined;
            if (dTxt.visible) {
                dTxt.text = self.card.damage;
                if (self.card.damage === heroes[self.card.type].damage)
                    dTxt.color = "#000000";
                else if (self.card.damage > heroes[self.card.type].damage)
                    dTxt.color = "#008400";
                else
                    dTxt.color = "#ff0000";
            }
            self._cache();
        }
        updateText();
        this.card.on('changed::damage', updateText);

        this.group.addChild(dTxt);
        this._group.addChild(sword);
    },

    _addHealth: function() {
        let heart = UIUtils.raster('heart');
        heart.x = 225;
        heart.y = 426;

        let hTxt = new createjs.Text();
        hTxt.x = 125;
        hTxt.y = 166;
        hTxt.textAlign = "center";
        hTxt.font = "30px Courier";

        let self = this;
        function updateText() {
            let visible = self.card.health !== undefined;
            hTxt.visible = visible;
            heart.visible = visible;
            if (visible) {
                if (self.card.health === self.card.maxHealth) {
                    if (self.card.health > heroes[self.card.type].health)
                        hTxt.color = "#008400";
                    else
                        hTxt.color = "#000000";
                } else
                    hTxt.color = "#ff0000";
                hTxt.text = self.card.health;
            }
            self._cache();
        }
        updateText();
        this.card.on('changed::health', updateText);
        this.card.on('changed::maxHealth', updateText);

        this._group.addChild(heart);
        this.group.addChild(hTxt);
    },

    _addCost: function() {
        let circle = UIUtils.raster('circle');
        circle.x = 7;
        circle.y = 7;

        let cTxt = new createjs.Text();
        cTxt.x = 21;
        cTxt.y = 8;
        cTxt.textAlign = "center";
        cTxt.font = "30px Courier";

        let self = this;
        function updateText() {
            cTxt.visible = self.card.state === CardState.HAND;
            circle.visible = cTxt.visible;
            cTxt.text = self.card.cost;
            self._cache();
        }
        updateText();
        this.card.on('changed::cost', updateText);
        this.card.on('changed::state', updateText);

        this._group.addChild(circle);
        this.group.addChild(cTxt);
    },

    _addShield: function() {
        let bg = UIUtils.raster('shield');
        bg.x = 280;
        bg.y = 10;

        let self = this;
        function update() {
            bg.visible = self.card.shield;
            bg.bringToFront();
            self._cache();
        }
        this.card.on('changed::shield', update);

        this._group.addChild(bg);
        update();
    }

};

function insertHeroImages() {
    for (let id in heroes) {
        if (!heroes[id].img)
            continue;

        let img = document.createElement("img");
        img.src = "assets/heroes/" + heroes[id].img;
        img.style.display = "none";
        img.id = id;

        document.body.appendChild(img);
    }
}
