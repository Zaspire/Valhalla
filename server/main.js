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

var app = express();

var MIN_CLIENT_VERSION = 2;

app.use(cors());
app.disable('x-powered-by');

var accessLogStream = fs.createWriteStream(__dirname + '/access.log', {flags: 'a'})
app.use(morgan('dev', {stream: accessLogStream}));

app.get('/ok', function(req, res){
    res.send('ok');
});

app.param('token', function(req, res, next, id) {
    req.email = common.decrypt(req.params.token);
    next();
});

app.param('gameid', function(req, res, next, id) {
    req.gameid = req.params.gameid;
    next();
});

app.use(function (req, res, next) {
    if (Number(req.headers['valhalla-client']) >= MIN_CLIENT_VERSION) {
        next();
        return;
    }
    res.status(412).end();
})

app.get('/v1/matchmaking/:token', require('./matchmaking').matchmaking);
app.get('/v1/game_action/:token/:gameid/:action/', require('./game_state').gameAction);
app.get('/v1/game_state/:token/:gameid', require('./game_state').gameState);

app.get('/v1/authorize/:gtoken/:email', account.authorize);
app.get('/v1/info/:token', account.getAccountInfo);
app.get('/v1/my_cards/:token', account.myCards);
app.get('/v1/my_cards/:token/set', account.setDeck);

mongo.connect(common.config.mongo, function(err, db) {
    if(err) throw err;

    var server = app.listen(common.config.server_port, function() {
        console.log('Listening on port %d', server.address().port);
    });
});
