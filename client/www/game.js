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
                //FIXME:
                $.ajax({ url: host + 'game_action', data: { token: params.token, gameid: params.gameid, action: 'card', id1: id} }).done(function(data) {
                    console.log(data);
                    updateState();
                });
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

        //FIXME:
        $.ajax({ url: host + 'game_action', data: { token: params.token, gameid: params.gameid, action: 'attack', id1: source.id, id2: dest.id} }).done(function(data) {
            console.log(data);
            updateState();
        });
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
if (this.myTurn) {
                card.onMouseDown = createCb2(desc.id);
                card.onMouseDrag = createCb3(desc.id);
                card.onMouseUp = createCb4(desc.id);
}
            } else {
                card.pivot = card.bounds.bottomLeft;
                card.position.x = x2;
                x2 += card.bounds.width + 20;
                dy = -20;
            }

            card.position.y = SCREEN_HEIGHT / 2 + dy;
        }
        this._x1 = x1;

        if (this.myTurn) {
            var border = new Path.Rectangle(new Rectangle(new Point(500, 10), new Size(75, 50)));
            border.fillColor="green";
            border.strokeColor="#808080";
            border.strokeWidth = 1;
            var dTxt = new PointText(new Point(510,30));
            dTxt.content = 'End Turn';
            dTxt.characterStyle= {
                font:"Courier",
                fontSize:16,
                fillColor:"#000000"
            }
            dTxt.paragraphStyle = {
                justification:"left"
            };
            border.onMouseUp = function(event) {
                //FIXME:
                $.ajax({ url: host + 'game_action', data: { token: params.token, gameid: params.gameid, action: 'finish'} }).done(function(data) {
                    console.log(data);
                    updateState();
                });
            }
            this._all.addChild(dTxt);
            this._all.addChild(border);
            dTxt.bringToFront();
        }
        this._all.scale(view.bounds.width / SCREEN_WIDTH, view.bounds.height / SCREEN_HEIGHT);
    }
};

var host = 'http://192.168.1.10:3000/';
var params = {};
location.search.substr(1).split("&").forEach(function(item) {params[item.split("=")[0]] = item.split("=")[1]});

var state;

function updateState() {
    $.ajax({ url: host + 'game_state', data: { token: params.token, gameid: params.gameid} }).done(function(data) {
        console.log(data);
        data = JSON.parse(data);
        state = new State();
        state.playerHand = data.playerHand;
        state.cardsOnTable = data.cardsOnTable;
        state.opponentCardsCount = data.opponentCardsCount;
        state.myTurn = data.myTurn;
        state.refresh();
        if (!state.myTurn) {
            //FIXME:
            setTimeout(updateState, 1000);
        }
    }).fail(function() {
        //FIXME:
    });
}
updateState();