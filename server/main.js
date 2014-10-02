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

        var opponentEmail = common.clone(doc.players);
        opponentEmail.splice(opponentEmail.indexOf(email), 1);
        opponentEmail = opponentEmail[0];

        var s = "WIP";
        if (doc[common.base64_encode(opponentEmail)].health <= 0)
            s = "WIN";
        if (doc[common.base64_encode(email)].health <= 0)
            s = "LOSE";
        if (s != "WIP") {
            db.collection('matchmaking').remove({ gameid: new mongodb.ObjectID(gameid) }, { w: 0 });
        }
        var myCards = doc[common.base64_encode(email)].hand;
        var opponentCards = doc[common.base64_encode(opponentEmail)].hand;

        var state = { myTurn: doc.turn == email,
                      state: s,
                      mana: doc[common.base64_encode(email)].mana,
                      opponentCardsCount: opponentCards.filter(function(o) {return !o.onTable}).length,
                      cardsOnTable: [],
                      playerHand: [],
                      health: doc[common.base64_encode(email)].health,
                      opponentHealth: doc[common.base64_encode(opponentEmail)].health };
        state.playerHand = myCards.filter(function(o) {
            return !o.onTable;
        }).map(function(o) {
            var r = common.clone(o);
            r.mine = true;
            return r;
        });
        state.cardsOnTable = state.cardsOnTable.concat(myCards.filter(function(o) {
            return o.onTable;
        }).map(function(o) {
            var r = common.clone(o);
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

app.param('gameid', function(req, res, next, id) {
    req.gameid = req.params.gameid;
    next();
});

app.get('/v1/matchmaking/:token', require('./matchmaking').matchmaking);
app.get('/v1/game_action/:token/:gameid/:action/', require('./game_state').gameAction);

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
