var assert = require('assert');
var _ = require('underscore');

var mongodb = require('mongodb');
var pmongo = require('promised-mongo');

var common = require('./common');
var pdb = pmongo(common.config.mongo);

var heroes = require('./heroes').heroes;
var Accounts = require('./account');
var GameStateController = require('../ai/game_model').GameStateController;
var Owner = require('../ai/game_model').Owner;
var CardState = require('../ai/game_model').CardState;
var GameState = require('../ai/game_model').GameState;
var StateModelCommon = require('../ai/game_model').StateModelCommon;
var SillyRandom = require('../client/www/random.js');

var ATTACK_PLAYER = 'attack_player';
var END_TURN = 'finish';
var DRAW_CARD = 'draw_card';
var PLAY_CARD = 'card';
var ATTACK = 'attack';
var PLAY_SPELL = 'spell';

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

exports.newGame = function(account1, account2) {
    function createCard(doc) {
        var o = common.clone(heroes[doc.type]);

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
    var email1 = account1._id;
    var email2 = account2._id;
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
    var deck1 = generateDeck(account1).map(createCard);
    var deck2 = generateDeck(account2).map(createCard);
    var hand1 = [];
    var hand2 = [];
    for (var i = 0; i < 4; i++) {
        var card = deck1.shift();
        card.state = CardState.HAND;
        hand1.push(card);

        card = deck2.shift();
        card.state = CardState.HAND;
        hand2.push(card);
    }

    var state = { players: [email1, email2],
                  data: { nextId: Math.floor(Math.random() * 1000000 + 1),
                          seed: Math.floor(Math.random() * 1000000000 + 1) },
                  turn: email1,
                  actionsCount: 0,
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

    this.email = email;
    this.server = true;

    this.data = common.clone(doc.data);
    this.random = SillyRandom.createRandomGenerator(this.data.seed);

    this.opponentEmail = common.clone(doc.players);
    this.opponentEmail.splice(this.opponentEmail.indexOf(email), 1);
    this.opponentEmail = this.opponentEmail[0];

    var me = doc[common.base64_encode(email)];
    var opponent = doc[common.base64_encode(this.opponentEmail)];

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

    for (var i = 0; i < me.hand.length; i++) {
        var card = me.hand[i];
        var c = this._createCard(card, Owner.ME, card.state);
        this._cards.push(c);
    }
    for (var i = 0; i < me.deck.length; i++) {
        var card = me.deck[i];
        var c = this._createCard(card, Owner.ME, CardState.DECK);
        this._cards.push(c);
    }

    for (var i = 0; i < opponent.deck.length; i++) {
        var card = opponent.deck[i];
        var c = this._createCard(card, Owner.OPPONENT, CardState.DECK);
        this._cards.push(c);
    }
    for (var i = 0; i < opponent.hand.length; i++) {
        var card = opponent.hand[i];
        var c = this._createCard(card, Owner.OPPONENT, card.state);
        this._cards.push(c);
    }
}

StateModel.prototype = {
    __proto__: StateModelCommon.prototype,

    _createCard: function(card, owner, state) {
        var o = common.clone(card);

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
        if (!o.visualState)
            o.visualState = '';
        var card = this._createCard(o, o.owner, o.state);
        this._cards.push(card);
    },

    _serializeCard: function(card) {
        card.emit = undefined;
        return card;
    },

    serialize: function() {
        this.data.seed = this.random.state;
        var doc = {
            _id: this._id,
            turn: this.turn == Owner.ME? this.email: this.opponentEmail,
            players: [ this.email, this.opponentEmail ],
            log: this._log,
            actionsCount: this._log.length,
            data: this.data
        };

        var ce1 = common.base64_encode(this.email);
        var ce2 = common.base64_encode(this.opponentEmail);

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
    var email = this.model.email;
    if (action == DRAW_CARD) {
        if (p2 != Owner.ME)
            email = this.model.opponentEmail
    }
    this.model._log.push({ email: email, action: action, params: [ p1, p2 ] });
}

exports.gameAction = function(req, res) {
    var email = req.email;
    var gameid = req.gameid;
    var action = req.params.action;
    var id1 = req.query.id1;
    var id2 = req.query.id2;

    var model;
    pdb.collection('games').findOne({ _id: new mongodb.ObjectID(gameid) }).then(function (doc) {
        if (!doc)
            throw new Error('incorrect gameid');

        model = new StateModel(doc, email);
        var controller = new GameStateController(model, Owner.ME);
        var opponentController = new GameStateController(model, Owner.OPPONENT);

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
        default:
            throw new Error('unknown action');
        };

        var r = model.serialize();
        r.initial = doc.initial;
        delete r._id;
        return pdb.collection('games').findAndModifyEx({ query: { _id: doc._id, actionsCount: doc.actionsCount },
                                                  update: { $set: r }});
    }).done(function() {
        res.send('{}');
        if (model.me.health <= 0 || model.opponent.health <= 0) {
            var looser, winer;
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
        res.status(400).end();
    });
};

exports.gameState = function(req, res) {
    var email = req.email;
    var gameid = req.gameid;

    pdb.collection('games').findOne({ _id: new mongodb.ObjectID(gameid) }).then(function (doc) {
        if (!doc)
            throw new Error('incorrect gameid');

        assert(doc.players.indexOf(email) != -1);

        var opponentEmail = common.clone(doc.players);
        opponentEmail.splice(opponentEmail.indexOf(email), 1);
        opponentEmail = opponentEmail[0];

        if (doc[common.base64_encode(opponentEmail)].health <= 0 || doc[common.base64_encode(email)].health <= 0) {
            pdb.collection('matchmaking').remove({ gameid: new mongodb.ObjectID(gameid) }).done(function() {}, function(e) {
                console.log(e);
            });
        }

        var opponentState = doc.initial[common.base64_encode(opponentEmail)];
        var myState = doc.initial[common.base64_encode(email)];

        var log = doc.log.map(function (e) {
            var r = { action: e.action, params: e.params};
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

        var result = { log: log,
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
