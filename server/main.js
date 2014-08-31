var env = process.env.NODE_ENV || 'development';

var express = require('express');
var app = express();
var XMLHttpRequest = require('xhr2');
var config = require('./config.' + env + '.json');
var mongo = require('mongodb').MongoClient;
var crypto = require('crypto');

var db;

function crypt(str) {
    var cipher = crypto.createCipher('aes-128-cbc', config.aes_key);

    cipher.update(str, 'utf8', 'base64');
    return cipher.final('base64');
}

function decrypt(str) {
    // FIXME: verify data
    var decipher = crypto.createDecipher('aes-128-cbc', config.aes_key);
    decipher.update(str, 'base64', 'utf8');
    return decipher.final('utf8');
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
