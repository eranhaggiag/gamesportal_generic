/**
 * USING THE  INLINE INSTALL API
 * Fill the global vars :
 * * AIO_USE_YOUR_OWN_GOOGLE_ANALYTICS
 * * AIO_GOOGLE_ANALYTICS_UID
 * * AIO_CHROME_ID
 *
 * PUBLIC API
 * aioInline.ready(done) - when script is ready, running on chrome and app was isntalled before
 * aioInline.install(success, error) -  to initiate the install, this method can be called only after user action(=click)
 *
 */

AIO_USE_YOUR_OWN_GOOGLE_ANALYTICS = false; // true if you want to sue your own Google Analytics(Universal) and have loaded the GA script
AIO_GOOGLE_ANALYTICS_UID = "UA-47928276-3"; // custom Google Analytics(Universal) ID
// AIO_CHROME_ID = "mgfknfklhbpokkokgcaaggnlpbicdadn"; // the chrome app id, the domain has to be verified in this chrome ID dashboard
// AIO_CHROME_ID = "amlhfkalaoikfbpoolhpdhignhjhlhko"; // the chrome app id, the domain has to be verified in this chrome ID dashboard
AIO_CHROME_ID = "fmpeljkajhongibcmcnigfcjcgaopfid"; // the chrome app id, the domain has to be verified in this chrome ID dashboard

// promises.js https://github.com/stackp/promisejs/
/*
 *  Copyright 2012-2013 (c) Pierre Duquesne <stackp@online.fr>
 *  Licensed under the New BSD License.
 *  https://github.com/stackp/promisejs
 */

(function(exports) {

    function Promise() {
        this._callbacks = [];
    }

    Promise.prototype.then = function(func, context) {
        var p;
        if (this._isdone) {
            p = func.apply(context, this.result);
        } else {
            p = new Promise();
            this._callbacks.push(function() {
                var res = func.apply(context, arguments);
                if (res && typeof res.then === 'function')
                    res.then(p.done, p);
            });
        }
        return p;
    };

    Promise.prototype.done = function() {
        this.result = arguments;
        this._isdone = true;
        for (var i = 0; i < this._callbacks.length; i++) {
            this._callbacks[i].apply(null, arguments);
        }
        this._callbacks = [];
    };

    function join(promises) {
        var p = new Promise();
        var results = [];

        if (!promises || !promises.length) {
            p.done(results);
            return p;
        }

        var numdone = 0;
        var total = promises.length;

        function notifier(i) {
            return function() {
                numdone += 1;
                results[i] = Array.prototype.slice.call(arguments);
                if (numdone === total) {
                    p.done(results);
                }
            };
        }

        for (var i = 0; i < total; i++) {
            promises[i].then(notifier(i));
        }

        return p;
    }

    function chain(funcs, args) {
        var p = new Promise();
        if (funcs.length === 0) {
            p.done.apply(p, args);
        } else {
            funcs[0].apply(null, args).then(function() {
                funcs.splice(0, 1);
                chain(funcs, arguments).then(function() {
                    p.done.apply(p, arguments);
                });
            });
        }
        return p;
    }

    /*
     * AJAX requests
     */

    function _encode(data) {
        var result = "";
        if (typeof data === "string") {
            result = data;
        } else {
            var e = encodeURIComponent;
            for (var k in data) {
                if (data.hasOwnProperty(k)) {
                    result += '&' + e(k) + '=' + e(data[k]);
                }
            }
        }
        return result;
    }

    function new_xhr() {
        var xhr;
        if (window.XMLHttpRequest) {
            xhr = new XMLHttpRequest();
        } else if (window.ActiveXObject) {
            try {
                xhr = new ActiveXObject("Msxml2.XMLHTTP");
            } catch (e) {
                xhr = new ActiveXObject("Microsoft.XMLHTTP");
            }
        }
        return xhr;
    }

    function ajax(method, url, data, headers) {
        var p = new Promise();
        var xhr, payload;
        data = data || {};
        headers = headers || {};

        try {
            xhr = new_xhr();
        } catch (e) {
            p.done(promise.ENOXHR, "");
            return p;
        }

        payload = _encode(data);
        if (method === 'GET' && payload) {
            url += '?' + payload;
            payload = null;
        }

        xhr.open(method, url);
        xhr.setRequestHeader('Content-type',
            'application/x-www-form-urlencoded');
        for (var h in headers) {
            if (headers.hasOwnProperty(h)) {
                xhr.setRequestHeader(h, headers[h]);
            }
        }

        function onTimeout() {
            xhr.abort();
            p.done(promise.ETIMEOUT, "", xhr);
        }

        var timeout = promise.ajaxTimeout;
        if (timeout) {
            var tid = setTimeout(onTimeout, timeout);
        }

        xhr.onreadystatechange = function() {
            if (timeout) {
                clearTimeout(tid);
            }
            if (xhr.readyState === 4) {
                var err = (!xhr.status ||
                    (xhr.status < 200 || xhr.status >= 300) &&
                    xhr.status !== 304);
                p.done(err, xhr.responseText, xhr);
            }
        };

        xhr.send(payload);
        return p;
    }

    function _ajaxer(method) {
        return function(url, data, headers) {
            return ajax(method, url, data, headers);
        };
    }

    var promise = {
        Promise: Promise,
        join: join,
        chain: chain,
        ajax: ajax,
        get: _ajaxer('GET'),
        post: _ajaxer('POST'),
        put: _ajaxer('PUT'),
        del: _ajaxer('DELETE'),

        /* Error codes */
        ENOXHR: 1,
        ETIMEOUT: 2,

        /**
         * Configuration parameter: time in milliseconds after which a
         * pending AJAX request is considered unresponsive and is
         * aborted. Useful to deal with bad connectivity (e.g. on a
         * mobile network). A 0 value disables AJAX timeouts.
         *
         * Aborted requests resolve the promise with a ETIMEOUT error
         * code.
         */
        ajaxTimeout: 0
    };

    if (typeof define === 'function' && define.amd) {
        /* AMD support */
        define(function() {
            return promise;
        });
    } else {
        exports.promise = promise;
    }

})(this);

var aioInline = (function(useOwnGA, googleAnalyticsID, chromeID, promise) {

    if (!useOwnGA && !googleAnalyticsID) {
        throw new Error('Please  provide a google AnalyticsID or use your own Universal Analytics Script');
    } else if (!chromeID) {
        throw new Error('Please provide chrome ID');
    }

    var newGAAccountString = "aioInline",
        newGAAccountSendString = newGAAccountString + '.send',
        chromeLinkHref = "https://chrome.google.com/webstore/detail/" + chromeID;

    // reset google analytics ID
    googleAnalyticsID = useOwnGA ? null : googleAnalyticsID;

    // init google analytics if needed
    if (googleAnalyticsID) {
        (function(i, s, o, g, r, a, m) {
            i['GoogleAnalyticsObject'] = r;
            i[r] = i[r] || function() {
                (i[r].q = i[r].q || []).push(arguments)
            }, i[r].l = 1 * new Date();
            a = s.createElement(o),
            m = s.getElementsByTagName(o)[0];
            a.async = 1;
            a.src = g;
            m.parentNode.insertBefore(a, m)
        })(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');

        ga('create', googleAnalyticsID, {
            'cookieDomain': 'auto',
            'name': newGAAccountString
        });
        ga(newGAAccountSendString, 'pageview');
    }

    // add chrome web store link to head
    var l = document.createElement("link");
    l.rel = "chrome-webstore-item";
    l.href = chromeLinkHref;
    document.head.appendChild(l);

    // report events
    var reportEvent = function(category, action, label, cb) {
        if (!googleAnalyticsID) {
            if (ga) {
                ga('send', 'event', {
                    'eventCategory': category,
                    'eventAction': action,
                    'eventLabel': label,
                    'hitCallback': function() {
                        cb && cb();
                    }
                });
            } else {
                console.log('no GA object and no google analytics ID specified');
            }
        } else {
            ga(newGAAccountSendString, 'event', {
                'eventCategory': category,
                'eventAction': action,
                'eventLabel': label,
                'hitCallback': function() {
                    cb && cb();
                }
            });
        }
    };

    var isInstalled = function(cb) {
        var newtabURL = "chrome-extension://" + chromeID + "/newtab.html";
        promise.get(newtabURL).then(function(error) {
            if (error) {
                cb && cb('not_installed');
            } else {
                cb && cb('installed');
            }
        });
    };

    var isChrome = function() {
        return typeof chrome !== 'undefined' && chrome.webstore;
    };

    var reportNotChrome = function() {
        reportEvent('load', 'not_chrome');
    };

    var reportAlreadyInstalled = function() {
        reportEvent('load', 'already_installed');
    };

    // public API
    return {
        ready: function(options, done) {
            if (typeof options == 'function') {
                done = options;
            }

            if (isChrome()) {
                isInstalled(function(isInstalled) {
                    if (isInstalled === 'not_installed') {
                        done && done(null);
                    } else {
                        done && done('already_installed');
                        reportAlreadyInstalled();
                    }
                });
            } else {
                done && done('not_chrome');
                reportNotChrome();
            }
        },

        install: function(success, error) {
            reportEvent('install', 'init_install');

            try {
                chrome.webstore.install(chromeLinkHref, function() {
                    reportEvent('install', 'success', null, success);
                }, function() {
                    reportEvent('install', 'error', null, error);
                });
            } catch (e) {
                error && error(e);
            }
        }
    };
})(AIO_USE_YOUR_OWN_GOOGLE_ANALYTICS, AIO_GOOGLE_ANALYTICS_UID, AIO_CHROME_ID, promise);

// for KitziMitzi only
$(document).ready(function() {

    aioInline.ready(function(err) {
        if (!err) {
            $('.img > a').on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var gameURL = $(this).attr('href');
                aioInline.install(function() {
                    document.location = gameURL;
                }, function() {
                    document.location = gameURL;
                });
            });
        }
    });
});
