/* global ga */
var mainModule = mainModule || angular.module('aio.main', ['ngRoute']);

mainModule.controller('MainCtrl', [
    '$scope', '$log', '$q', '$timeout', '$route', '$http', 'Firebase',
    'Games', '$state', '$stateParams', 'Facebook', 'Chrome', 'Config', '$translate',
    function ($scope, $log, $q, $timeout, $route, $http, Firebase, Games, $state, $stateParams, Facebook, Chrome, Config, $translate) {
        $scope.allGames = [];
        $scope.appName = Config.APP_NAME;
        $scope.appLogo = './img/logo-' + $scope.appName.toLowerCase().replace(/ /g, '') + '.png';
        document.title = $scope.appName;

        var languageTimeout;
        var languageLoaded = false; //whether we have his language settings
        var page = 0, //  hold current page
            loaded = false; // whether the app was already loaded
        var repeatLargeThumbnailsEvery = 20,
            lastLargeThumbnailIndex = 0;

        var rand = _.random(0, 999999999);
        $scope.topIframeAd = {
            iframe: 'http://ads.ad4game.com/www/delivery/afr.php?zoneid=39440&cb=' + rand,
            a     : 'http://ads.ad4game.com/www/delivery/dck.php?n=af1fdb1c&cb=' + rand,
            img   : 'http://ads.ad4game.com/www/delivery/avw.php?zoneid=39440&cb=' + rand + '&n=af1fdb1c'
        };
        $scope.rightSkyAd = {
            iframe: 'http://ads.ad4game.com/www/delivery/afr.php?zoneid=39438&cb=' + rand,
            a     : 'http://ads.ad4game.com/www/delivery/dck.php?n=a1a724da&cb=' + rand,
            img   : 'http://ads.ad4game.com/www/delivery/avw.php?zoneid=39438&cb=' + rand + '&n=a1a724da'
        };

        $scope.socialBtns = {
            facebookPage: Config.FACEBOOK_PAGE,
            googlePage  : Config.GOOGLE_PAGE
        };

        $scope.nationalities = [
            {
                langKey : 'en',
                language: 'English',
                flag    : './img/flags/en.png'
            },
            {
                langKey : 'es',
                language: 'Español',
                flag    : './img/flags/es.png'
            },
            {
                langKey : 'he',
                language: 'עברית',
                flag    : './img/flags/he.png'
            },
            {
                langKey : 'pt',
                language: 'Português',
                flag    : './img/flags/pt.png'
            },
            {
                langKey : 'de',
                language: 'Deutsch',
                flag    : './img/flags/de.png'
            },
            {
                langKey : 'fr',
                language: 'Français',
                flag    : './img/flags/fr.png'
            },
            {
                langKey : 'pl',
                language: 'Polski',
                flag    : './img/flags/pl.png'
            }
        ];

        //header is fixed by default
        $scope.fixedHeader = true;
        $scope.smallHeader = false;
        loaded = true;

        ga('create', Config.ANALYTICS_ID, {
            'cookieDomain': 'none'
        });

        var processThumbnails = function (arr) {
            angular.forEach(arr, function (game, index) {
                //stop if thumbnail is found
                _.some(game.thumbnails, function (thumbnail) {
                    if (thumbnail.width > 250 && thumbnail.height > 250) {
                        game.largeThumbnail = thumbnail;
                        if (index > 10 && (index - lastLargeThumbnailIndex > repeatLargeThumbnailsEvery)) {
                            lastLargeThumbnailIndex = index;
                            game.promoted = true;
                        }
                        return true;
                    }
                    return false;
                });
            });
        };

        var sortArrByPriority = function (arr) {
            return _.sortBy(arr, function (i) {
                return parseInt(i.priority);
            });
        };

        var shuffleSecondHalf = function (arr) {
            /* Randomize 2nd half of initial games */
            var len = Math.floor(arr.length / 2);
            var firstHalf = arr.slice(0, len + 1);
            var secondHalf = arr.slice(-len);
            arr = firstHalf.concat(_.shuffle(secondHalf));
            return arr;
        };

        var setInitialGames = function (games) {
            //sort by priority, then shuffle the second half
            $scope.allGames = sortArrByPriority(games);
            $scope.allGames = shuffleSecondHalf($scope.allGames);
            //process and choose large thumbnails
            processThumbnails($scope.allGames);
            //display only some of the first games
            $scope.games = _.first($scope.allGames, Config.GAMES_PER_FIRSTPAGE * 2);
        };

        var extendGames = function (original, newGames) {
            var _newArr = _.compact(_.map(newGames, function (i) {
                var _oldGame = _.findWhere(original, {
                    id: i.id
                });
                if (_oldGame) {
                    _oldGame = angular.extend(_oldGame, i);
                    return null;
                }

                return i;
            }));

            return original.concat(_newArr);
        };

        var setAllGames = function () {
            if (!Games.allGamesAlreadyFetched) {
                $timeout(function () {
                    Games.getAllGames().then(function (games) {
                        var allGamesFetched = sortArrByPriority(games);
                        processThumbnails(allGamesFetched);
                        $scope.allGames = extendGames($scope.allGames, allGamesFetched);
                        Games.storeGames($scope.allGames);
                    });
                }, 1000);
            }
        };

        // login user
        $scope.login = function () {
            return Facebook.login();
        };

        // logout user
        $scope.logout = function () {
            return Firebase.logout();
        };

        // render more games
        $scope.loadMore = _.throttle(function () {
            if (!$scope.allGames) {
                return;
            }
            ++page;

            var _gamesToShow = Config.GAMES_PER_FIRSTPAGE + (page * Config.GAMES_PER_PAGE);
            $scope.games = _.first($scope.allGames, _gamesToShow);
        }, 2000);

        var loadGame = function (gameId) {
            $state.go('game', {
                gameID: gameId
            });
        };

        // load game
        $scope.runGame = function (game, e) {
            if (e) {
                e.stopPropagation();
                e.preventDefault();
            }
            //reset search field
            $scope.gameSearch = '';
            //if app isn't installed, and this is a first time user
            if (!Chrome.isAppInstalled() && !Config.RETURN_USER && $scope.appName === 'Gamestab') {
                console.log('offer to download extension');
                Chrome.installApp()['finally'](function () {
                    localStorage.returnUser = true;
                    Config.RETURN_USER = true;
                    loadGame(game.id);
                });
            } else {
                loadGame(game.id);
            }
        };

        //open overlay
        $scope.openMainOverlay = function (overlayID) {
            $scope.overlayID = overlayID;
        };

        $scope.playAnotherGame = function () {
            var _randId = _.random(0, $scope.allGames.length - 1);
            $scope.runGame($scope.allGames[_randId]);
        };

        // close overlay
        $scope.closeOverlay = function () {
            if ($stateParams.overlayID) {
                $state.transitionTo($state.current, {}, {
                    location: 'true',
                    reload  : false,
                    inherit : false,
                    notify  : false
                });
            }
            $scope.overlayID = null;
        };

        // go back home (and laod overlay)
        $scope.goHome = function (overlayID) {
            $state.go('main', {
                overlayID: overlayID
            });
        };
        // change the language of the site given the language key
        $scope.changeLanguage = function (nationality) {
            $translate.use(nationality.langKey);
            $scope.selectedNationality = nationality;
            $scope.dropdownFlags = false;
            storageLang(nationality);
        };

        var hideFlag = _.debounce(function () {
            $scope.$apply(function () {
                $scope.dropdownFlags = false;
            });
        }, 10);

        $scope.showLanguageMenu = function () {
            $scope.dropdownFlags = true;
            clearTimeout(languageTimeout);
            languageTimeout = setTimeout(hideFlag, 1500);
        };

        $scope.keepLanguageMenu = function () {
            clearTimeout(languageTimeout);
            $scope.dropdownFlags = true;
        };

        var getUserData = function () {
            $scope.userData = Firebase.userData();
        };

        $scope.getGameClass = function (game, $index) {
            var _class = {
            };
            if (($index + 1) % 21 === 0) {
                _class['rotated-right'] = true;
            } else if (($index + 1) % 18 === 0) {
                _class['rotated-left'] = true;
            }

            if (game.premium) {
                _class.premium = true;
            } else if (game.hot) {
                _class.hot = true;
            }

            if (game.promoted && game.largeThumbnail) {
                _class.promoted = true;
            }

            return _class;
        };

// masonry options
        $scope.masonryOptions = {
            gutter    : 20,
            isFitWidth: true,
            isAnimated: false
        };

        $scope.$on('$stateChangeSuccess', function (event, toState, toParams, fromState) {
            $scope.masonryOptions.isAnimated = false;
            $scope.masonryOptions.transitionDuration = 0;
            $scope.overlayID = $stateParams.overlayID;

            //report analytics on state change
            if (toState.name !== fromState.name) {
                ga('send', 'pageview', {
                    page: window.location.pathname +
                        window.location.hash
                });
            }

            //header doesn't stay fixed in game state to have banner in view
            $scope.fixedHeader = toState.name !== 'game';
        });

        var storageLang = function (lang) {
            if (Games.isLocalStorage) {
                localStorage.langKey = lang.langKey;
            }
        };

        var setInitialLanguage = function () {
            //if localstorage works
            if (Games.isLocalStorage && localStorage.langKey) {
                var lang = localStorage.langKey;
                var _lang = _.findWhere($scope.nationalities, {
                    langKey: lang
                });

                if (_lang) {
                    $scope.changeLanguage(_lang);
                    languageLoaded = true;
                }
            } else {
                $scope.selectedNationality = $scope.nationalities[0];
                $translate.use($scope.selectedNationality.langKey);
            }
        };

        var setUserLanguage = function () {
            //used only to auto-detect language
            languageLoaded = true;
            var lang = window.navigator.language || window.navigator.userLanguage || 'en';
            lang = lang.slice(0, 2).toLowerCase();
            var _lang = _.findWhere($scope.nationalities, {
                langKey: lang
            });

            if (_lang) {
                $scope.changeLanguage(_lang);
            } else {
                //set his current language (default) to storage
                $scope.changeLanguage($scope.selectedNationality);
            }
        };

        setInitialLanguage();
// init - get all games from games db
        Games.isReady
            .then(setInitialGames)
            .then(Firebase.initting)
            .then(getUserData)
            .then(setAllGames)
            .then(function () {
                $timeout(function () {
                    //lazy load adsense
                    if ($scope.appName === 'Mojo Games') {
                        $.getScript('//pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', function () {
                            $scope.$apply(function () {
                                $scope.adSenseLoaded = true;
                            });
                        });
                    }
                    window.addthis_config = window.addthis_config || {};
                    window.addthis_config.pubid = 'ra-534644e35a88a9ba';
                    window.addthis_config.data_track_addressbar = false;
                    $.getScript('//s7.addthis.com/js/300/addthis_widget.js#domready=1', angular.noop);

                    if (!languageLoaded) {
                        setUserLanguage();
                    }
                }, 700);
            });
    }
])
;
