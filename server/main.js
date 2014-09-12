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

var nextCardId = 12;
function randomInt(upper) {
    return Math.floor(Math.random() * upper + 1);
}
function createCard() {
    return {
        id: nextCardId++,
        health: randomInt(9),
        damage: randomInt(9),
        cost: randomInt(9),
        attacksLeft: 1
    };
}

function onNewGame(email1, email2, cb) {
    var hand1 = [];
    var hand2 = [];
    for (var i = 0; i < 4; i++) {
        hand1.push(createCard());
        hand2.push(createCard());
    }
    var state = { players: [email1, email2], turn: email1}
    state[base64_encode(email1)] = {hand: hand1, health: 31, mana: 1, maxMana: 1};
    state[base64_encode(email2)] = {hand: hand2, health: 31, mana: 1, maxMana: 1};
    db.collection('games').insert(state, { w: 1}, cb);
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
            opponentCards.push(createCard());
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

app.get('/matchmaking', function(req, res) {
    var token = req.query.token;
    var bot = req.query.bot;
    //FIXME:
    if (!token) {
        res.status(400).end();
        return;
    }
    var email = common.decrypt(token);
    if (bot) {
        bot = common.decrypt(bot);
        if (bot.indexOf('BOT:') == 0)
            bot = true;
        else
            bot = false;
    }

    var matchmaking = db.collection('matchmaking');
    matchmaking.findOne({ $or: [{ _id: email}, { opponent: email }]}, function (err, doc) {
        if (err) {
            res.status(400).end();
            return;
        }
        if (!doc) {
            matchmaking.findAndModify({ opponent: { $exists: false } }, {$set: {opponent: email}}, {}, function (err, doc) {
                if (!doc) {
                    matchmaking.insert({ _id: email }, { w: 0 });
                    res.send('{}');
                    return;
                }
                onNewGame(doc._id, email, function(err, obj) {
                    if (err) {
                        res.status(400).end();
                        return;
                    }
                    doc.gameid = obj[0]._id;
                    doc.opponent = email;
                    //FIXME: check write result
                    matchmaking.save(doc, {w:0});
                    res.send(JSON.stringify({ gameid: obj[0]._id }));
                    return;
                });
            });
            return;
        }
        if (doc.gameid) {
            res.send(JSON.stringify({ gameid: doc.gameid }));
            return;
        }
        res.send(JSON.stringify({}));
    });
});

app.get('/v1/authorize/:gtoken/:email', account.authorize);

mongo.connect(common.config.mongo, function(err, _db) {
    if(err) throw err;

    db = _db;
    var server = app.listen(common.config.server_port, function() {
        console.log('Listening on port %d', server.address().port);
    });
});
