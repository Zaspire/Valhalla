var assert = require('assert');
var Q = require('q');

var fs = require('fs');
var express = require('express');
var cors = require('cors');
var morgan = require('morgan');

var mongodb = require('mongodb');
var mongo = require('mongodb').MongoClient;

var account = require('./account');
var common = require('./common');

var db;
var app = express();
app.use(cors());
app.disable('x-powered-by');
var accessLogStream = fs.createWriteStream(__dirname + '/access.log', {flags: 'a'})
app.use(morgan('dev', {stream: accessLogStream}));

app.get('/ok', function(req, res){
    res.send('ok');
});

function base64_encode(str) {
    var b = new Buffer(str);
    return b.toString('base64');
}

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function randomInt(upper) {
    return Math.floor(Math.random() * upper + 1);
}

app.get('/game_action', function(req, res) {
    var token = req.query.token;
    var gameid = req.query.gameid;
    var action = req.query.action;
    var id1 = req.query.id1;
    var id2 = req.query.id2;

    //FIXME: validate token && gameid
    //FIXME: validate action params
    if (!token || !gameid || !action) {
        res.status(400).end();
        return;
    }
    var email = common.decrypt(token);
    db.collection('games').findOne({ _id: new mongodb.ObjectID(gameid) }, function(err, doc) {
        if (err || !doc || doc.turn != email) {
            res.status(400).end();
            return;
        }

        assert(doc.players.indexOf(email) != -1);
        var opponentEmail = clone(doc.players);
        opponentEmail.splice(opponentEmail.indexOf(email), 1);
        opponentEmail = opponentEmail[0];

        var myHealth = doc[base64_encode(email)].health;
        var opponentHealth = doc[base64_encode(opponentEmail)].health;
        if (myHealth <= 0 || opponentHealth <= 0) {
            res.status(400).end();
            return;
        }

        var myCards = doc[base64_encode(email)].hand;
        var opponentCards = doc[base64_encode(opponentEmail)].hand;
        var opponentDeck = doc[base64_encode(opponentEmail)].deck;
        switch (action) {
        case 'attack_player':
            for (var i = 0; i < myCards.length; i++) {
                if (myCards[i].id == id1) {
                    if (!myCards[i].onTable) {
                        res.status(400).end();
                        return;
                    } else {
                        break;
                    }
                }
            }
            if (i >= myCards.length || myCards[i].attacksLeft <= 0) {
                res.status(400).end();
                return;
            }
            myCards[i].attacksLeft--;
            doc[base64_encode(opponentEmail)].health -= myCards[i].damage;
            break;
        case 'attack':
            for (var i = 0; i < myCards.length; i++) {
                if (myCards[i].id == id1) {
                    if (!myCards[i].onTable) {
                        res.status(400).end();
                        return;
                    } else {
                        break;
                    }
                }
            }
            for (var k = 0; k < opponentCards.length; k++) {
                if (opponentCards[k].id == id2) {
                    if (!opponentCards[k].onTable) {
                        res.status(400).end();
                        return;
                    } else {
                        break;
                    }
                }
            }
            if (i >= myCards.length || k >= opponentCards.length || myCards[i].attacksLeft <= 0) {
                res.status(400).end();
                return;
            }
            myCards[i].attacksLeft--;
            opponentCards[k].health -= myCards[i].damage;
            myCards[i].health -= opponentCards[k].damage;
            if (opponentCards[k].health <= 0) {
                opponentCards.splice(k, 1);
            }
            if (myCards[i].health <= 0) {
                myCards.splice(i, 1);
            }
            break;
        case 'finish':
            var opponent = doc[base64_encode(opponentEmail)];

            doc.turn = opponentEmail;
            opponent.maxMana = Math.min(10, opponent.maxMana + 1);
            opponent.mana = opponent.maxMana;
            for (var i = 0; i < opponentCards.length; i++) {
                opponentCards[i].attacksLeft = 1;
            }
            assert(opponentDeck.length);
            var card = opponentDeck.shift();
            card.attacksLeft = 0;
            opponentCards.push(card);
            break;
        case 'card':
            for (var i = 0; i < myCards.length; i++) {
                if (myCards[i].id == id1) {
                    if (myCards[i].onTable || myCards[i].cost > doc[base64_encode(email)].mana) {
                        res.status(400).end();
                        return;
                    } else {
                        doc[base64_encode(email)].mana -= myCards[i].cost;
                        myCards[i].onTable = true;
                        myCards[i].attacksLeft = 0;
                        break;
                    }
                }
            }
            assert(i < myCards.length);
            break;
        default:
            res.status(400).end();
            return;
        }

        db.collection('games').save(doc, {w: 1}, function () {
            //FIXME: check error
            res.send('{}');
        });
    })
});

app.get('/game_state', function(req, res) {
    var token = req.query.token;
    var gameid = req.query.gameid;
    //FIXME: validate token && gameid
    if (!token || !gameid) {
        res.status(400).end();
        return;
    }
    var email = common.decrypt(token);
    db.collection('games').findOne({ _id: new mongodb.ObjectID(gameid) }, function(err, doc) {
        if (err || !doc) {
            res.status(400).end();
            return;
        }
        assert(doc.players.indexOf(email) != -1);

        var opponentEmail = clone(doc.players);
        opponentEmail.splice(opponentEmail.indexOf(email), 1);
        opponentEmail = opponentEmail[0];

        var s = "WIP";
        if (doc[base64_encode(opponentEmail)].health <= 0)
            s = "WIN";
        if (doc[base64_encode(email)].health <= 0)
            s = "LOSE";
        if (s != "WIP") {
            db.collection('matchmaking').remove({ gameid: new mongodb.ObjectID(gameid) }, { w: 0 });
        }
        var myCards = doc[base64_encode(email)].hand;
        var opponentCards = doc[base64_encode(opponentEmail)].hand;

        var state = { myTurn: doc.turn == email,
                      state: s,
                      mana: doc[base64_encode(email)].mana,
                      opponentCardsCount: opponentCards.filter(function(o) {return !o.onTable}).length,
                      cardsOnTable: [],
                      playerHand: [],
                      health: doc[base64_encode(email)].health,
                      opponentHealth: doc[base64_encode(opponentEmail)].health };
        state.playerHand = myCards.filter(function(o) {
            return !o.onTable;
        }).map(function(o) {
            var r = clone(o);
            r.mine = true;
            return r;
        });
        state.cardsOnTable = state.cardsOnTable.concat(myCards.filter(function(o) {
            return o.onTable;
        }).map(function(o) {
            var r = clone(o);
            r.mine = true;
            return r;
        }), opponentCards.filter(function(o) {
            return o.onTable;
        }));
        res.send(JSON.stringify(state));
    });
});

app.param('token', function(req, res, next, id) {
    req.email = common.decrypt(req.params.token);
    next();
});

app.get('/v1/matchmaking/:token', require('./matchmaking').matchmaking);

app.get('/v1/authorize/:gtoken/:email', account.authorize);
app.get('/v1/my_cards/:token', account.myCards);
app.get('/v1/my_cards/:token/set', account.setDeck);

mongo.connect(common.config.mongo, function(err, _db) {
    if(err) throw err;

    db = _db;
    var server = app.listen(common.config.server_port, function() {
        console.log('Listening on port %d', server.address().port);
    });
});
