var assert = require('assert');
var Q = require('q');
var pmongo = require('promised-mongo');

var common = require('./common');

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

        var deck1 = generateDeck(account1);
        var deck2 = generateDeck(account2);
        var hand1 = [];
        var hand2 = [];
        for (var i = 0; i < 4; i++) {
            hand1.push(deck1.shift());
            hand2.push(deck2.shift());
        }

        var state = { players: [email1, email2], turn: email1, actionsCount: 0, log: [] };
        state[common.base64_encode(email1)] = {hand: hand1, deck: deck1, health: 31, mana: 1, maxMana: 1};
        state[common.base64_encode(email2)] = {hand: hand2, deck: deck2, health: 31, mana: 1, maxMana: 1};

        state.initial = common.clone(state);

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
