var assert = require('assert');
var _ = require('underscore');

var mongodb = require('mongodb');
var pmongo = require('promised-mongo');

var common = require('./common');
var pdb = pmongo(common.config.mongo);

var ATTACK_PLAYER = 'attack_player';
var END_TURN = 'finish';
var PLAY_CARD = 'card';
var ATTACK = 'attack';

function GameState(doc, email) {
    assert(doc.players.indexOf(email) != -1);
    assert(doc.turn == email);

    this._id = doc._id;
    this.turn = email;

    this.email = email;

    this.opponentEmail = common.clone(doc.players);
    this.opponentEmail.splice(this.opponentEmail.indexOf(email), 1);
    this.opponentEmail = this.opponentEmail[0];

    this.myHealth = doc[common.base64_encode(email)].health;
    this.opponentHealth = doc[common.base64_encode(this.opponentEmail)].health;

    this.myMana = doc[common.base64_encode(email)].mana;
    this.opponentMana = doc[common.base64_encode(this.opponentEmail)].mana;

    this.myMaxMana = doc[common.base64_encode(email)].maxMana;
    this.opponentMaxMana = doc[common.base64_encode(this.opponentEmail)].maxMana;

    this.myCards = doc[common.base64_encode(email)].hand;
    this.opponentCards = doc[common.base64_encode(this.opponentEmail)].hand;

    this.myDeck = doc[common.base64_encode(email)].deck;
    this.opponentDeck = doc[common.base64_encode(this.opponentEmail)].deck;

    this.actionsCount = doc.actionsCount;

    this.log = doc.log;
}

GameState.prototype = {
    isFinished: function() {
        return this.myHealth <= 0 || this.opponentHealth <= 0;
    },

    _log: function(action, p1, p2) {
        this.log.push({ email: this.email, action: action, params: [ p1, p2 ] });
    },

    _myCard: function(id) {
        for (var i = 0; i < this.myCards.length; i++) {
            if (this.myCards[i].id == id)
                return this.myCards[i];
        }
        throw new Error('incorrect card id');
    },

    _opponentCard: function(id) {
        for (var i = 0; i < this.opponentCards.length; i++) {
            if (this.opponentCards[i].id == id)
                return this.opponentCards[i];
        }
        throw new Error('incorrect card id');
    },

    _removeDeadCards: function() {
        function isAlive(card) {
            return card.health > 0;
        }
        this.opponentCards = this.opponentCards.filter(isAlive);
        this.myCards = this.myCards.filter(isAlive);
    },

    canAttack: function(id1) {
        var card = this._myCard(id1);

        if (!card.onTable || card.attacksLeft <= 0)
            return false;

        return true;
    },

    canBeAttacked: function(id2) {
        var card = this._opponentCard(id2);

        if (!card.onTable)
            return false;

        return true;
    },

    canPlayCard: function(id1) {
        var card = this._myCard(id1);

        if (card.onTable || card.cost > this.myMana)
            return false;

        return true;
    },

    attackPlayer: function(id1) {
        if (!this.canAttack(id1))
            throw new Error('invalid action');

        var card = this._myCard(id1);
        card.attacksLeft--;
        this.opponentHealth -= card.damage;

        this.actionsCount++;
        this._log(ATTACK_PLAYER, id1);
    },

    attack: function(id1, id2) {
        if (!this.canAttack(id1) || !this.canBeAttacked(id2))
            throw new Error('invalid action');

        var card1 = this._myCard(id1), card2 = this._opponentCard(id2);

        card1.attacksLeft--;

        card2.health -= card1.damage;
        card1.health -= card2.damage;

        this._removeDeadCards();

        this.actionsCount++;
        this._log(ATTACK, id1, id2);
    },

    playCard: function(id1) {
        if (!this.canPlayCard(id1))
            throw new Error('invalid action');

        var card = this._myCard(id1);
        card.onTable = true;
        card.attacksLeft = 0;
        this.myMana -= card.cost;

        this.actionsCount++;
        this._log(PLAY_CARD, id1, card);
    },

    endTurn: function() {
        this.turn = this.opponentEmail;
        this.opponentMaxMana = Math.min(10, this.opponentMaxMana + 1);
        this.opponentMana = this.opponentMaxMana;

        for (var i = 0; i < this.opponentCards.length; i++) {
            this.opponentCards[i].attacksLeft = 1;
        }

        // FIXME:
        assert(this.opponentDeck.length);

        var card = this.opponentDeck.shift();
        card.attacksLeft = 0;
        this.opponentCards.push(card);

        this.actionsCount++;
        this._log(END_TURN, null, card);
    },

    serialize: function() {
        var doc = {
            _id: this._id,
            turn: this.turn,
            players: [ this.email, this.opponentEmail ],
            log: this.log
        };

        doc[common.base64_encode(this.email)] = { hand: this.myCards,
                                                  deck: this.myDeck,
                                                  health: this.myHealth,
                                                  mana: this.myMana,
                                                  maxMana: this.myMaxMana};
        doc[common.base64_encode(this.opponentEmail)] = { hand: this.opponentCards,
                                                          deck: this.opponentDeck,
                                                          health: this.opponentHealth,
                                                          mana:this.opponentMana,
                                                          maxMana: this.opponentMaxMana};

        return doc;
    }
};

exports.gameAction = function(req, res) {
    var email = req.email;
    var gameid = req.gameid;
    var action = req.params.action;
    var id1 = req.query.id1;
    var id2 = req.query.id2;

    pdb.collection('games').findOne({ _id: new mongodb.ObjectID(gameid) }).then(function (doc) {
        if (!doc)
            throw new Error('incorrect gameid');

        var state = new GameState(doc, email);

        if (state.isFinished())
            throw new Error('game finshed');

        switch (action) {
        case ATTACK_PLAYER:
            state.attackPlayer(id1);
            break;
        case END_TURN:
            state.endTurn();
            break;
        case PLAY_CARD:
            state.playCard(id1);
            break;
        case ATTACK:
            state.attack(id1, id2);
            break;
        default:
            throw new Error('unknown action');
        };

        var r = state.serialize();
//console.log(require('deep-diff')(doc, r));

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
