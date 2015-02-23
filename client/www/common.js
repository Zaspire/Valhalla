var host = 'http://192.168.1.9:3000/';

var GA_ACCOUNT = 'UA-56813809-1';
var SCREEN_WIDTH = 1280;
var SCREEN_HEIGHT = 768;
var VALHALLA_CLIENT_VERSION = 3;

var ANALYTICS_VIEW_NAME = null;
var cordovaDeviceReady = false;

(function() {
    var errors = [];
    var ready = false;
    function reportErrors() {
        if (!ready)
            return;
        var arr = errors;
        errors = [];
        for (var i = 0; i < arr.length; i++) {
            analytics.trackEvent('error', arr[i].message, arr[i].filename, arr[i].lineno);
            analytics.trackException(arr[i].stack, true);
        }
    }
    window.onerror = function(message, filename, lineno) {
        errors.push({message: message, filename: filename, lineno: lineno})

        reportErrors();
        return false;
    }
    document.addEventListener('deviceready', function() {
        analytics.startTrackerWithId(GA_ACCOUNT);
        analytics.trackView(ANALYTICS_VIEW_NAME ? ANALYTICS_VIEW_NAME : document.title);
        ready = true;
        reportErrors();

        cordovaDeviceReady = true;
    });
})();

function showDialog(msg, cb, icon) {
    var dialog = document.createElement('div');
    dialog.className = 'bg hidden';

    var img = document.createElement('img');
    img.className = 'dialog_bg';
    img.src = 'assets/dialog.webp';
    dialog.appendChild(img);

    if (icon) {
        var ic = document.createElement('img');
        ic.className = 'dialog_icon';
        ic.src = icon;
        dialog.appendChild(ic);
    }

    var container = document.createElement('div');
    container.className = 'dialog_text_container';
    dialog.appendChild(container);

    var text = document.createElement('div');
    text.className = 'dialog_text';
    text.appendChild(document.createTextNode(msg));
    container.appendChild(text);

    dialog.onclick = function() {
        document.body.removeChild(dialog);
        if (cb)
            cb();
    }

    dialog.className = 'bg dialog_show';
    document.body.appendChild(dialog);
}

function NetworkRequestQueue() {
    this._queue = [];
}
NetworkRequestQueue.prototype = {
    ajax: function(url, data, success, timeout) {
        this._queue.push({url: url, data: data, success: success, timeout: timeout});
        this.process();
    },
    process: function() {
        if (this._queue.length != 1)
            return;
        this._process();
    },
    _process: function() {
        if (this._queue.length <= 0)
            return;
        var d = this._queue[0];
        var self = this;
        var timeout = 5000;
        if (d.timeout)
            timeout = d.timeout;
        $.ajax({ url: d.url, data: d.data, timeout: timeout,
                 headers: { "Valhalla-Client": VALHALLA_CLIENT_VERSION } }).done(function(data) {
            self._queue.shift();
            if (d.success)
                d.success(data);
            self._process.apply(self);
        }).fail(function(xhr) {
            var msg = 'Network problem';
            var icon = 'assets/network_problem.png';
            if (xhr.status == 412) {
                msg = 'Client update required';
                icon = 'assets/update.gif';
            }
            showDialog(msg, function() {
                navigator.app.exitApp();
            }, icon);
        });
    }
};

var _network = new NetworkRequestQueue();
