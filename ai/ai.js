var env = process.env.NODE_ENV || 'development';

var _ = require('underscore');
var XMLHttpRequest = require('xhr2');
var http = require('http');
var assert = require('assert');
var config = require('./config.' + env + '.json');
var GameStateModel = require('./game_model').GameStateModel;
var GameStateController = require('./game_model').GameStateController;
var Owner = require('./game_model').Owner;
var CardState = require('./game_model').CardState;
var GameState = require('./game_model').GameState;
var common = require('../server/common');
var bots = require('./bots').bots;

var TIMEOUT = 10000;
var TIMEOUT_BETWEEN_MOVES = 3000;

function doRequest(url, cb) {
console.log(url);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.setRequestHeader('valhalla-client', '2');
    xhr.onload = function() {
        //FIXME:
        assert(this.status == 200);
        if (cb)
            cb(this.response);
    };
    xhr.send();
}

function AI(email) {
    this._token = common.crypt(email);
    this._tokenConfirmation = common.crypt('BOT:' + email);
}

AI.prototype = {
    matchmaking: function() {
        var self = this;
        var uri = config.host + 'v1/matchmaking/' + this._token + '/?bot=' + this._tokenConfirmation;
        doRequest(uri, function(data) {
            data = JSON.parse(data);
            if (data.gameid) {
                self.play(data.gameid);
                return;
            }
            setTimeout(self.matchmaking.bind(self), TIMEOUT);
        });
    },

    play: function(gameid) {
        console.log('joining game: ' + gameid);

        this._gameid = gameid;
        this.model = new GameStateModel(config.host, this._token, gameid);
        this.myController = new GameStateController(this.model, Owner.ME);
        this.opponentController = new GameStateController(this.model, Owner.OPPONENT);

        this.model.setOpponentController(this.opponentController);
        this.model.setMyController(this.myController);

        this.model.on('oldMovesDone', this._initGame.bind(this));
    },

    _gameStateChanged: function() {
        if (this.model.state != GameState.IN_PROGRESS) {
            //FIXME: disconnect callbacks
            this.matchmaking();
        }
    },

    _doMove: function() {
        assert(this.model.turn == Owner.ME);

        var l;
        var check = (function() {
            if (l > this.model._log.length) {
                setTimeout(check, TIMEOUT);
                return;
            }
            setTimeout((function () {
                this._doMove();
            }).bind(this), TIMEOUT_BETWEEN_MOVES);
        }).bind(this);

        var cards = _.shuffle(this.model._cards.filter(function(c) {
            return c.owner == Owner.ME && c.state == CardState.HAND;
        }));
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            if (this.myController.canPlayCard(card.id)) {
                this.myController.playCard(card.id);

                l = this.model._log.length;
                this._gameAction('card', card.id, undefined, check);

                return;
            }
        }
        cards = _.shuffle(this.model._cards.filter(function(c) {
            return c.owner == Owner.ME && c.state == CardState.TABLE;
        }));
        for (var i = 0; i < cards.length; i++) {
            var card1 = cards[i];
            if (!this.myController.canAttack(card1.id))
                continue;

            if (_.random(0, 100) > 60 && this.myController.canAttackOpponent()) {
                this.myController.attackPlayer(card1.id);

                l = this.model._log.length;
                this._gameAction('attack_player', card1.id, undefined, check);
                return;
            }

            c2 = _.shuffle(this.model._cards.filter(function(c) {
                return c.owner != Owner.ME && c.state == CardState.TABLE;
            }));

            for (var k = 0; k < c2.length; k++) {
                var card2 = c2[k];
                if (this.myController.canBeAttacked(card2.id)) {
                    this.myController.attack(card1.id, card2.id);

                    l = this.model._log.length;
                    this._gameAction('attack', card1.id, card2.id, check);

                    return;
                }
            }
        }
        this._gameAction('finish');
    },

    _turnChanged: function() {
        if (this.model.turn != Owner.ME)
            return;

        this._doMove();
    },

    _initGame: function() {
        this.model.on('changed::state', this._gameStateChanged.bind(this));
        this._gameStateChanged();

        this.model.on('changed::turn', this._turnChanged.bind(this));
        this._turnChanged();

        var self= this;
        this.myController.me.on('changed::mana', function() {
            console.trace('CHANGED: ' + self.myController.me.mana);
        } );
    },

    _gameAction: function(action, id1, id2, cb) {
        var uri = config.host + 'v1/game_action/' + this._token + '/' + this._gameid + '/' + action + '/?';

        if (id1 !== undefined) {
            uri += 'id1=' + id1 + '&';
        }
        if (id2 !== undefined) {
            uri += 'id2=' + id2;
        }
        doRequest(uri, cb);
    }
};

for (var i = 0; i < bots.length; i++) {
    var ai = new AI(bots[i].email);

    ai.matchmaking();
}
