var express = require('express');
var app = express();
var XMLHttpRequest = require('xhr2');

function xhrWithAuth(method, url, access_token, callback) {
    function requestStart() {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);
        xhr.onload = requestComplete;
        xhr.send();
    }

    function requestComplete() {
        callback(this.status, this.response);
    }

    requestStart();
}

function getUserInfo(token, callback) {
    xhrWithAuth('GET',
                'https://www.googleapis.com/plus/v1/people/me',
                token,
                callback);
}

app.get('/ok', function(req, res){
    res.send('ok');
});

app.get('/authorize', function(req, res){
    var token = req.query.token;
    var email = req.query.email;
    if (!token || !email) {
        res.status(400).end();
        return;
    }
    getUserInfo(token, function(status, response) {
        response = JSON.parse(response);
        if (status == 200 && response.emails) {
            for (var i = 0; i < response.emails.length; i++) {
                var o = response.emails[0];
                if (o.value == email) {
                    res.send('ok');
                    return;
                }
            }
        }
        res.status(400).end();
    });
});

var server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
});
