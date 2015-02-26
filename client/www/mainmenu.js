createjs.Sound.registerSound("assets/audio/mainmenu.mp3", 'mainmenu');
createjs.Sound.registerSound("assets/audio/start.mp3", 'start');
createjs.Sound.registerSound("assets/audio/mm2.mp3", 'mm2');

SoundUtils = {
    __current: null,
    play: function(id) {
        if (id === SoundUtils.__current)
            return;
        SoundUtils.__current = id;
        createjs.Sound.stop();
        var res = createjs.Sound.play(id, { loop: -1 });
        if (res.playState === createjs.Sound.PLAY_FAILED) {
            createjs.Sound.on("fileload", function(event) {
                if (event.id === SoundUtils.__current)
                    createjs.Sound.play(SoundUtils.__current, { loop: -1 });
            });
        }
    },
    stop: function() {
        createjs.Sound.stop();
        SoundUtils.__current = null;
    }
};

$(document).ready(function(e) {
    $('img[usemap]').rwdImageMaps();
});

var Token = {
    __token: null,
    __q: [],
    _init: function() {
        var val = localStorage.getItem('token');
        if (val) {
            Token.__token = val;
            activateMainMenu();
        } else {
            SoundUtils.play('start');
        }
    },
    get: function(cb) {
        if (Token.__token)
            cb(Token.__token);
        else
            Token.__q.push(cb);
    },
    set: function(token) {
        Token.__token = token;
        for (var i = 0; i < Token.__q.length; i++)
            Token.__q[i](token);
        Token.__q = [];
    },
    avaliable: function() {
        return Token.__token !== null;
    }
};
Token._init();

function trackView(id) {
    if (cordovaDeviceReady)
        analytics.trackView(id);
    else
        ANALYTICS_VIEW_NAME = id;
    document.title = id;
}

function login() {
    activateMainMenu();
    if (!Token.avaliable()) {
        chrome.identity.getAuthToken({ 'interactive': true }, function (token, account) {
            if (chrome.runtime.lastError) {
                //FIXME:
                navigator.app.exitApp();
                return;
            }
            _network.ajax(host + 'v1/authorize/' + token + '/' + encodeURIComponent(account), undefined, function(data) {
                console.log("account verified");
                console.log(data);
                localStorage.setItem('token', data);

                Token.set(data);
            });
            console.log(token);
            console.log(account);
        });
    }
}

function updateCoins() {
    Token.get(function(token) {
        _network.ajax(host + 'v1/info/' + token, undefined, function (data) {
            data = JSON.parse(data);
            $('#balance').removeClass('hidden');
            $('#balance_text').text(' ' + data.coins);
        });
    });
}

function activateMainMenu() {
    SoundUtils.play('mainmenu');

    updateCoins();
    $('#page1').addClass('hidden');
    $('#page3').addClass('hidden');
    $('#page2').removeClass('hidden');
    $('img[usemap]').rwdImageMaps();

    trackView('MainMenu');
}

function activateMatchMaking() {
    SoundUtils.play('mm2');

    $('#page1').addClass('hidden');
    $('#page2').addClass('hidden');
    $('#page3').removeClass('hidden');

    Token.get(function(token) {
        $('#avg_wait_time').text(_("Average wait time") + ' 00:' + (30 - Math.floor((Math.random() * 5))));

        if (isTranslated())
            $('#avg_wait_time').css({ "font-family": "time new roman", "font-size": "28px" });
        var params = {};
        params.token = token;

        function request() {
            _network.ajax(host + 'v1/matchmaking/' + params.token, undefined, function(data) {
                if (data == '{}') {
                    setTimeout(request, 1000);
                    return;
                }
                data = JSON.parse(data);

                localStorage.setItem('gameid', data.gameid);
                window.location = 'game.html';
            });
        }
        request();

        time = 0;
        setInterval(function() {
            time++;
            var m = String(Math.floor(time / 60));
            var sec = String(time % 60);
            if (m.length === 1)
                m = '0' + m;
            if (sec.length === 1)
                sec = '0' + sec;
            $('#time').text(m + ':' + sec);
        }, 1000);
    });
    trackView('MatchMaking');
}

function navigate(location) {
    Token.get(function() {
        window.location = location;
    });
}

document.addEventListener('deviceready', function() {
    setTimeout(function() {
        navigator.splashscreen.hide();
    }, 2000);
}, false);
