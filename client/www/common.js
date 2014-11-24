var host = 'http://192.168.1.9:3000/';

var GA_ACCOUNT = 'UA-56813809-1';
var SCREEN_WIDTH = 1280;
var SCREEN_HEIGHT = 768;

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
        }
    }
    window.onerror = function(message, filename, lineno) {
        errors.push({message: message, filename: filename, lineno: lineno})

        reportErrors();
        return false;
    }
    document.addEventListener('deviceready', function() {
        analytics.startTrackerWithId(GA_ACCOUNT);
        analytics.trackView(document.title);
        ready = true;
        reportErrors();
    });
})();

function NetworkRequestQueue() {
    this._queue = [];
}
NetworkRequestQueue.prototype = {
    ajax: function(url, data, success) {
        this._queue.push({url: url, data: data, success: success});
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
        $.ajax({ url: d.url, data: d.data }).done(function(data) {
            self._queue.shift();
            if (d.success)
                d.success(data);
            self._process.apply(self);
        }).fail(function() {
            console.log('network fail');
            self._queue.shift();
        });
    }
};

var _network = new NetworkRequestQueue();
