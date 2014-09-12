var assert = require('assert');
var Q = require('q');
var XMLHttpRequest = require('xhr2');
var pmongo = require('promised-mongo');

var common = require('./common');

var pdb = pmongo(common.config.mongo);

var nextCardId = 12;

function xhrWithAuth(method, url, access_token) {
    var deferred = Q.defer();
    function requestComplete() {
        if (this.status != 200) {
            deferred.reject();
            return;
        }
        try {
            deferred.resolve(JSON.parse(this.response));
        } catch (e) {
            deferred.reject(e);
        }
    }

    var xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);
    xhr.onload = requestComplete;
    xhr.send();
    return deferred.promise;
}

function getUserInfo(token) {
    return xhrWithAuth('GET', 'https://www.googleapis.com/plus/v1/people/me',
                       token);
}

function randomInt(upper) {
    return Math.floor(Math.random() * upper + 1);
}
function createCard() {
    return {
        id: nextCardId++,
        health: randomInt(9),
        damage: randomInt(9),
        cost: randomInt(9)
    };
}

function starterCards() {
    var res = [];
    for (var i = 0; i < 31; i++) {
        var card = createCard();
        delete card.id;
        res.push(card);
    }
    return res;
}

exports.authorize = function(req, res) {
    var token = req.params.gtoken;
    var email = req.params.email;
    var info;

    getUserInfo(token).then(function(response) {
        info = response;
        for (var i = 0; i < response.emails.length; i++) {
            var o = response.emails[i];
            if (o.value == email) {
                return pdb.collection('accounts').findOne({ _id: email });
            }
        }
        throw new Error("email is not presented");
    }).then(function(doc) {
        if (!doc) {
            return pdb.collection('cards').insert(starterCards()).then(function(cards) {
                doc = { _id: email, info: info, win: 0, loss: 0,
                        cards: cards, deck: cards.slice(-30) };
                return pdb.collection('accounts').save(doc);
            });
        }
        return pdb.collection('accounts').findAndModify({ query: { _id: email },
                                                          update: { $set: { info: info } } });
    }).done(function () {
        res.send(common.crypt(email));
    }, function(e) {
        console.log(e);
        res.status(400).end();
    });
}
