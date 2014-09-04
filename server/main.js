var env = process.env.NODE_ENV || 'development';

var assert = require('assert');
var express = require('express');
var cors = require('cors');
var XMLHttpRequest = require('xhr2');
var config = require('./config.' + env + '.json');
var mongodb = require('mongodb');
var mongo = require('mongodb').MongoClient;
var crypto = require('crypto');

var db;
var app = express();
app.use(cors());

function crypt(str) {
    var cipher = crypto.createCipher('aes-256-cbc', config.aes_key);
    cipher.setAutoPadding(true);

    var t = [];
    t.push(cipher.update(str, 'utf-8', 'hex'));
    t.push(cipher.final('hex'));
    return t.join('');
}

console.log(crypt('ermilov.maxim@gmail.com'));
console.log(crypt('example@gmail.com'));

function decrypt(str) {
    // FIXME: verify data
    var decipher = crypto.createDecipher('aes-256-cbc', config.aes_key);
    var t = [];
    t.push(decipher.update(str, 'hex', 'utf-8'));
    t.push(decipher.final('utf-8'));
    return t.join('');
}

function xhrWithAuth(method, url, access_token, callback) {
    function requestStart() {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);
        xhr.onload = requestComplete;
        xhr.send();
    }

    function requestComplete() {
        callback(this.status, this.response);
    }

    requestStart();
}

function getUserInfo(token, callback) {
    xhrWithAuth('GET',
                'https://www.googleapis.com/plus/v1/people/me',
                token,
                callback);
}

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

function onNewGame(email1, email2, cb) {
    var defaultCards = [{damage: 1, health: 10, id: 1}, {damage: 6, health: 3, id: 2}];
    var state = { players: [email1, email2], turn: email1}
    state[base64_encode(email1)] = defaultCards; //FIXME: generate ids
    state[base64_encode(email2)] = defaultCards; //FIXME: generate ids
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
    var email = decrypt(token);
    db.collection('games').findOne({ _id: new mongodb.ObjectID(gameid) }, function(err, doc) {
        if (err || !doc || doc.turn != email) {
            res.status(400).end();
            return;
        }
        assert(doc.players.indexOf(email) != -1);
        var opponentEmail = clone(doc.players);
        opponentEmail.splice(opponentEmail.indexOf(email), 1);
        opponentEmail = opponentEmail[0];

        var myCards = doc[base64_encode(email)];
        var opponentCards = doc[base64_encode(opponentEmail)];
        switch (action) {
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
                if (opponentCards[k].id == id1) {
                    if (!myCards[k].onTable) {
                        res.status(400).end();
                        return;
                    } else {
                        break;
                    }
                }
            }
            if (i >= myCards.length || k >= opponentCards.length) {
                        res.status(400).end();
                        return;
            }
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
            doc.turn = opponentEmail;
            break;
        case 'card':
            for (var i = 0; i < myCards.length; i++) {
                if (myCards[i].id == id1) {
                    if (myCards[i].onTable) {
                        res.status(400).end();
                        return;
                    } else {
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
        //FIXME:
        db.collection('games').save(doc, {w: 0});
        res.send('{}');
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
    var email = decrypt(token);
    db.collection('games').findOne({ _id: new mongodb.ObjectID(gameid) }, function(err, doc) {
        if (err || !doc) {
            res.status(400).end();
            return;
        }
        assert(doc.players.indexOf(email) != -1);

        var opponentEmail = clone(doc.players);
        opponentEmail.splice(opponentEmail.indexOf(email), 1);
        opponentEmail = opponentEmail[0];

        var myCards = doc[base64_encode(email)];
        var opponentCards = doc[base64_encode(opponentEmail)];

        var state = { myTurn: doc.turn == email,
                      opponentCardsCount: opponentCards.filter(function(o) {return !o.onTable}).length,
                      cardsOnTable: [],
                      playerHand: []};
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
    //FIXME:
    if (!token) {
        res.status(400).end();
        return;
    }
    var email = decrypt(token);

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
                    console.log(obj[0]);
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

app.get('/authorize', function(req, res){
    var token = req.query.token;
    var email = req.query.email;
    if (!token || !email) {
        res.status(400).end();
        return;
    }
    getUserInfo(token, function(status, response) {
        response = JSON.parse(response);
        if (status == 200 && response.emails) {
            for (var i = 0; i < response.emails.length; i++) {
                var o = response.emails[0];
                if (o.value == email) {
                    res.send(crypt(email));
                    db.collection('accounts').insert(response, { w: 0 });
                    return;
                }
            }
        }
        res.status(400).end();
    });
});

mongo.connect(config.mongo, function(err, _db) {
    if(err) throw err;

    db = _db;
    var server = app.listen(config.server_port, function() {
        console.log('Listening on port %d', server.address().port);
    });
});
