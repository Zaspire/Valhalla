var params = {};
params.token = localStorage.getItem('token');

var SCREEN_WIDTH = 1280;
var SCREEN_HEIGHT = 768;

function createCard(damage, health, cost, highlite) {
    var group = new Group();

    var bg = new Raster('fg');
    bg.pivot = bg.bounds.topLeft;
    bg.position.x = 0;
    bg.position.y = 0;
    bg.scaling = [0.25, 0.25];
    group.addChild(bg);
    if (highlite) {
        var border = new Path.Rectangle(new Rectangle(new Point(0, 0), new Size(bg.bounds.width, bg.bounds.height)));
        border.strokeColor = "#00ff00";

        border.strokeWidth = 3;
        group.addChild(border);
        bg.bringToFront();
    }
    if (damage% 2) {
        var hero = new Raster('h1');
        hero.pivot = hero.bounds.topLeft;
        hero.position.x = 0;
        hero.position.y = 0;
        hero.scaling = [0.25, 0.25];
        group.addChild(hero);
    } else {
        var hero = new Raster('h2');
        hero.pivot = hero.bounds.topLeft;
        hero.position.x = 0;
        hero.position.y = 0;
        hero.scaling = [0.25, 0.25];
        group.addChild(hero);
    }
    if (damage !== undefined) {
        var dTxt = new PointText(new Point(15,120));
        dTxt.content = damage;
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
        var hTxt = new PointText(new Point(70,120));
        hTxt.content = health;
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
    if (cost !== undefined) {
        var cTxt = new PointText(new Point(10,20));
        cTxt.content = cost;
        cTxt.characterStyle= {
            font:"Courier",
            fontSize:14,
            fillColor:"#000000"
        }
        cTxt.paragraphStyle = {
            justification:"left"
        };
        group.addChild(cTxt);
    }
    return group;
}

function draw(cards) {
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
        var g = createCard(card.damage, card.health, card.cost, card.selected);

        if (card.selected)
            selected++;
        g.pivot = g.bounds.topLeft;
        g.position.x = x;
        g.position.y = y;
        g.onMouseDown = createCb(i);
        x += g.bounds.width + 20;
        if (i % 10 == 9) {
            y += g.bounds.height + 20;
            x = 20
        }
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
    }
    this._all.scale(view.bounds.width / SCREEN_WIDTH, view.bounds.height / SCREEN_HEIGHT);
    paper.view.draw();
}

function save(cards) {
    var deck = cards.filter(function(o){return o.selected;}).map(function(o) {return o.id;});

    $.ajax({ url: host + 'v1/my_cards/' + params.token + '/set', data: { deck: deck } }).done(function(data) {
        console.log(data);
        getCards();
    }).fail(function() {
        //FIXME:
    });
}

function getCards() {

    $.ajax({ url: host + 'v1/my_cards/' + params.token }).done(function(data) {
        console.log(data);
        draw(JSON.parse(data));
    }).fail(function() {
        //FIXME:
    });
}

getCards();
