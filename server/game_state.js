"use strict";
const assert = require('assert');
const _ = require('underscore');

const mongodb = require('mongodb');
const pmongo = require('promised-mongo');

const common = require('./common');
const pdb = pmongo(common.config.mongo);
const request = require('request');

const heroes = require('./heroes').heroes;
const Accounts = require('./account');
const GameStateController = require('../ai/game_model').GameStateController;
const Owner = require('../ai/game_model').Owner;
const CardState = require('../ai/game_model').CardState;
const GameState = require('../ai/game_model').GameState;
const StateModelCommon = require('../ai/game_model').StateModelCommon;
const SillyRandom = require('../client/www/random.js');

const ATTACK_PLAYER = 'attack_player';
const END_TURN = 'finish';
const DRAW_CARD = 'draw_card';
const PLAY_CARD = 'card';
const ATTACK = 'attack';
const PLAY_SPELL = 'spell';
const CONCEDE = 'concede';

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

exports.newGame = function(account1, account2) {
    function createCard(doc) {
        let o = common.clone(heroes[doc.type]);

        o.id = doc.id;
        o.type = doc.type;

        o.maxHealth = o.health;
        o.cardType = heroes[o.type].cardType;
        o.visualState = '';
        if (heroes[o.type].onDeath)
            o.onDeath = { cast: String(heroes[o.type].onDeath.cast) };
        if (heroes[o.type].dealDamage)
            o.dealDamage = { cast: String(heroes[o.type].dealDamage.cast) };
        if (heroes[o.type].onNewTurn)
            o.onNewTurn = { cast: String(heroes[o.type].onNewTurn.cast) };
        if (heroes[o.type].onTurnEnd)
            o.onTurnEnd = { cast: String(heroes[o.type].onTurnEnd.cast) };
        if (heroes[o.type].canAttackCard)
            o.canAttackCard = { cast: String(heroes[o.type].canAttackCard.cast) };
        if (heroes[o.type].attack)
            o.attack = String(heroes[o.type].attack);
        if (heroes[o.type].onPlay)
            o.onPlay = { cast: String(heroes[o.type].onPlay.cast) };
        if (heroes[o.type].canBeAttacked)
            o.canBeAttacked = { cast: String(heroes[o.type].canBeAttacked.cast) };
        o.state = CardState.DECK;

        return o;
    }
    let email1 = account1._id;
    let email2 = account2._id;
    function getNameFromAccount(account) {
        if (!account.info)
            return 'Claire'; //FIXME: Bot
        if (account.info.nickname)
            return account.info.nickname;
        if (account.info.name && account.info.name.givenName)
            return account.info.name.givenName;
        if (account.info.displayName)
            return account.info.displayName;
        return '_';
    }
    let deck1 = generateDeck(account1).map(createCard);
    let deck2 = generateDeck(account2).map(createCard);
    let hand1 = [];
    let hand2 = [];
    for (let i = 0; i < 4; i++) {
        let card = deck1.shift();
        card.state = CardState.HAND;
        hand1.push(card);

        card = deck2.shift();
        card.state = CardState.HAND;
        hand2.push(card);
    }

    let state = { players: [email1, email2],
                  data: { nextId: Math.floor(Math.random() * 1000000 + 1),
                          seed: Math.floor(Math.random() * 1000000000 + 1) },
                  turn: email1,
                  actionsCount: 0,
                  timestamp: new Date(),
                  log: [] };
    state[common.base64_encode(email1)] = {hand: hand1, deck: deck1,
                                           name: getNameFromAccount(account1),
                                           health: 31, mana: 1, maxMana: 1};
    state[common.base64_encode(email2)] = {hand: hand2, deck: deck2,
                                           name: getNameFromAccount(account2),
                                           health: 31, mana: 1, maxMana: 1};

    state.initial = common.clone(state);

    return state;
}

function StateModel(doc, email) {
    StateModelCommon.call(this);

    this._id = doc._id;
    this._log = doc.log;
    this.timestamp = doc.timestamp;

    this.email = email;
    this.server = true;

    this.data = common.clone(doc.data);
    this.random = SillyRandom.createRandomGenerator(this.data.seed);

    this.opponentEmail = common.clone(doc.players);
    this.opponentEmail.splice(this.opponentEmail.indexOf(email), 1);
    this.opponentEmail = this.opponentEmail[0];

    let me = doc[common.base64_encode(email)];
    let opponent = doc[common.base64_encode(this.opponentEmail)];

    this.turn = (doc.turn == email) ? Owner.ME: Owner.OPPONENT;

    this.me = {
        mana: me.mana,
        maxMana: me.maxMana,
        health: me.health,
        owner: Owner.ME
    };

    this.opponent = {
        mana: opponent.mana,
        maxMana: opponent.maxMana,
        health: opponent.health,
        owner: Owner.OPPONENT
    };

    this.players = [this.me, this.opponent];

    this._cards = [];

    for (let i = 0; i < me.hand.length; i++) {
        let card = me.hand[i];
        let c = this._createCard(card, Owner.ME, card.state);
        this._cards.push(c);
    }
    for (let i = 0; i < me.deck.length; i++) {
        let card = me.deck[i];
        let c = this._createCard(card, Owner.ME, CardState.DECK);
        this._cards.push(c);
    }

    for (let i = 0; i < opponent.deck.length; i++) {
        let card = opponent.deck[i];
        let c = this._createCard(card, Owner.OPPONENT, CardState.DECK);
        this._cards.push(c);
    }
    for (let i = 0; i < opponent.hand.length; i++) {
        let card = opponent.hand[i];
        let c = this._createCard(card, Owner.OPPONENT, card.state);
        this._cards.push(c);
    }
}

StateModel.prototype = {
    __proto__: StateModelCommon.prototype,

    _createCard: function(card, owner, state) {
        let o = common.clone(card);

        o.emit = function() {}
        assert(o.state === state);
        o.owner = owner;
        return o;
    },
    setMyController: function(controller) {
        this._myController = controller;
    },
    setOpponentController: function(controller) {
        this._opponentController = controller;
    },
    getController: function(owner) {
        if (owner == this._myController.owner)
            return this._myController;
        if (owner == this._opponentController.owner)
            return this._opponentController;
        assert(false);
    },
    createCard: function(o) {
        o.id = String(o.id);
        if (!o.visualState)
            o.visualState = '';
        let card = this._createCard(o, o.owner, o.state);
        this._cards.push(card);
    },

    _serializeCard: function(card) {
        card.emit = undefined;
        return card;
    },

    serialize: function() {
        this.data.seed = this.random.state;
        let doc = {
            _id: this._id,
            turn: this.turn == Owner.ME? this.email: this.opponentEmail,
            players: [ this.email, this.opponentEmail ],
            log: this._log,
            actionsCount: this._log.length,
            data: this.data,
            timestamp: this.timestamp
        };

        let ce1 = common.base64_encode(this.email);
        let ce2 = common.base64_encode(this.opponentEmail);

        doc[ce1] = { health: this.me.health,
                     mana: this.me.mana,
                     maxMana: this.me.maxMana };
        doc[ce1].deck = this._cards.filter(function(c) {
            return c.state == CardState.DECK && c.owner == Owner.ME;
        }).map(this._serializeCard);
        doc[ce1].hand = this._cards.filter(function(c) {
            return c.state != CardState.DECK && c.owner == Owner.ME;
        }).map(this._serializeCard);

        doc[ce2] = { health: this.opponent.health,
                     mana:this.opponent.mana,
                     maxMana: this.opponent.maxMana };
        doc[ce2].deck = this._cards.filter(function(c) {
            return c.state == CardState.DECK && c.owner == Owner.OPPONENT;
        }).map(this._serializeCard);
        doc[ce2].hand = this._cards.filter(function(c) {
            return c.state != CardState.DECK && c.owner == Owner.OPPONENT;
        }).map(this._serializeCard);

        return doc;
    }
};

GameStateController.prototype._log = function(action, p1, p2) {
    let email = this.model.email;
    if (action == DRAW_CARD) {
        if (p2 != Owner.ME)
            email = this.model.opponentEmail
    }
    this.model._log.push({ email: email, action: action, params: [ p1, p2 ] });
}

exports.gameAction = function(req, res) {
    let email = req.email;
    let gameid = req.gameid;
    let action = req.params.action;
    let id1 = req.query.id1;
    let id2 = req.query.id2;

    let model;
    pdb.collection('games').findOne({ _id: new mongodb.ObjectID(gameid) }).then(function (doc) {
        if (!doc)
            throw new Error('incorrect gameid');

        model = new StateModel(doc, email);
        let controller = new GameStateController(model, Owner.ME);
        let opponentController = new GameStateController(model, Owner.OPPONENT);

        model.setMyController(controller);
        model.setOpponentController(opponentController);
        model.emit('ready');

        if (controller.isFinished())
            throw new Error('game finshed');

        switch (action) {
        case ATTACK_PLAYER:
            controller.attackPlayer(id1);
            break;
        case END_TURN:
            controller.endTurn();
            model.timestamp = new Date();
            break;
        case PLAY_CARD:
            controller.playCard(id1);
            break;
        case PLAY_SPELL:
            controller.playSpell(id1, id2);
            break;
        case ATTACK:
            controller.attack(id1, id2);
            break;
        case CONCEDE:
            assert(doc.actionsCount == id1);
            controller.concede();
            break;
        default:
            throw new Error('unknown action');
        };

        let r = model.serialize();
        r.initial = doc.initial;
        delete r._id;
        if (controller.isFinished())
            r.finished = true;
        return pdb.collection('games').findAndModifyEx({ query: { _id: doc._id, actionsCount: doc.actionsCount },
                                                         update: { $set: r }});
    }).done(function() {
        res.send('{}');
        if (model.me.health <= 0 || model.opponent.health <= 0) {
            let loser, winer;
            if (model.me.health > 0) {
                loser = model.opponentEmail;
                winer = email;
            } else {
                winer = model.opponentEmail;
                loser = email;
            }

            Accounts.addLoss(loser).then(function() {
                return Accounts.addWin(winer);
            }).done(function() {}, function (e) {
                console.log(e);
            });
        }
    }, function(e) {
        console.log(e);
        console.log(e.stack);
        res.status(400).end();
    });
};

exports.gameState = function(req, res) {
    let email = req.email;
    let gameid = req.gameid;

    pdb.collection('games').findOne({ _id: new mongodb.ObjectID(gameid) }).then(function (doc) {
        if (!doc)
            throw new Error('incorrect gameid');

        assert(doc.players.indexOf(email) != -1);

        let opponentEmail = common.clone(doc.players);
        opponentEmail.splice(opponentEmail.indexOf(email), 1);
        opponentEmail = opponentEmail[0];

        if (doc[common.base64_encode(opponentEmail)].health <= 0 || doc[common.base64_encode(email)].health <= 0) {
            pdb.collection('matchmaking').remove({ gameid: new mongodb.ObjectID(gameid) }).done(function() {}, function(e) {
                console.log(e);
            });
        }

        let opponentState = doc.initial[common.base64_encode(opponentEmail)];
        let myState = doc.initial[common.base64_encode(email)];

        let log = doc.log.map(function (e) {
            let r = { action: e.action, params: e.params};
            if (e.email == email)
                r.me = true;
            if (r.action === END_TURN && e.params[1]) {
                if (r.me)
                    r.params = [null, null];
                else
                    r.params = [null, { id: e.params[1].id, type: e.params[1].type }];
            }
            if (r.action === DRAW_CARD && e.params[0]) {
                if (!r.me)
                    r.params = [null, null];
                else
                    r.params = [{ id: e.params[0].id, type: e.params[0].type }];
            }
            return r;
        });

        let result = { log: log,
                       initial: {
                           turn: doc.initial.turn == email,
                           data: doc.initial.data,
                           my: {
                               hand: myState.hand.map(function(card) {
                                   return { type: card.type, id: card.id };
                               }),
                               deckSize: myState.deck.length,
                               health: myState.health,
                               mana: myState.mana,
                               maxMana: myState.maxMana,
                               name: myState.name
                           },
                           opponent: {
                               handSize: opponentState.hand.length,
                               deckSize: opponentState.deck.length,
                               health: opponentState.health,
                               mana: opponentState.mana,
                               maxMana: opponentState.maxMana,
                               name: opponentState.name
                           }
                       }};
        return result;
    }).done(function(result) {
        res.send(JSON.stringify(result));
    }, function(e) {
        console.log(e);
        res.status(400).end();
    });
}

setInterval(function repeat() {
    pdb.collection('games').findOne({ timestamp: { $lt: new Date(new Date() - 120 * 1000) }, finished: { $exists: false } }).then(function(doc) {
        if (!doc)
            return;
        console.log(doc._id);

        let url = 'http://localhost:' + common.config.server_port
            + '/v1/game_action/' + common.crypt(doc.turn) + '/' + doc._id + '/concede/?id1=' + doc.actionsCount;
        console.log(url);

        request({ url: url, headers: {"valhalla-client": 3}}, function (error, response, body) {
            repeat();
        });
    });
}, 120 * 1000);
