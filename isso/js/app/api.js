define(["q"], function(Q) {

    "use strict";

    Q.stopUnhandledRejectionTracking();
    Q.longStackSupport = true;

    var endpoint = null,
        salt = "Eech7co8Ohloopo9Ol6baimi",
        location = window.location.pathname;

    var rules = {
        "/": [200, 404],
        "/new": [201, 202],
        "/id/\\d+": [200, 403, 404],
        "/id/\\d+/(like/dislike)": [200],
        "/count": [200]
    };

    /*
     * Detect Isso API endpoint. There are typically two use cases:
     *
     *   1. use minified, single-file JavaScript. The browser interprets
     *      scripts sequentially, thus we can safely use the last script
     *      tag. Then, we chop off some characters -- /js/embed.min.s --
     *      and we're done.
     *
     *      If the script is not served by Isso directly, a custom data
     *      attribute can be used to override the default detection
     *      mechanism:
     *
     *      .. code-block:: html
     *
     *          <script data-prefix="/path" src="/.../embed.min.js"></script>
     *
     *   2. use require.js (during development). When using require.js, we
     *      assume that the path to the scripts ends with `/js/`.
     *
     */

    var script, uri;
    var port = window.location.port ? ":" + window.location.port : "",
        host = window.location.protocol + "//" + window.location.hostname + port;

    var js = document.getElementsByTagName("script");
    for (var i = 0; i < js.length; i++) {
        if (js[i].src.match("require\\.js$") && js[i].dataset.main.match("/js/embed$")) {
            uri = js[i].dataset.main;
            endpoint = uri.substr(0, uri.length - "/js/main".length);
        }
    }

    if (! endpoint) {
        script = js[js.length - 1];

        if (script.dataset.prefix) {
            endpoint = script.dataset.prefix;
        } else {
            uri = script.src.substring(host.length);
            endpoint = uri.substring(0, uri.length - "/js/embed.min.js".length);
        }
    }

    if (endpoint[endpoint.length - 1] === "/") {
        endpoint = endpoint.substring(0, endpoint.length - 1);
    }

    var curl = function(method, url, data) {

        var xhr = new XMLHttpRequest();
        var response = Q.defer();

        function onload() {

            var rule = url.replace(endpoint, "").split("?", 1)[0];

            if (rule in rules && rules[rule].indexOf(xhr.status) === -1) {
                response.reject(xhr.responseText);
            } else {
                response.resolve({status: xhr.status, body: xhr.responseText});
            }
        }

        try {
            xhr.open(method, url, true);
            xhr.withCredentials = true;  // fuck you, fuck you, fuck you IE
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    onload();
                }
            };
        } catch (exception) {
            response.reject(exception.message);
        }

        xhr.send(data);
        return response.promise;
    };

    var qs = function(params) {
        var rv = "";
        for (var key in params) {
            if (params.hasOwnProperty(key) && params[key]) {
                rv += key + "=" + encodeURIComponent(params[key]) + "&";
            }
        }

        return rv.substring(0, rv.length - 1);  // chop off trailing "&"
    };

    var create = function(data) {
        return curl("POST", endpoint + "/new?" + qs({uri: location}), JSON.stringify(data)).then(
            function (rv) { return JSON.parse(rv.body); });
    };

    var modify = function(id, data) {
        return curl("PUT", endpoint + "/id/" + id, JSON.stringify(data)).then(
            function (rv) { return JSON.parse(rv.body); });
    };

    var remove = function(id) {
        return curl("DELETE", endpoint + "/id/" + id, null).then(function(rv) {
            if (rv.status === 403) {
                throw "Not authorized to remove this comment!";
            }

            return JSON.parse(rv.body) === null;
        });
    };

    var view = function(id, plain) {
        return curl("GET", endpoint + "/id/" + id + "?" + qs({plain: plain}), null).then(function (rv) {
            return JSON.parse(rv.body);
        });
    };

    var fetch = function(plain) {

        return curl("GET", endpoint + "/?" + qs({uri: location, plain: plain}), null).then(function (rv) {
            if (rv.status === 200) {
                return JSON.parse(rv.body);
            } else {
                return [];
            }
        });
    };

    var count = function(uri) {
        return curl("GET", endpoint + "/count?" + qs({uri: uri}), null).then(function(rv) {
            return JSON.parse(rv.body);
        });
    };

    var like = function(id) {
        return curl("POST", endpoint + "/id/" + id + "/like", null).then(function(rv) {
            return JSON.parse(rv.body);
        });
    };

    var dislike = function(id) {
        return curl("POST", endpoint + "/id/" + id + "/dislike", null).then(function(rv) {
            return JSON.parse(rv.body);
        });
    };

    var remote_addr = function() {
        return curl("GET", endpoint + "/check-ip", null).then(function(rv) {
                return rv.body;
         });
    };

    return {
        endpoint: endpoint,
        salt: salt,

        remote_addr: remote_addr,

        create: create,
        modify: modify,
        remove: remove,
        view: view,
        fetch: fetch,
        count: count,
        like: like,
        dislike: dislike
    };
});
