var host = 'http://192.168.1.8:3000/';

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
