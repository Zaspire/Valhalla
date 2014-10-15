var assert = require('assert');
var _ = require('underscore');

var mongodb = require('mongodb');
var pmongo = require('promised-mongo');
var EventEmitter2 = require('events').EventEmitter;

var common = require('./common');
var pdb = pmongo(common.config.mongo);

var GameStateController = require('../ai/game_model').GameStateController;
var Owner = require('../ai/game_model').Owner;
var CardState = require('../ai/game_model').CardState;
var GameState = require('../ai/game_model').GameState;

var ATTACK_PLAYER = 'attack_player';
var END_TURN = 'finish';
var PLAY_CARD = 'card';
var ATTACK = 'attack';

function StateModel(doc, email) {
    EventEmitter2.call(this);

    this._id = doc._id;
    this._log = doc.log;

    this.email = email;

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
        var state = card.onTable ? CardState.TABLE: CardState.HAND;
        var c = this._createCard(Owner.ME, card.type, card.attacksLeft, state, card.id, card.damage, card.health, card.cost);
        this._cards.push(c);
    }
    for (var i = 0; i < me.deck.length; i++) {
        var card = me.deck[i];
        var c = this._createCard(Owner.ME, card.type, card.attacksLeft, CardState.DECK, card.id, card.damage, card.health, card.cost);
        this._cards.push(c);
    }

    for (var i = 0; i < opponent.deck.length; i++) {
        var card = opponent.deck[i];
        var c = this._createCard(Owner.OPPONENT, card.type, card.attacksLeft, CardState.DECK, card.id, card.damage, card.health, card.cost);
        this._cards.push(c);
    }
    for (var i = 0; i < opponent.hand.length; i++) {
        var card = opponent.hand[i];
        var state = card.onTable ? CardState.TABLE: CardState.HAND;
        var c = this._createCard(Owner.OPPONENT, card.type, card.attacksLeft, state, card.id, card.damage, card.health, card.cost);
        this._cards.push(c);
    }
}

StateModel.prototype = {
    __proto__: EventEmitter2.prototype,
    _createCard: function(owner, type, attacksLeft, state, id, damage, health, cost) {
        return {
            __proto__: EventEmitter2.prototype,
            owner: owner,
            type: type,
            damage: damage,
            health: health,
            cost: cost,
            id: id,
            attacksLeft: attacksLeft,
            state: state
        };
    },

    _serializeCard: function(card) {
        var doc = {
            type: card.type,
            id: card.id,
            damage: card.damage,
            health: card.health,
            cost: card.cost,
            attacksLeft: card.attacksLeft
        };
        if (card.state == CardState.TABLE)
            doc.onTable = true;
        return doc;
    },

    serialize: function() {
        var doc = {
            _id: this._id,
            turn: this.turn == Owner.ME? this.email: this.opponentEmail,
            players: [ this.email, this.opponentEmail ],
            log: this._log,
            actionsCount: this._log.length
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
    this.model._log.push({ email: this.model.email, action: action, params: [ p1, p2 ] });
}

exports.gameAction = function(req, res) {
    var email = req.email;
    var gameid = req.gameid;
    var action = req.params.action;
    var id1 = req.query.id1;
    var id2 = req.query.id2;

    pdb.collection('games').findOne({ _id: new mongodb.ObjectID(gameid) }).then(function (doc) {
        if (!doc)
            throw new Error('incorrect gameid');

        var model = new StateModel(doc, email);
        var controller = new GameStateController(model, Owner.ME);
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
    }, function(e) {
        console.log(e);
throw e;
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
            //FIXME: filter card info
            var r = { action: e.action, params: e.params};
            if (e.email == email)
                r.me = true;
            if (r.action === END_TURN && r.me)
                r.params = [null, null];
            return r;
        });

        var result = { log: log,
                       initial: {
                           turn: doc.initial.turn == email,
                           my: {
                               hand: myState.hand,
                               deckSize: myState.deck.length,
                               health: myState.health,
                               mana: myState.mana,
                               maxMana: myState.maxMana
                           },
                           opponent: {
                               handSize: opponentState.hand.length,
                               deckSize: opponentState.deck.length,
                               health: opponentState.health,
                               mana: opponentState.mana,
                               maxMana: opponentState.maxMana
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
