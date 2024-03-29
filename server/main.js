const assert = require('assert');
const Q = require('q');

const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const mongodb = require('mongodb');
const mongo = require('mongodb').MongoClient;

const account = require('./account');
const common = require('./common');

var app = express();

const MIN_CLIENT_VERSION = 3;

app.use(cors());
app.disable('x-powered-by');

//var accessLogStream = fs.createWriteStream(__dirname + '/access.log', {flags: 'a'})
//app.use(morgan('dev', {stream: accessLogStream}));

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
app.get('/v1/buy/:token', account.buyCards);
app.get('/v1/my_cards/:token', account.myCards);
app.get('/v1/my_cards/:token/set', account.setDeck);

var server;

mongo.connect(common.config.mongo, function(err, db) {
    if(err) throw err;

    server = app.listen(common.config.server_port, function() {
        console.log('Listening on port %d', server.address().port);
    });
});
