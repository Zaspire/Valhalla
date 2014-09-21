paper.install(window);

function addCardMagnifier(self, card, type, buttonColor, cb) {
    var transition = "easeOutBounce";
    var time = 1;
    var rx, ry;
    var prevPosition = card.position;
    card.onClick = function(event) {
        if (prevPosition.x != card.position.x || prevPosition.y != card.position.y)
            return;
        rx = card.position.x;
        ry = card.position.y;
        var prevHeight = card.bounds.height;

        card.bringToFront();

        var group = new Group();
        self._all.addChild(group);
        group.opacity = 0;

        var bg = new Path.Rectangle(new Rectangle(new Point(0, 0), new Size(SCREEN_WIDTH, SCREEN_HEIGHT)));
        bg.fillColor="#000000";
        group.addChild(bg);

        var heroName = heroes[type].name;
        var ability = "";
        if (heroes[type].abilities) {
            var z = heroes[type].abilities[0];
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

        card.bringToFront();

        var fg = new Path.Rectangle(new Rectangle(new Point(0, 0), new Size(SCREEN_WIDTH, SCREEN_HEIGHT)));
        fg.fillColor="#ff0000";
        fg.opacity = 0;
//FIXME: add only after complete
        fg.onMouseDown = function() {
            if (button)
                button.remove();
            Tweener.addTween(card.position, { x: rx, y: ry, time: time,
                                              transition: transition,
                                              onComplete: function() {
                fg.remove();
                group.remove();
            } })
            var o = {height: card.bounds.height};
            Tweener.addTween(o, { height: prevHeight, time: time,
                                  transition: transition,
                                  onUpdate: function() {card.matrix.scale(o.height/card.bounds.height)} });
            Tweener.addTween(group, { opacity: 0, time: time, transition: transition });
        }
        self._all.addChild(fg);
        fg.bringToFront();

        if (buttonColor) {
            var button = new Path.Rectangle(new Rectangle(new Point(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 100), new Size(SCREEN_WIDTH / 2, 100)));
            button.fillColor = buttonColor;
            button.strokeColor="#808080";
            button.strokeWidth = 1;
            button.onClick = cb;
            fg.addChild(button);
        }
        var o = {height: prevHeight};
        Tweener.addTween(o, { height: SCREEN_HEIGHT, time: time, transition: transition,
                              onUpdate: function() {card.matrix.scale(o.height/card.bounds.height)} });
        Tweener.addTween(group, { opacity: 1, time: time, transition: transition });
        Tweener.addTween(card.position, { x: 0, y: 0, time: time,
                                          transition: transition });
        card.onFrame = new Function();
    }
}

function createCard(damage, health, cost, highlite, type) {
    var group = new Group();
    var m = new paper.Matrix(0.25, 0, 0, 0.25, 0, 0);
    group.matrix = m;
    group.applyMatrix = false;

    var bg = new Raster('fg');
    bg.pivot = bg.bounds.topLeft;
    bg.position.x = 0;
    bg.position.y = 0;
    group.addChild(bg);
    if (highlite) {
        var border = new Path.Rectangle(new Rectangle(new Point(0, 0), new Size(bg.bounds.width, bg.bounds.height)));
        border.strokeColor = "#00ff00";

        border.strokeWidth = 3;
        group.addChild(border);
        bg.bringToFront();
    }
    if (type && heroes[type].img) {
        var hero = new Raster(type);
        hero.pivot = hero.bounds.topLeft;
        hero.position.x = 0;
        hero.position.y = 0;
        group.addChild(hero);
    }
    if (damage !== undefined) {
        var dTxt = new PointText(new Point(55,485));
        dTxt.content = damage;
        dTxt.characterStyle= {
            font:"Courier",
            fontSize:80,
            fillColor:"#000000"
        }
        dTxt.paragraphStyle = {
            justification:"left"
        };
        group.addChild(dTxt);
    }
    if (health !== undefined) {
        var hTxt = new PointText(new Point(290,486));
        hTxt.content = health;
        hTxt.characterStyle= {
            font:"Courier",
            fontSize:80,
            fillColor:"#000000"
        }
        hTxt.paragraphStyle = {
            justification:"left"
        };
        group.addChild(hTxt);
    }
    if (cost !== undefined) {
        var cTxt = new PointText(new Point(33,84));
        cTxt.content = cost;
        cTxt.characterStyle= {
            font:"Courier",
            fontSize:80,
            fillColor:"#000000"
        }
        cTxt.paragraphStyle = {
            justification:"left"
        };
        group.addChild(cTxt);
    }
    return group;
}
