paper.install(window);

var params = {};
params.token = localStorage.getItem('token');

function draw(cards) {
    project.clear();

    this._all = new Group();
    this._all.pivot = this._all.bounds.topLeft;
    this._all.position.x = 0;
    this._all.position.y = 0;

    var bg = new Path.Rectangle(new Rectangle(new Point(0, 0), new Size(SCREEN_WIDTH -4 , SCREEN_HEIGHT -4)));
    bg.fillColor="#ffffff";
    bg.strokeColor="#808080";
    bg.strokeWidth = 1;
    this._all.addChild(bg);

    var x = 20;
    var y = 20;

    function createCb(i) {
        return function(event) {
            cards[i].selected = !cards[i].selected;
            draw(cards);
        };
    }
    var selected = 0;
    for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var g = createCard(card.damage, card.health, card.cost, card.selected, card.type);

        if (card.selected)
            selected++;
        g.pivot = g.bounds.topLeft;
        g.position.x = x;
        g.position.y = y;
//        g.onMouseDown = createCb(i);
        x += g.bounds.width + 20;
        if (i % 10 == 9) {
            y += g.bounds.height + 20;
            x = 20
        }

        addCardMagnifier(this, g, card.type, card.selected?"red":"green", createCb(i));
        this._all.addChild(g);
    }
    if (selected == 30) {
        var button = new Path.Rectangle(new Rectangle(new Point(x, y), new Size(100, 100)));
        button.fillColor="#00ff00";
        button.strokeColor="#808080";
        button.strokeWidth = 1;
        button.onMouseDown = function() {
            save(cards);
        };
        this._all.addChild(button);
    } else {
        var txt = new PointText(new Point(x,y + 50));
        txt.content = selected + '/30';
        txt.characterStyle= {
            font:"Courier",
            fontSize:50,
            fillColor:"#000000"
        }
        txt.paragraphStyle = {
            justification:"left"
        };
        this._all.addChild(txt);
    }
    this._all.scale(view.bounds.width / SCREEN_WIDTH, view.bounds.height / SCREEN_HEIGHT);
    paper.view.draw();
}

function save(cards) {
    var deck = cards.filter(function(o){return o.selected;}).map(function(o) {return o.id;});

    _network.ajax(host + 'v1/my_cards/' + params.token + '/set', { deck: deck }, function(data) {
        console.log(data);
        getCards();
    });
}

function getCards() {

    _network.ajax(host + 'v1/my_cards/' + params.token, undefined, function(data) {
        console.log(data);
        draw(JSON.parse(data));
    });
}

window.addEventListener("load", function() {
    var canvas = document.getElementById('myCanvas');
    paper.setup(canvas);
    paper.settings.applyMatrix = false;

    getCards();
});
