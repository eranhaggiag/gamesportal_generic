var configModule = configModule || angular.module('aio.config', []);

configModule.factory('Config', function () {

    var isLocalStorage = (function () {
        try {
            return localStorage && localStorage.getItem;
        } catch (e) {
            return false;
        }
    })();

    //first time user by default
    var returnUser = isLocalStorage && typeof localStorage.returnUser !== 'undefined';

    var getDocInfo = function () {
        return {
            appName: APP_NAME,
            realm: REALM,
            fbId: FB_APP_ID,
            analyticsId: ANAYTICS_ID,
            firebaseUrl: FIREBASEURL,
            facebookPage: FB_PAGE_URL,
            googlePage: GPLUS_URL
        };
    };

    var _docInfo = getDocInfo();
    var REALM = _docInfo.realm;

    var POINTS = {
        CHROME_APP_INSTALL: 499999,
        FACEBOOK_CONNET: 30000,
        FACEBOOK_INVITE: 99999,
        GIVE_AWAY: 20000,
        PLAY_HOT_GAME: 1500,
        PLAY_NEW_GAME: 999,
        PLAY_PREMIUM_GAME: 2000,
        PLAY_REGULAR_GAME: 499
    };

    var INVITE_FRIENDS_POST = function () {
        return {
            NAME: 'Let\'s play fun games on ' + _docInfo.appName,
            CAPTION: 'Win coins, win cool prizes!',
            DESCRIPTION: (
                'Playing free games and collecting coins. Come and compete in our leaderboard!'
            ),
            LINK: REALM
            // PICTURE: ''
        };
    };

    var baseConfig = {
        REALM: REALM,
        APP_NAME: _docInfo.appName,
        ANALYTICS_ID: _docInfo.analyticsId,
        FIREBASE_URL: _docInfo.firebaseUrl,
        FACEBOOK_PAGE: _docInfo.facebookPage,
        GOOGLE_PAGE: _docInfo.googlePage,
        GAMES_PER_FIRSTPAGE: 70, // amount of games for the first page
        GAMES_PER_PAGE: 50, // amount of games for load more games
        POINTS: POINTS,
        CHROME_APP_ID: _docInfo.chromeId,
        IS_CHROME: (typeof chrome !== 'undefined' && chrome.webstore),
        RETURN_USER: returnUser,
        initialPriority: 80
    };

    var developmentConfig = function () {
        REALM = 'http://localhost:8080';

        return angular.extend(baseConfig, {
            FACEBOOK_APP_ID: _docInfo.fbId,
            REALM: REALM,
            INVITE_FRIENDS_POST: INVITE_FRIENDS_POST()
        });
    };

    var productionConfig = function () {
        return angular.extend(baseConfig, {
            FACEBOOK_APP_ID: _docInfo.fbId,
            INVITE_FRIENDS_POST: INVITE_FRIENDS_POST()
        });
    };

    var isDevelopment = location.hostname === 'localhost';
    var _config = isDevelopment ? developmentConfig() : productionConfig();
    return _config;
});
