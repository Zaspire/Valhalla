var env = process.env.NODE_ENV || 'development';

var XMLHttpRequest = require('xhr2');
var assert = require('assert');
var config = require('./config.' + env + '.json');

function doRequest(url, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload = function() {
        //FIXME:
        assert(this.status == 200);
        cb(this.response);
    };
    xhr.send();
}

function play(id, gameid) {
    function again() {
        play(id, gameid);
    }
    console.log('PLAY');
    doRequest(config.host + 'game_state?token=' + id.email + '&gameid=' + gameid, function(response) {
        response = JSON.parse(response);
        if (response.state != "WIP") {
            return matchmaking(id);
        }
        if (!response.myTurn) {
            setTimeout(again, 2000);
            return;
        }
        for (var i = 0; i < response.playerHand.length; i++) {
            var card = response.playerHand[i];
            if (card.cost <= response.mana) {
                doRequest(config.host + 'game_action?token=' + id.email + '&gameid=' + gameid + '&action=card&id1=' + card.id, function(response) {
                    setTimeout(again, 500);
                });
                return;
            }
        }
        doRequest(config.host + 'game_action?token=' + id.email + '&gameid=' + gameid + '&action=finish', function(response) {
            setTimeout(again, 2000);
        });
        console.log(response);
    });
}

function matchmaking(id) {
    function onload() {
        var status = this.status;
        var response = this.response;
        if (status != 200)
            process.exit(1);
        response = JSON.parse(response);

        if (!response.gameid) {
            setTimeout(function() {
                matchmaking(id);
            }, 2000);
            return;
        }
        play(id, response.gameid);
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', config.host + 'matchmaking?token=' + id.email + "&bot=" + id.confirmation);
    xhr.onload = onload;
    xhr.send();
}

for (var i = 0; i < config.bot_ids.length; i++) {
    var id = config.bot_ids[i];

    matchmaking(id);
}
