"use strict";
createjs.Sound.registerSound("assets/audio/mainmenu.mp3", 'mainmenu');
createjs.Sound.registerSound("assets/audio/start.mp3", 'start');
createjs.Sound.registerSound("assets/audio/mm2.mp3", 'mm2');

var SoundUtils = {
    __current: null,
    play: function(id) {
        if (id === SoundUtils.__current)
            return;
        SoundUtils.__current = id;
        createjs.Sound.stop();
        let res = createjs.Sound.play(id, { loop: -1 });
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
        let val = localStorage.getItem('token');
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
        for (let i = 0; i < Token.__q.length; i++)
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

function activateMainMenuTutorial() {
    $('#page1').addClass('hidden');
    $('#page2').addClass('hidden');
    $('#page3').addClass('hidden');
    $('#mainmenu_tutorial').removeClass('hidden');
}

function activateMainMenu() {
    SoundUtils.play('mainmenu');
    if (!localStorage.getItem('mainmenu_tutorial')) {
        activateMainMenuTutorial();
        return;
    }

    updateCoins();
    $('#page1').addClass('hidden');
    $('#page3').addClass('hidden');
    $('#page2').removeClass('hidden');
    $('img[usemap]').rwdImageMaps();

    trackView('MainMenu');
}

var mainMenuTutorialPage = 1;

function nextMainMenuTutorialPage() {
    mainMenuTutorialPage++;
    if (mainMenuTutorialPage > 3) {
        $('#mainmenu_tutorial').addClass('hidden');
        localStorage.setItem('mainmenu_tutorial', true);
        activateMainMenu();
        return;
    }
    let prefix = "tutorial_m";
    $('#' + prefix + mainMenuTutorialPage - 1).addClass('hidden');
    $('#' + prefix + mainMenuTutorialPage).removeClass('hidden');
}

var tutorialPage = 1;

function nextPage() {
    tutorialPage++;
    if (tutorialPage > 6) {
        $('#game_tutorial').addClass('hidden');
        localStorage.setItem('tutorial', true);
        activateMatchMaking();
        return;
    }
    let prefix = "tutorial_p";
    $('#' + prefix + tutorialPage - 1).addClass('hidden');
    $('#' + prefix + tutorialPage).removeClass('hidden');
}

function activateGameTutorial() {
    $('#page1').addClass('hidden');
    $('#page2').addClass('hidden');
    $('#page3').addClass('hidden');
    $('#game_tutorial').removeClass('hidden');
}

function activateMatchMaking() {
    SoundUtils.play('mm2');
    if (!localStorage.getItem('tutorial')) {
        activateGameTutorial();
        return;
    }

    $('#page1').addClass('hidden');
    $('#page2').addClass('hidden');
    $('#page3').removeClass('hidden');

    Token.get(function(token) {
        $('#avg_wait_time').text(_("Average wait time") + ' 00:' + (30 - Math.floor((Math.random() * 5))));

        if (isTranslated())
            $('#avg_wait_time').css({ "font-family": "time new roman", "font-size": "28px" });
        let params = {};
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

        let time = 0;
        setInterval(function() {
            time++;
            let m = String(Math.floor(time / 60));
            let sec = String(time % 60);
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
