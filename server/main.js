var env = process.env.NODE_ENV || 'development';

var express = require('express');
var app = express();
var XMLHttpRequest = require('xhr2');
var config = require('./config.' + env + '.json');
var mongo = require('mongodb').MongoClient;
var crypto = require('crypto');

var db;

function crypt(str) {
    var cipher = crypto.createCipher('aes-256-cbc', config.aes_key);
    cipher.setAutoPadding(true);

    var t = [];
    t.push(cipher.update(str, 'utf-8', 'hex'));
    t.push(cipher.final('hex'));
    return t.join('');
}

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
                db.collection('games').insert({}, { w: 1}, function(err, obj) {
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
                })
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
