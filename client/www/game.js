var SCREEN_WIDTH = 1280;
var SCREEN_HEIGHT = 768;

function createCard(damage, health) {
    var group = new Group();

    var border = new Path.Rectangle(new Rectangle(new Point(0, 0), new Size(50, 75)));
    border.fillColor="#ededed";
    border.strokeColor="#808080";
    border.strokeWidth = 1;
    group.addChild(border);

if (damage !== undefined) {
    var dTxt = new PointText(new Point(5,65));
    dTxt.content = '\u2694' + damage;
    dTxt.characterStyle= {
        font:"Courier",
        fontSize:14,
        fillColor:"#000000"
    }
    dTxt.paragraphStyle = {
        justification:"left"
    };
    group.addChild(dTxt);
}
if (health !== undefined) {
    var hTxt = new PointText(new Point(25,65));
    hTxt.content = '\u2764' + health;
    hTxt.characterStyle= {
        font:"Courier",
        fontSize:14,
        fillColor:"#000000"
    }
    hTxt.paragraphStyle = {
        justification:"left"
    };
    group.addChild(hTxt);
}
    return group;
}

function State() {
    this.opponentCardsCount = 0;
    this.playerHand = [];
    this.cardsOnTable = [];
    this.myTurn = false;

    project.view.onResize = this._onResize.bind(this);
}

State.prototype = {
    _onResize: function() {
/*        console.log(project.view.bounds);
console.log(view.bounds.width);
console.log(this._all);
        if (this._all)
            this._all.scale((view.bounds.width / SCREEN_WIDTH) / this._all.scaling.x, (view.bounds.height / SCREEN_HEIGHT) / this._all.scaling.y);*/
        this.refresh();
    },

    refresh: function() {
        project.clear();

        this._all = new Group();
        this._all.pivot = this._all.bounds.topLeft;
        this._all.position = [0,0];

        var bg = new Path.Rectangle(new Rectangle(new Point(0, 0), new Size(SCREEN_WIDTH -4 , SCREEN_HEIGHT -4)));
        bg.fillColor="#ffffff";
        bg.strokeColor="#808080";
        bg.strokeWidth = 1;
        this._all.addChild(bg);

        var x = 20;

        var self = this;
        function createCb(id) {
            return function(event) {
                for (var i = 0; i < self.playerHand.length; i++) {
                    if (self.playerHand[i].id == id)
                        break;
                }
                self.cardsOnTable.push(self.playerHand[i]);
                self.playerHand.splice(i, 1);
                self.refresh();
            };
        }
        for (var i = 0; i < this.playerHand.length; i++) {
            var card = createCard(this.playerHand[i].damage, this.playerHand[i].health);

            this._all.addChild(card);
            card.pivot = card.bounds.topLeft;
            card.position.x = x;
            card.position.y = SCREEN_HEIGHT - card.bounds.height;
            x += card.bounds.width + 20;

            if (this.myTurn) {
                card.onMouseDown = createCb(this.playerHand[i].id);
            }
        }
        x = 20;
        for (var i = 0; i < this.opponentCardsCount; i++) {
            var card = createCard();

            this._all.addChild(card);
            card.pivot = card.bounds.topLeft;
            card.position.x = x;
            card.position.y = 5;
            x += card.bounds.width + 20;
        }
        var midLine = new Path.Line(new Point(0, SCREEN_HEIGHT / 2), new Point(SCREEN_WIDTH, SCREEN_HEIGHT / 2));
        midLine.strokeColor = 'red';
        this._all.addChild(midLine);

function createCb2(id) {
    return function(event) {
        for (var i = 0; i < self.cardsOnTable.length; i++) {
            if (self.cardsOnTable[i].id == id)
                break;
        }
        var card = self.cardsOnTable[i]._card;
        card.bringToFront();
    }
}
function createCb3(id) {
    return function(event) {
        for (var i = 0; i < self.cardsOnTable.length; i++) {
            if (self.cardsOnTable[i].id == id)
                break;
        }
        var card = self.cardsOnTable[i]._card;
        card.position = event.point;
    }
}
function createCb4(id) {
    return function(event) {
        for (var i = 0; i < self.cardsOnTable.length; i++) {
            if (self.cardsOnTable[i].mine)
                continue;
            if (self.cardsOnTable[i]._card.contains(event.point))
                break;
        }
        if (i >= self.cardsOnTable.length) {
            self.refresh();
            return;
        }
        var dest = self.cardsOnTable[i];
        for (i = 0; i < self.cardsOnTable.length; i++) {
            if (self.cardsOnTable[i].id == id)
                break;
        }
        var source = self.cardsOnTable[i];

        dest.health -= source.damage;
        source.health -= dest.damage;

        if (source.health <= 0) {
            self.cardsOnTable.splice(self.cardsOnTable.indexOf(source), 1);
        }
        if (dest.health <= 0) {
            self.cardsOnTable.splice(self.cardsOnTable.indexOf(dest), 1);
        }
        self.refresh();
    }
}
        var x1 = 20, x2 = 20;
        for (var i = 0; i < this.cardsOnTable.length; i++) {
            var desc = this.cardsOnTable[i];
            var card = createCard(desc.damage, desc.health);

this.cardsOnTable[i]._card = card;

            var dy;
            this._all.addChild(card);
            if (desc.mine) {
                card.pivot = card.bounds.topLeft;
                card.position.x = x1;
                x1 += card.bounds.width + 20;
                dy = +20;

                card.onMouseDown = createCb2(desc.id);
                card.onMouseDrag = createCb3(desc.id);
                card.onMouseUp = createCb4(desc.id);
            } else {
                card.pivot = card.bounds.bottomLeft;
                card.position.x = x2;
                x2 += card.bounds.width + 20;
                dy = -20;
            }

            card.position.y = SCREEN_HEIGHT / 2 + dy;
        }
        this._x1 = x1;
        this._all.scale(view.bounds.width / SCREEN_WIDTH, view.bounds.height / SCREEN_HEIGHT);
    }
};

var state = new State();
state.playerHand = [{mine:true, damage: 1, health: 10, id: 1}, {damage: 6, health: 3, id: 2, mine: true}];
state.cardsOnTable = [{damage: 1, health: 10, id: 3, mine: true}, {id: 4, damage: 6, health: 3}];
state.opponentCardsCount = 4;
state.myTurn = true;
state.refresh();

function onMouseDown(event) {
    if (event.item)
        return;
    var circle = new Path.Circle(event.point, 50);
    circle.fillColor = 'red';

    circle.onMouseDown = function(event) {
        if (this.fillColor == 'red')
            this.fillColor = 'black';
        else
            this.fillColor = 'red';
    }
}
