var assert = require('assert');
var Q = require('q');
var pmongo = require('promised-mongo');

var common = require('./common');

var game_state = require('./game_state');

var pdb = pmongo(common.config.mongo);

function generateDeck(account) {
    var deck = [];
    for (var i = 0; i < account.deck.length; i++) {
        var card = account.cards.filter(function(o) {
            return account.deck[i] == o.id;
        });
        assert(card.length == 1);
        card = card[0];

        deck.push(card);
    }

    assert(deck.length == common.DECK_SIZE);
    return common.shuffle(deck);
}

function onNewGame(email1, email2) {
    var accounts = pdb.collection('accounts');
    var account1;
    return accounts.findOne({ _id: email1 }).then(function (doc) {
        account1 = doc;
        return accounts.findOne({ _id: email2 });
    }).then(function (doc) {
        var account2 = doc;

        var state = game_state.newGame(account1, account2);

        return pdb.collection('games').insert(state);
    });
}

exports.matchmaking = function(req, res) {
    var bot = req.query.bot;
    var email = req.email;
    if (bot) {
        bot = common.decrypt(bot);
        if (bot.indexOf('BOT:') == 0)
            bot = true;
        else
            bot = false;
    }

    var matchmaking = pdb.collection('matchmaking');
    matchmaking.findOne({ $or: [{ _id: email}, { opponent: email }]}).then(function (doc) {
        if (doc) {
            return { gameid: doc.gameid };
        }
        return matchmaking.findAndModifyEx({query: { opponent: { $exists: false } },
                                            update: {$set: {opponent: email}}}).then(function (doc) {
            assert(doc.result !== undefined);
            doc = doc.result;

            if (!doc) {
                return matchmaking.insert({ _id: email });
            }

            return onNewGame(doc._id, email).then(function(obj) {
                doc.gameid = obj._id;
                doc.opponent = email;

                return matchmaking.save(doc);
            });
        });
    }).done(function(d) {
        if (d.gameid)
            res.send(JSON.stringify({ gameid: d.gameid }));
        else
            res.send('{}');
    }, function(e) {
        console.log(e);
        res.status(400).end();
    });
}
