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
        //TODO - extract to external helper
        var returnObj = {};

        try {
            if (document.location.hostname.indexOf('gamestab.me') >= 0) {
                returnObj.appName = 'Gamestab';
                returnObj.chromeId = 'amlhfkalaoikfbpoolhpdhignhjhlhko'; // gamestab,
                returnObj.fbId = '1481519478732760'; //Play Gamestab
                returnObj.analyticsId = 'UA-47928276-8';
                returnObj.firebaseUrl = 'https://gamestab.firebaseio.com';
                returnObj.facebookPage = 'https://www.facebook.com/gamestabapp';
                returnObj.googlePage = 'https://plus.google.com/107120619150069235310/about';
            }
            returnObj.realm = document.location.origin;
        } catch (e) {
            console.info('Error with doc.location', e);
        }
        //fill all undefined properties with defaults
        return _.defaults(returnObj, {
            appName: 'Mojo Games',
            realm: 'http://www.mojo-games.com',
            chromeId: 'fmpeljkajhongibcmcnigfcjcgaopfid',
            fbId: '224435141079794', //mojo-games
            analyticsId: 'UA-49896275-3',
            firebaseUrl: 'https://bizibizi.firebaseio.com',
            facebookPage: 'https://www.facebook.com/pages/Mojo-Gamescom/452845291514515',
            googlePage: 'https://plus.google.com/u/0/105972966277627450580/about'
        });
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
        PLAY_REGULAR_GAME: 499,
        BOOST_FACTOR: 1
    };

    var INVITE_FRIENDS_POST = function () {
        return {
            NAME: 'Let\'s play fun games on ' + _docInfo.appName,
            CAPTION: 'Win coins, win cool prizes!',
            DESCRIPTION: (
                'Playing free games and collecting coins. Come and compete in our leaderboard!'
            ),
            LINK: REALM
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
            FACEBOOK_APP_ID: '638964789507220',
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
