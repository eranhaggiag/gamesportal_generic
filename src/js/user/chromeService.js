var chromeModule = chromeModule || angular.module('aio.chrome', []);

chromeModule.factory('Chrome', ['$rootScope', 'Config', '$http', '$q',
    function ($rootScope, Config, $http, $q) {
        var isAppInstalled, CHROME_ID;

        var init = function () {
            CHROME_ID = Config.CHROME_APP_ID;
            checkIfAppInstalled().then(function () {
                isAppInstalled = true;
            }, function () {
                isAppInstalled = false;
            });
        };

        var checkIfAppInstalled = function () {
            var newtabURL = 'chrome-extension://' + CHROME_ID + '/newtab.html';
            return $http.get(newtabURL);
        };

        var chromeAppURL = function (id) {
            return 'https://chrome.google.com/webstore/detail/' + id;
        };

        var installApp = function () {
            var defer = $q.defer();
            if (!isAppInstalled && Config.IS_CHROME) {
                console.log(chromeAppURL(CHROME_ID));
                //add play.gamestab.me partner cookie
                document.cookie = 'app_id=5337fc253771010d00cfd384';
                chrome.webstore.install(chromeAppURL(CHROME_ID), function () {
                    defer.resolve();
                }, function (e) {
                    console.error(e);
                    //clear cookie on error
                    document.cookie = 'app_id=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                    defer.reject('chrome web store error');
                });
            } else {
                defer.reject('not chrome or app was already installed');
            }

            return defer.promise;
        };

        init();

        return {
            checkIfAppInstalled: checkIfAppInstalled,
            isAppInstalled: function () {
                return isAppInstalled;
            },
            installApp: installApp
        };
    }
]);
