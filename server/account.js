var assert = require('assert');
var Q = require('q');
var XMLHttpRequest = require('xhr2');
var pmongo = require('promised-mongo');

var common = require('./common');
var heroes = require('./heroes');

var pdb = pmongo(common.config.mongo);

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

function starterCards() {
    var type2count = {
        'h1': 1,
        'h2': 1,
        'h3': 1,
        'h4': 1,
        'h5': 1,
        'h6': 1,
        'h7': 1,
        'h8': 1,
        'h9': 1,
        'h10': 1,
        'h11': 1,
        'h12': 1,
        'h13': 1,
        'h14': 1,
        'h15': 1,
        'h16': 1,
        'h17': 1,
        'h18': 1,
        'h19': 1,
        'h20': 1,
        'h21': 1,
        'chainArmor': 0,
        'ultimate': 5
        'creep1': 5
    };
    var res = [];
    for (var id in type2count) {
        assert(id in heroes.heroes);
        var type = heroes.heroes[id];
        var card = {type: id, damage: type.damage, cost: type.cost, health: type.health };
        for (var i = 0; i <type2count[id]; i++)
            res.push(common.clone(card));
    }
    return res;
}

exports.addBotAccount = function(name, id) {
    pdb.collection('cards').insert(starterCards()).then(function(cards) {
        var cards = cards.map(function (o) {o.id = String(o._id); delete o._id; return o;});
        var deck = cards.slice(-common.DECK_SIZE).map(function(o) {return o.id});
        doc = { _id: id, info: null, win: 0, loss: 0,
                cards: cards, deck: deck };
        return pdb.collection('accounts').save(doc);
    }).done(function() {}, function (e) {
        console.log(e);
    });
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
                var cards = cards.map(function (o) {o.id = String(o._id); delete o._id; return o;});
                var deck = cards.slice(-common.DECK_SIZE).map(function(o) {return o.id});
                doc = { _id: email, info: info, win: 0, loss: 0,
                        cards: cards, deck: deck };
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

exports.myCards = function(req, res) {
    var email = req.email;
    pdb.collection('accounts').findOne({ _id: email }).done(function(doc) {
        if (!doc) {
            res.status(400).end();
            return;
        }
        for (var i = 0; i < doc.cards.length; i++) {
            if (doc.deck.indexOf(doc.cards[i].id) != -1)
                doc.cards[i].selected = true;
        }
        res.send(JSON.stringify(doc.cards));
    }, function(e) {
        console.log(e);
        res.status(400).end();
    });
}

exports.setDeck = function(req, res) {
    var email = req.email;
    var deck = req.query.deck;

    if (!Array.isArray(deck) && deck.length != common.DECK_SIZE) {
        res.status(400).end();
    }

    pdb.collection('accounts').findOne({ _id: email }).then(function(doc) {
        if (!doc)
            throw new Error('account does not exist');

        var cards = doc.cards.filter(function(e) {
            return deck.indexOf(e.id) != -1;
        });
        if (cards.length != common.DECK_SIZE)
            throw new Error('invalid deck');

        return pdb.collection('accounts').findAndModify({ query: { _id: email },
                                                          update: { $set: { deck: deck } } });

    }).done(function() {
        res.send('{}');
    }, function(e) {
        console.log(e);
        res.status(400).end();
    });
}
