"use strict";
const assert = require('assert');
const Q = require('q');
const pmongo = require('promised-mongo');

const common = require('./common');
const game_state = require('./game_state');

const pdb = pmongo(common.config.mongo);

function generateDeck(account) {
    let deck = [];
    for (let i = 0; i < account.deck.length; i++) {
        let card = account.cards.filter(function(o) {
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
    let accounts = pdb.collection('accounts');
    let account1;
    return accounts.findOne({ _id: email1 }).then(function (doc) {
        account1 = doc;
        return accounts.findOne({ _id: email2 });
    }).then(function (doc) {
        let account2 = doc;

        let state = game_state.newGame(account1, account2);

        return pdb.collection('games').insert(state);
    });
}

exports.matchmaking = function(req, res) {
    let bot = req.query.bot;
    let email = req.email;
    if (bot) {
        bot = common.decrypt(bot);
        if (bot.indexOf('BOT:') == 0)
            bot = true;
        else
            bot = false;
    }

    let matchmaking = pdb.collection('matchmaking');
    matchmaking.findOne({ $or: [{ _id: email}, { opponent: email }]}).then(function (doc) {
        if (doc) {
            return { gameid: doc.gameid };
        }
        let query = { opponent: { $exists: false } };
        if (bot) {
            query.time = { $lt: new Date(new Date() - 30000) };
        }
        return matchmaking.findAndModifyEx({query: query,
                                            update: {$set: {opponent: email}}}).then(function (doc) {
            assert(doc.result !== undefined);
            doc = doc.result;

            if (!doc) {
                if (bot)
                    return {};
                return matchmaking.insert({ _id: email, time: new Date() });
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
