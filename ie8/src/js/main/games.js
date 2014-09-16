var gamesModule = gamesModule || angular.module('aio.games', ['ngRoute']);

gamesModule.service('Games', ['$log', '$q', '$timeout', '$http', 'Firebase', 'GamesDB',
        function ($log, $q, $timeout, $http, Firebase, GamesDB) {

            var localStorageKey = 'games';
            var oldTimeout = 1000 * 3600 * 24;
            var veryOldTimeout = 1000 * 3600 * 24 * 7;
            var initting = $q.defer();
            var allGamesAlreadyFetched = false;
            var lastGame;

            var getGames = function () {
                return $http.get('../assets/bizibizi-games.json')
                    .then(function (res) {
                        return res && res.data;
                    });
            };

            var refreshFirebase = function () {
                getGames().then(function (games) {
                    storeGames(games);
                });
            };

            var getInitialGames = function () {
                //get games from memory DB
                return initting.resolve(GamesDB);
            };

            var getAllGames = function () {
                return getGames().then(function (games) {
                    return games;
                });
            };

            var storeGames = function (gamesObj) {
                gamesObj = _.sortBy(gamesObj, 'priority');
                if (isLocalStorage()) {
                    var obj = {
                        timestamp: Date.now(),
                        games    : gamesObj
                    };
                    try {
                        var str = JSON.stringify(obj);
                        localStorage.setItem(localStorageKey, str);
                    } catch (e) {
                        console.error(e);
                    }
                }
            };

            var initLocalStorage = function () {
                try {
                    if (isLocalStorage()) {
                        var obj = JSON.parse(localStorage[localStorageKey]);
                        if (obj.games) {
                            //no need to get extra games from
                            allGamesAlreadyFetched = true;
                            if (isVeryOld(obj.timestamp)) {
                                refreshFirebase();
                            } else if (isOld(obj.timestamp)) {
                                refreshFirebase();
                                return initting.resolve(obj.games);
                            } else {
                                return initting.resolve(obj.games);
                            }
                        }
                    }
                } catch (e) {
                    getInitialGames();
                }
            };

            var isLocalStorage = function () {
                try {
                    return localStorage && localStorage.getItem;
                } catch (e) {
                    console.info('no localstorage');
                }
                return false;
            };

            var isOld = function (timestamp) {
                return (Date.now() - parseInt(timestamp) >= oldTimeout);
            };

            var isVeryOld = function (timestamp) {
                return (Date.now() - parseInt(timestamp) >= veryOldTimeout);
            };

            if (isLocalStorage()) {
                initLocalStorage();
            } else {
                getInitialGames();
            }

            return {
                isReady               : initting.promise,
                isLocalStorage        : isLocalStorage,
                getAllGames           : getAllGames,
                allGamesAlreadyFetched: allGamesAlreadyFetched,
                storeGames            : storeGames
            };
        }
    ]).controller('GameCtrl', [
        '$scope', '$log', '$q', '$timeout', '$route', '$location', '$http', '$stateParams', '$state', 'Firebase', 'Games', 'GamesHelpers',
        function ($scope, $log, $q, $timeout, $route, $location, $http, $stateParams, $state, Firebase, Games, GamesHelpers) {
            // var pointsPerGame = 100;
            $scope.gameLoading = true;

            /**
             * initializes the service.
             * extract the game ID from the url params
             * and find it in the games DB.
             * if no game found, redirect back to home page.
             * if game was found, check whether it is a premium game
             * and if yes whether game is unlocked.
             * if game isn't unlocked, offer to unlock the game
             */
            var init = function () {
                // get game ID
                var gameId = $stateParams.gameID;
                // check if game ID is ok
                if (!gameId) {
                    $state.go('main');
                }

                // find game in the games DB
                GamesHelpers.findGameById(gameId).then(function (game) {
                    // check if found game
                    if (!game) {
                        return $state.go('main');
                    }
                    if (game.source === 'miniclip') {
                        $scope.miniclipURL = 'http://www.miniclip.com/games/' +
                            game.data_game_name +
                            '/en/webgame.php?bodybg=1&width=' + game.width +
                            '&height=' + game.height;
                    }
                    // check access
                    return checkPremium(game);
                });

                // get more games
                Games.isReady.then(function (games) {
                    var howMany = 8;
                    var _games = _.first(_.shuffle(_.filter(games, function (i) {
                        return parseInt(i.priority) < 500;
                    })), howMany + 5);
                    $scope.moreGames = _games.slice(0, howMany);
                    $scope.evenMoreGames = _games.slice(howMany, _games.length);
                });
            };

            /**
             * check if game is premium, and if user unlocked the game
             * @param game
             */
            var checkPremium = function (game) {
                // check access
                return Firebase.checkAccessToGame(game).then(function (access) {
                    // access granted - play game
                    $scope.game = game;
                }).error(function () {
                        alert('Error check premium');
                    });
            };

            $scope.getGameUrl = function () {
                return $location.$$absUrl;
            };

            $scope.getGameZoom = _.memoize(function (game) {
                if (!game || !game.width) {
                    return;
                }
                var widthFactor, heightFactor;

                widthFactor = game.width > 640 ? 640 / game.width : 1;
                heightFactor = game.height > 480 ? 480 / game.height : 1;
                return Math.min(1, widthFactor, heightFactor);
            });

            $scope.gameEncodedUrl = function () {
                return encodeURIComponent(location.href);
            }

            $scope.getIframeSize = function (game) {
                var ret = {};
                var scale = 'scale(' + $scope.getGameZoom(game) + ')';
                ret['-moz-transform'] = ret['-o-transform'] = ret['-webkit-transform'] = scale;
                return ret;
            };

            init();
        }
    ]).controller('EditGameCtrl', ['$scope', '$log', '$q', '$timeout',
        '$http', '$stateParams', '$state', 'Firebase', 'Games', 'GamesHelpers',
        function ($scope, $log, $q, $timeout, $http, $stateParams, $state, Firebase, Games, GamesHelpers) {

            /**
             * initializes the service.
             * extract the game ID from the url params
             * and find it in the games DB.
             * use game number instead if provided
             */
            var init = function () {
                // get game ID
                var gameId = $stateParams.gameID;
                var gamePromise;
                // check if game ID is ok
                if (!gameId) {
                    alert('No game id. Cannot continue :(');
                } else {
                    gamePromise = GamesHelpers.findGameById(gameId);
                }

                // find game in the games DB
                if (gamePromise) {
                    gamePromise.then(function (game) {
                        // check if found game
                        if (!game) {
                            alert('Cant find the game with game id' + gameId);
                        } else {
                            $scope.game = game;
                            GamesHelpers.getGameIndex(game.id).then(function (index) {
                                $scope.gameIndex = index;
                            });
                        }
                    }).error(function () {
                            alert('Cant find the game with game id' + gameId);
                        });
                }
            };

            $scope.nextAndSave = function () {
                var game = $scope.game;
                game.priority = game.priority || 1000;
                Firebase.setGameWithPriority(game, function () {
                    GamesHelpers.findNextGameById(game.id).then(function (newGame) {
                        if (newGame) {
                            $state.go('editGame', {
                                gameID: newGame.id
                            });
                        } else {
                            alert('cant find next game :(');
                        }

                    });
                });
            };

            $scope.previousGame = function () {
                var game = $scope.game;
                GamesHelpers.findPreviousGameById(game.id).then(function (newGame) {
                    if (newGame) {
                        $state.go('editGame', {
                            gameID: newGame.id
                        });
                    } else {
                        alert('cant find previous game');
                    }
                });
            };

            init();

        }

    ]).factory('GamesHelpers', ['Games', 'Firebase', 'Config',
        function (Games, Firebase, Config) {

            var gamesArr;

            /**
             * find game by game ID
             * @param gameID
             * @returns {*}
             */
            var findGameById = function (gameID) {
                return Games.isReady.then(function (games) {
                    return _.findWhere(games, {
                        id: gameID
                    });
                });
            };

            /**
             * find next game by game ID
             * @param gameID
             * @returns {*}
             */
            var findNextGameById = function (gameID) {
                return Games.isReady.then(function (games) {
                    gamesArr = gamesArr || _.toArray(games);
                    var current = _.findWhere(gamesArr, {
                        id: gameID
                    });
                    var index = gamesArr.indexOf(current);
                    return gamesArr[++index];
                });
            };

            /**
             * find prev game by game ID
             * @param gameID
             * @returns {*}
             */
            var findPreviousGameById = function (gameID) {
                return Games.isReady.then(function (games) {
                    gamesArr = gamesArr || _.toArray(games);
                    var current = _.findWhere(gamesArr, {
                        id: gameID
                    });
                    var index = gamesArr.indexOf(current);
                    index = (index === 0) ? gamesArr.length - 1 : index - 1;
                    console.log(index);
                    return gamesArr[index];
                });
            };

            var getGameIndex = function (gameID) {
                return Games.isReady.then(function (games) {
                    gamesArr = gamesArr || _.toArray(games);
                    var current = _.findWhere(gamesArr, {
                        id: gameID
                    });
                    var index = gamesArr.indexOf(current);
                    return index;
                });
            };

            /**
             * Raise user's points for playing a game
             */
            var raisePointsForGame = function (game, options) {
                var amount = 0;
                options = options || {};

                if (options.specialReward) {
                    amount = Config.POINTS[options.specialReward];
                } else if (game.premium) {
                    amount = Config.POINTS.PLAY_PREMIUM_GAME;
                } else if (game.hot) {
                    amount = Config.POINTS.PLAY_HOT_GAME;
                } else if (game.newFlag) {
                    amount = Config.POINTS.PLAY_NEW_GAME;
                } else {
                    amount = Config.POINTS.PLAY_REGULAR_GAME;
                }

                if (options.boost) {
                    amount = amount * parseInt(Config.POINTS.BOOST_FACTOR, 10);
                }

                Firebase.raisePoints(amount);
            };

            return {
                findGameById        : findGameById,
                findNextGameById    : findNextGameById,
                findPreviousGameById: findPreviousGameById,
                raisePointsForGame  : raisePointsForGame,
                getGameIndex        : getGameIndex
            };
        }
    ]).service('GamesDB', [

        function () {
            //jshint camelcase:false,quotmark:false,maxlen:false
            return {
                "2048"                             : {
                    "hot"        : true,
                    "voteDown"   : 0,
                    "source"     : "swf",
                    "description": "Get the highest score on this amazing puzzle game",
                    "thumbnails" : [
                        {
                            "url"   : "img/2048.png",
                            "height": 252,
                            "width" : 252
                        }
                    ],
                    "category"   : "Puzzle",
                    "name"       : "2048",
                    "priority"   : 1,
                    "height"     : 600,
                    "swf_url"    : "http://medias.yepifrivkizi.net/flash-2014/2048-flash.swf",
                    "width"      : 480,
                    "id"         : "2048"
                },
                "can_fighters"                     : {
                    "price"      : "1500",
                    "hot"        : true,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/2cd4e8a2ce081c3d7c32c3cde4312ef7.jpg",
                            "height": 110,
                            "width" : 146
                        }
                    ],
                    "description": " Street Fighter with two kids and a can, play vs the computer or with a friend",
                    "game_url"   : "http://games.gamedistribution.com/Can-Fighters",
                    "category"   : "Action",
                    "name"       : "Can Fighters",
                    "priority"   : 66,
                    "height"     : 480,
                    "swf_url"    : "http://swf.gamedistribution.com/2cd4e8a2ce081c3d7c32c3cde4312ef7.swf",
                    "width"      : 640,
                    "premium"    : false,
                    "id"         : "can_fighters"
                },
                "bank_robbers"                     : {
                    "price"      : "5000",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/dc40b7120e77741d191c0d2b82cea7be.jpg",
                            "height": 130,
                            "width" : 175
                        }
                    ],
                    "description": "Enjoy an epic storyline and a very fun gameplay in this amazing new game! Your goal is to rob banks from three different cities and escape the police by shooting down their cars and destroying them. As you progress in the game things will become more challenging, the police will upgrade their cars and even the FBI will step in, but you can also buy new cool vehicles for yourself and upgrade them and your weapons so you can perform better. Enjoy this incredible game!",
                    "game_url"   : "http://games.gamedistribution.com/Bank-Robbers",
                    "category"   : "Car",
                    "name"       : "Bank Robbers",
                    "priority"   : 60,
                    "height"     : 600,
                    "swf_url"    : "http://swf.gamedistribution.com/dc40b7120e77741d191c0d2b82cea7be.swf",
                    "width"      : 800,
                    "premium"    : true,
                    "id"         : "bank_robbers"
                },
                "monster_truck_taxi"               : {
                    "price"      : "750",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1641368630989.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Ride your way through these courses and get your passenger to her destination by any means possible!",
                    "game_url"   : "http://games.gamedistribution.com/Monster-Truck-Taxi",
                    "category"   : "Action",
                    "name"       : "Monster Truck Taxi",
                    "priority"   : 75,
                    "height"     : 480,
                    "swf_url"    : "http://swf.gamedistribution.com/1641368630989.swf",
                    "width"      : 640,
                    "premium"    : false,
                    "id"         : "monster_truck_taxi"
                },
                "krusty_in_vegas"                  : {
                    "price"      : "1500",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1601363179119.jpg",
                            "height": 200,
                            "width" : 200
                        }
                    ],
                    "description": "Take Krusty on a drive thru Las Vegas and finish as fast you can this 5 level race game with your buddy Krusty the clown!",
                    "game_url"   : "http://games.gamedistribution.com/Krusty-In-Vegas",
                    "category"   : "Motorbike",
                    "name"       : "Krusty In Vegas",
                    "priority"   : 35,
                    "height"     : 400,
                    "swf_url"    : "http://swf.gamedistribution.com/1601363179119.swf",
                    "width"      : 600,
                    "premium"    : false,
                    "id"         : "krusty_in_vegas"
                },
                "arcane_weapon"                    : {
                    "price"      : "2500",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1641375802401.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "When a lonely man comes across the unknown Arcane Weapon he unleashed beast from the Netherworld! Fight your way through these beasts by learning new moves and building up your rage to throw down a mega special attacks.",
                    "game_url"   : "http://games.gamedistribution.com/Arcane-Weapon",
                    "category"   : "Action",
                    "name"       : "Arcane Weapon",
                    "priority"   : 15,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/1641375802399.swf",
                    "width"      : 800,
                    "premium"    : true,
                    "id"         : "arcane_weapon"
                },
                "basketball_heroes"                : {
                    "price"      : "3000",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1641361377899.jpg",
                            "height": 200,
                            "width" : 300
                        }
                    ],
                    "description": "Make your way through the basketball championships and carry the trophy home",
                    "game_url"   : "http://games.gamedistribution.com/Basketball-Heroes",
                    "category"   : "Sports",
                    "name"       : "Basketball Heroes",
                    "priority"   : 50,
                    "height"     : 480,
                    "swf_url"    : "http://swf.gamedistribution.com/1641361377899.swf",
                    "width"      : 640,
                    "premium"    : true,
                    "id"         : "basketball_heroes"
                },
                "micro_racers"                     : {
                    "hot"        : false,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/c92a10324374fac681719d63979d00fe.jpg",
                            "height": 250,
                            "width" : 250
                        }
                    ],
                    "description": "The drifters around the world had gathered here to prove their talents. This is the first step for the grand prix. Establish your name by racing with the top gamers in the world.",
                    "game_url"   : "http://games.gamedistribution.com/Micro-Racers",
                    "category"   : "Racing",
                    "name"       : "Micro Racers",
                    "priority"   : 13,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/c92a10324374fac681719d63979d00fe.swf",
                    "width"      : 600,
                    "id"         : "micro_racers"
                },
                "4_bats"                           : {
                    "price"      : "400",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/2361370332789.jpg",
                            "height": 150,
                            "width" : 200
                        }
                    ],
                    "description": "Play the pirates game of 4 Bats. Deflect the cannonballs from going into the sea to gain treasure. An interesting and challenging game of skill and nerve.",
                    "game_url"   : "http://games.gamedistribution.com/4-Bats",
                    "category"   : "Puzzle",
                    "name"       : "4 Bats",
                    "priority"   : 9,
                    "height"     : 480,
                    "swf_url"    : "http://swf.gamedistribution.com/2361370332739.swf",
                    "width"      : 640,
                    "premium"    : false,
                    "id"         : "4_bats"
                },
                "3d_russian_road_rage"             : {
                    "price"      : "500",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/eb1e78328c46506b46a4ac4a1e378b91.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "The roads in mother Russia are not exactly what you would expect, enter the road rage and crash as many cars as possible. Achieve the limits of crashed cars to unlock new rides, after 10, 30, and 50 cars crashed. The total of available cars to play is 4. You should also pay attention to the road, you will find money that you can use to buy upgrades like handling, acceleration, top speed and brakes. Can you handle the road rage There are many cars to crash and many obstacles to avoid through the ten levels of the game. Russian Road Rage is a 3D driving game with a huge amount of fun waiting for you. Have fun playing, and remember there are a lot more games like this waiting for you on our website if you finish this one.",
                    "game_url"   : "http://games.gamedistribution.com/3D-Russian-Road-Rage",
                    "category"   : "3D",
                    "name"       : "3D Russian Road Rage",
                    "priority"   : 80,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/eb1e78328c46506b46a4ac4a1e378b91.swf",
                    "width"      : 600,
                    "premium"    : false,
                    "id"         : "3d_russian_road_rage"
                },
                "3_pandas_brazil"                  : {
                    "price"      : "20000",
                    "hot"        : false,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/98e6f17209029f4ae6dc9d88ec8eac2c.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "The crazy 3 pandas are back and making their escape once again! They were captured by a poacher but escaped his trap and landed in Brazil!! They love Brazil but have never been there so it is all new fun for them. These adventurous Pandas are in for a lots of fun new tricks and new obstacles!",
                    "game_url"   : "http://games.gamedistribution.com/3-Pandas-Brazil",
                    "category"   : "Adventure",
                    "name"       : "3 Pandas Brazil",
                    "priority"   : 10,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/98e6f17209029f4ae6dc9d88ec8eac2c.swf",
                    "width"      : 650,
                    "newFlag"    : true,
                    "premium"    : true,
                    "id"         : "3_pandas_brazil"
                },
                "lapd_parking"                     : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/f670ef5d2d6bdf8f29450a970494dd64.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Who said that being a police officer is an easy task They have to keep LA clean from criminals, make sure everything goes smoothly around there, and stay away from trouble, even though it is always behind them. To make their life a little bit easier, in this exciting parking game called LAPD Parking, you are going to have the assignment of helping the police officers park their car. Have fun!",
                    "game_url"   : "http://games.gamedistribution.com/LAPD-Parking",
                    "category"   : "Cars",
                    "name"       : "LAPD Parking",
                    "priority"   : 40,
                    "height"     : 600,
                    "swf_url"    : "http://swf.gamedistribution.com/f670ef5d2d6bdf8f29450a970494dd64.swf",
                    "width"      : 800,
                    "id"         : "lapd_parking"
                },
                "galactic_cats"                    : {
                    "hot"        : true,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1211370427021.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "An evil, if provoked, hamster threatens to destroy the galaxy! Its up to four \"brave\" cats to stop him before he unleashes his super weapon and destroys all cat kind. 1 player or 2 players together can play this game",
                    "game_url"   : "http://games.gamedistribution.com/Galactic-Cats",
                    "category"   : "Adventure",
                    "name"       : "Galactic Cats",
                    "priority"   : 20,
                    "height"     : 480,
                    "swf_url"    : "http://swf.gamedistribution.com/1211370427054.swf",
                    "width"      : 720,
                    "id"         : "galactic_cats"
                },
                "Dead Zed 2"                       : {
                    "hot"        : false,
                    "source"     : "swf",
                    "description": "Shoot down zombies, search for supplies and give roles to other survivors to withstand day-after-day of zombie onslaught.",
                    "thumbnails" : [
                        {
                            "url"   : "http://s3.amazonaws.com/www.mojo-games.com/games/deadzed2/deadzed2-promo-175x216.jpg",
                            "height": 120,
                            "width" : 120
                        }
                    ],
                    "category"   : "Zombies",
                    "name"       : "Dead Zed 2",
                    "priority"   : 2,
                    "height"     : 640,
                    "swf_url"    : "http://s3.amazonaws.com/www.mojo-games.com/games/deadzed2/deadzed2.swf",
                    "width"      : 480,
                    "id"         : "Dead Zed 2"
                },
                "mario_mushroom_adventure_2_"      : {
                    "source"        : "swf",
                    "thumbnails"    : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/921360936960.jpg",
                            "height": 300,
                            "width" : 300
                        }
                    ],
                    "description"   : "You did help mario to survive on first mario mushroom adventure game and now he is waiting for you to join to his second mushroom adventure.Enjoy.",
                    "game_url"      : "http://games.gamedistribution.com/Mario-Mushroom-Adventure-2-",
                    "category"      : "Mario",
                    "name"          : "Mario Mushroom Adventure 2 ",
                    "priority"      : 13,
                    "height"        : 525,
                    "swf_url"       : "http://swf.gamedistribution.com/921360936960.swf",
                    "largeThumbnail": {
                        "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/921360936960.jpg",
                        "height": 300,
                        "width" : 300
                    },
                    "width"         : 560,
                    "id"            : "mario_mushroom_adventure_2_"
                },
                "army_sharpshooter"                : {
                    "price"      : "5000",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/6150ccc6069bea6b5716254057a194ef.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Time to dust off your camouflage, clean our your rifle and take up your spot as Army Sharpshooter! The invading forces are closing in on your position and you are the last remaining hope of the whole army! If any one breaks cover from far away look down your scope and take them out. Be the soldier your country NEEDS!<br/>",
                    "game_url"   : "http://games.gamedistribution.com/Army-Sharpshooter",
                    "category"   : "Shooting",
                    "name"       : "Army Sharpshooter",
                    "priority"   : 12,
                    "height"     : 420,
                    "swf_url"    : "http://swf.gamedistribution.com/6150ccc6069bea6b5716254057a194ef.swf",
                    "width"      : 580,
                    "premium"    : true,
                    "id"         : "army_sharpshooter"
                },
                "alien_city_chase"                 : {
                    "price"      : "500",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/92049debbe566ca5782a3045cf300a3c.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Chase the aliens who are driving the fast car and trying to escape. Complete all levels by chasing them down. Watch out for all the other cars. The alien car is marked with an arrow. Start the racing challenge and get those aliens before they escape.",
                    "game_url"   : "http://games.gamedistribution.com/Alien-City-Chase",
                    "category"   : "Racing",
                    "name"       : "Alien City Chase",
                    "priority"   : 20,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/92049debbe566ca5782a3045cf300a3c.swf",
                    "width"      : 700,
                    "premium"    : false,
                    "id"         : "alien_city_chase"
                },
                "lab_mouse"                        : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/aebf7782a3d445f43cf30ee2c0d84dee.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Youre this poor little mouse hope, you know! Hes confident that youll put your math puzzles solving skills to work for coming up with the best solutions for all these tricky brain training math problems here and thus help him have as much cheese-made cubes as he can. The more hell manage to eat, the stronger hell get and the more chances hell have for gaining that strength he needs for escaping from this lab!",
                    "game_url"   : "http://games.gamedistribution.com/Lab-Mouse",
                    "category"   : "Puzzle",
                    "name"       : "Lab Mouse",
                    "priority"   : 35,
                    "height"     : 480,
                    "swf_url"    : "http://swf.gamedistribution.com/aebf7782a3d445f43cf30ee2c0d84dee.swf",
                    "width"      : 800,
                    "id"         : "lab_mouse"
                },
                "physics_fall"                     : {
                    "price"      : "1500",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/2aedcba61ca55ceb62d785c6b7f10a83.jpg",
                            "height": 250,
                            "width" : 300
                        }
                    ],
                    "description": "Get the Bold as fast you can to the Fan so it repairs. Use wood boards to repair the track and Nitro arrows to move faster. Make sure you spend not to long on solving because you earn Stars for your time.<br/>",
                    "game_url"   : "http://games.gamedistribution.com/Physics-Fall",
                    "category"   : "Physics",
                    "name"       : "Physics Fall",
                    "priority"   : 9,
                    "height"     : 480,
                    "swf_url"    : "http://swf.gamedistribution.com/2aedcba61ca55ceb62d785c6b7f10a83.swf",
                    "width"      : 650,
                    "premium"    : false,
                    "id"         : "physics_fall"
                },
                "extreme_air_wars"                 : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1175defd049d3301e047ce50d93e9c7a.jpg",
                            "height": 130,
                            "width" : 175
                        }
                    ],
                    "description": "Fly an awesome aicraft and try to search and destroy all your enemies. But be aware that they will shoot back, so try to avoid their bullets and bombs and keep a high level on your health bar. Your fuel is also limited, so make sure you do not run out of it. Along the way you can pick up health and fuel power ups along with coins and upgrade tokens. Between levels you can use the tokens to buy some cool upgrades that will make your aiplane better. Have a lot of fun playing Extreme Air Wars!",
                    "game_url"   : "http://games.gamedistribution.com/Extreme-Air-Wars",
                    "category"   : "Shooting",
                    "name"       : "Extreme Air Wars",
                    "priority"   : 3,
                    "height"     : 600,
                    "swf_url"    : "http://swf.gamedistribution.com/1175defd049d3301e047ce50d93e9c7a.swf",
                    "width"      : 800,
                    "id"         : "extreme_air_wars"
                },
                "mario_skate_jump"                 : {
                    "price"      : "1000",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1601368810605.jpg",
                            "height": 250,
                            "width" : 250
                        }
                    ],
                    "description": "Mario on a skateboard Yeah its true he is back in this new adventure and now with a Skateboard! Are you able to break the highscore Help your friend Mario to get to the other side and make sure you dont fall of the skateboard!<br/>",
                    "game_url"   : "http://games.gamedistribution.com/Mario-Skate-Jump",
                    "category"   : "Mario",
                    "name"       : "Mario Skate Jump",
                    "priority"   : 70,
                    "height"     : 400,
                    "swf_url"    : "http://swf.gamedistribution.com/1601368810605.swf",
                    "width"      : 600,
                    "premium"    : false,
                    "id"         : "mario_skate_jump"
                },
                "the_cupcake_collector"            : {
                    "price"      : "900",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1751363049492.jpg",
                            "height": 200,
                            "width" : 200
                        }
                    ],
                    "description": "Play the role of a big fat pasty chef who is on the hunt for some cupcakes. He is always running forward so he is going to need your help. The only thing that you need to worry about is making him jump, you do this by pressing the left mouse button. The longer you press the button the higher our chef will jump in the air. In every level you have to pick up as many cupcakes as you possible can, sometimes you will have to jump a gap or an obstacle at the perfect height so that you do not miss any out.",
                    "game_url"   : "http://games.gamedistribution.com/The-Cupcake-Collector",
                    "category"   : "Running",
                    "name"       : "The Cupcake Collector",
                    "priority"   : 55,
                    "height"     : 600,
                    "swf_url"    : "http://swf.gamedistribution.com/1751363049492.swf",
                    "width"      : 800,
                    "premium"    : true,
                    "id"         : "the_cupcake_collector"
                },
                "relaxing_room_escape"             : {
                    "price"      : "3000",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/9a1de01f893e0d2551ecbb7ce4dc963e.jpg",
                            "height": 250,
                            "width" : 300
                        }
                    ],
                    "description": "It’s dreadful to be inside the room alone even though the room provides you with comfort for relaxing. Without any delay break out from the relaxing room as you trapped inside singly.",
                    "game_url"   : "http://games.gamedistribution.com/Relaxing-Room-Escape",
                    "category"   : "Escape",
                    "name"       : "Relaxing Room Escape",
                    "priority"   : 31,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/9a1de01f893e0d2551ecbb7ce4dc963e.swf",
                    "width"      : 600,
                    "premium"    : true,
                    "id"         : "relaxing_room_escape"
                },
                "gang_blast_2_"                    : {
                    "voteUp"     : 13,
                    "hot"        : false,
                    "voteDown"   : 2,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1641362061850.jpg",
                            "height": 200,
                            "width" : 300
                        }
                    ],
                    "description": "Blast away bandits that are hanging around your town. Use new and interesting way to eliminate them.",
                    "game_url"   : "http://games.gamedistribution.com/Gang-Blast-2-",
                    "category"   : "Puzzle",
                    "name"       : "Gang Blast 2 ",
                    "priority"   : 1,
                    "height"     : 524,
                    "swf_url"    : "http://swf.gamedistribution.com/1641362061850.swf",
                    "width"      : 700,
                    "id"         : "gang_blast_2_"
                },
                "extreme_drifting"                 : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/635440afdfc39fe37995fed127d7df4f.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Would you dare responding to this extreme drifting challenge here You have an increasing number of challenging, intricate laps to complete, a speedy, lightweight drift car to control along those tricky curves there, several locations in which those maze-like drift circuits are placed and... loads of adrenaline for you to handle. Prove that youre the king of drift!",
                    "game_url"   : "http://games.gamedistribution.com/Extreme-Drifting",
                    "category"   : "Cars",
                    "name"       : "Extreme Drifting",
                    "priority"   : 8,
                    "height"     : 525,
                    "swf_url"    : "http://swf.gamedistribution.com/635440afdfc39fe37995fed127d7df4f.swf",
                    "width"      : 700,
                    "id"         : "extreme_drifting"
                },
                "fancy_pandas"                     : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/281347632864.jpg",
                            "height": 150,
                            "width" : 200
                        }
                    ],
                    "description": "Pandas need to stick together. Try to gather them in this clever physics game and use the objects wisely to do so.<br/>Have Fun!",
                    "game_url"   : "http://games.gamedistribution.com/Fancy-Pandas",
                    "category"   : "Puzzle",
                    "name"       : "Fancy Pandas",
                    "priority"   : 2,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/281347632864.swf",
                    "width"      : 600,
                    "id"         : "fancy_pandas"
                },
                "mugalon_poker"                    : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/54f5f4071faca32ad5285fef87b78646.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Great 3D Poker Tables with real Players in multiplayer mode. Become the Poker King in our Arena. For Beginners and Pros, unlock higher big and small blind tables with our level up system. The help shows you how to play Poker and the best Poker hands from royal straigth flush to high card. Be the governor of your poker team, and play texas hold em rules with friends you meet in game. User one of our funny poker faces for male, female or fantasy appearances like dragon or western style. Have the brain to bluff in the right moment to get a blast of chips. Get on top of our global highscore leaderboard. Live and HD Poker Action now, get your pocket aces now. The odds are on your side. For Ipad, Iphone and Android Smartphone plus Tablets. Tournament Mode will be coming soon!",
                    "game_url"   : "http://games.gamedistribution.com/Mugalon-Poker",
                    "category"   : "Card",
                    "name"       : "Mugalon Poker",
                    "priority"   : 15,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/54f5f4071faca32ad5285fef87b78646.swf",
                    "width"      : 700,
                    "id"         : "mugalon_poker"
                },
                "apocalypse_killer"                : {
                    "price"      : "6000",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/f45a1078feb35de77d26b3f7a52ef502.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "This is a story of a Hero! When aliens invaded he was the only one to fight back. Relive his life battle by battle until you find out why he is tied up in a straight jacket at an insane asylum. Earn money and research points to upgrade your hero before battles.",
                    "game_url"   : "http://games.gamedistribution.com/Apocalypse-Killer",
                    "category"   : "Shoot 'Em Up",
                    "name"       : "Apocalypse Killer",
                    "priority"   : 5,
                    "height"     : 480,
                    "swf_url"    : "http://swf.gamedistribution.com/f45a1078feb35de77d26b3f7a52ef502.swf",
                    "width"      : 640,
                    "premium"    : true,
                    "id"         : "apocalypse_killer"
                },
                "rapid_rampage"                    : {
                    "price"      : "2000",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1641372255823.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Race down these these rapids, performing stunts and upgrading your character and inflatable to gain the past score on your rampage. ",
                    "game_url"   : "http://games.gamedistribution.com/Rapid-Rampage",
                    "category"   : "Racing",
                    "name"       : "Rapid Rampage",
                    "priority"   : 30,
                    "height"     : 480,
                    "swf_url"    : "http://swf.gamedistribution.com/1641372255822.swf",
                    "width"      : 720,
                    "premium"    : false,
                    "id"         : "rapid_rampage"
                },
                "sweetandbad"                      : {
                    "hot"        : true,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/52d2752b150f9c35ccb6869cbf074e48.jpg",
                            "height": 200,
                            "width" : 200
                        }
                    ],
                    "description": "Try to gather as more candies as you can. Avoid monsters, try kill them with powerful Power Ups. Let the Halloween night begins.",
                    "game_url"   : "http://games.gamedistribution.com/SweetAndBad",
                    "category"   : "2 Player",
                    "name"       : "SweetAndBad",
                    "priority"   : 55,
                    "height"     : 525,
                    "swf_url"    : "http://swf.gamedistribution.com/52d2752b150f9c35ccb6869cbf074e48.swf",
                    "width"      : 700,
                    "id"         : "sweetandbad"
                },
                "Accurate Boy"                     : {
                    "hot"        : false,
                    "source"     : "swf",
                    "description": "Use a plunger-gun to retrieve a pirate ship toy in this unique physics-based puzzle game.",
                    "thumbnails" : [
                        {
                            "url"   : "http://s3.amazonaws.com/www.mojo-games.com/games/accurateboy/100_100.png",
                            "height": 120,
                            "width" : 120
                        }
                    ],
                    "category"   : "Puzzle",
                    "name"       : "Accurate Boy",
                    "priority"   : 2,
                    "height"     : 640,
                    "swf_url"    : "http://s3.amazonaws.com/www.mojo-games.com/games/accurateboy/accurateboy.swf",
                    "width"      : 480,
                    "id"         : "Accurate Boy"
                },
                "wooden_dining_room_escape"        : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/5a1e3a5aede16d438c38862cac1a78db.jpg",
                            "height": 250,
                            "width" : 250
                        }
                    ],
                    "description": "You heard the door slam behind you when you enter the dining room it is not the work of the ghost but your devilish sibling has locked you inside as the revenge for the bedroom.   If he can find a way out of the bedroom so can you find the way out of the dining room and wipe the smirk out of his face.",
                    "game_url"   : "http://games.gamedistribution.com/Wooden-Dining-Room-Escape",
                    "category"   : "Escape",
                    "name"       : "Wooden Dining Room Escape",
                    "priority"   : 77,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/5a1e3a5aede16d438c38862cac1a78db.swf",
                    "width"      : 600,
                    "id"         : "wooden_dining_room_escape"
                },
                "mario_stunt_car"                  : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1601359497198.jpg",
                            "height": 250,
                            "width" : 250
                        }
                    ],
                    "description": "Mario is once again in a big rush to get the job done, he needs your help this time to get to the finish line!",
                    "game_url"   : "http://games.gamedistribution.com/Mario-Stunt-Car",
                    "category"   : "Mario",
                    "name"       : "Mario Stunt Car",
                    "priority"   : 26,
                    "height"     : 400,
                    "swf_url"    : "http://swf.gamedistribution.com/1601359497198.swf",
                    "width"      : 600,
                    "id"         : "mario_stunt_car"
                },
                "Collapse it 2"                    : {
                    "hot"        : false,
                    "source"     : "swf",
                    "description": "Detonate explosives to destroy all the medieval people, but not the zombies!",
                    "thumbnails" : [
                        {
                            "url"   : "http://s3.amazonaws.com/www.mojo-games.com/games/collapseit2/CI2_Icon_120x90.png",
                            "height": 120,
                            "width" : 120
                        }
                    ],
                    "category"   : "Zombies",
                    "name"       : "Collapse it 2",
                    "priority"   : 2,
                    "height"     : 640,
                    "swf_url"    : "http://s3.amazonaws.com/www.mojo-games.com/games/collapseit2/collapseit2.swf",
                    "width"      : 480,
                    "id"         : "Collapse it 2"
                },
                "luigi_stunts"                     : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1601362149959.jpg",
                            "height": 250,
                            "width" : 250
                        }
                    ],
                    "description": "Welcome to the world of Luigi and cross around it on your fast motorbike! Enjoy the crazy brand new tracks.",
                    "game_url"   : "http://games.gamedistribution.com/Luigi-Stunts",
                    "category"   : "Mario",
                    "name"       : "Luigi Stunts",
                    "priority"   : 8,
                    "height"     : 400,
                    "swf_url"    : "http://swf.gamedistribution.com/1601362149959.swf",
                    "width"      : 600,
                    "id"         : "luigi_stunts"
                },
                "duck_on_duty"                     : {
                    "hot"        : true,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/ed57844fa5e051809ead5aa7e3e1d555.jpg",
                            "height": 250,
                            "width" : 300
                        }
                    ],
                    "description": "The duckling has given the important duty to take care of<br/>the eggs that the ducks drop. The more eggs you catch the<br/>higher the reputation you get. The quickness is the prime<br/>important in this game as the number and the speediness of<br/>the dropping egg increases making it challenging.<br/>",
                    "game_url"   : "http://games.gamedistribution.com/Duck-on-Duty",
                    "category"   : "Skill",
                    "name"       : "Duck on Duty",
                    "priority"   : 15,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/ed57844fa5e051809ead5aa7e3e1d555.swf",
                    "width"      : 600,
                    "id"         : "duck_on_duty"
                },
                "rollasaurus"                      : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/81b3833e2504647f9d794f7d7b9bf341.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Roll your Rollasaurus through 32 various mazes, reach the goal and eat strawberries. It also features a level creator.",
                    "game_url"   : "http://games.gamedistribution.com/Rollasaurus",
                    "category"   : "Skill",
                    "name"       : "Rollasaurus",
                    "priority"   : 33,
                    "height"     : 370,
                    "swf_url"    : "http://swf.gamedistribution.com/81b3833e2504647f9d794f7d7b9bf341.swf",
                    "width"      : 555,
                    "id"         : "rollasaurus"
                },
                "monster_truck_rush"               : {
                    "price"      : "10000",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1601359816736.jpg",
                            "height": 250,
                            "width" : 250
                        }
                    ],
                    "description": "Always wanted to drive a Monster Truck Today is your change with the brand new game Monster Truck Rush!",
                    "game_url"   : "http://games.gamedistribution.com/Monster-Truck-Rush",
                    "category"   : "Racing",
                    "name"       : "Monster Truck Rush",
                    "priority"   : 55,
                    "height"     : 400,
                    "swf_url"    : "http://swf.gamedistribution.com/1601359816736.swf",
                    "width"      : 600,
                    "premium"    : true,
                    "id"         : "monster_truck_rush"
                },
                "party_time_car_parking"           : {
                    "hot"        : false,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/8c249675aea6c3cbd91661bbae767ff1.jpg",
                            "height": 250,
                            "width" : 300
                        }
                    ],
                    "description": "An important socialite that you are, just brag your wealth at the party with your new expensive car. Park it impeccably at the parking lot with no crashes, and keep all eyes glued on your four wheeled wonder.",
                    "game_url"   : "http://games.gamedistribution.com/Party-Time-Car-Parking",
                    "category"   : "Parking",
                    "name"       : "Party Time Car Parking",
                    "priority"   : 41,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/8c249675aea6c3cbd91661bbae767ff1.swf",
                    "width"      : 600,
                    "id"         : "party_time_car_parking"
                },
                "mad_tower_crasher"                : {
                    "price"      : "8000",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1561358263881.jpg",
                            "height": 176,
                            "width" : 262
                        }
                    ],
                    "description": "This is a tower defense game. Place guns along the path to kill the enemies as they come. Place your guns around the map and see how long you can survive. There ar 15 levels. Keep an eye on Flights. When it passes trough it drops the bombs over the guns.",
                    "game_url"   : "http://games.gamedistribution.com/Mad-Tower-Crasher",
                    "category"   : "Strategy",
                    "name"       : "Mad Tower Crasher",
                    "priority"   : 51,
                    "height"     : 600,
                    "swf_url"    : "http://swf.gamedistribution.com/1561358263881.swf",
                    "width"      : 800,
                    "premium"    : true,
                    "id"         : "mad_tower_crasher"
                },
                "smiley_puzzle"                    : {
                    "source"        : "swf",
                    "thumbnails"    : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/3f088ebeda03513be71d34d214291986.jpg",
                            "height": 300,
                            "width" : 300
                        }
                    ],
                    "description"   : "The main goal is to make all the smiles green and happy by dragging them in the way that none of lines are crossing. The level is completed if theres no frown smiles on the board. Untangle smiles to make them happy!<br/>Just drag frown smiles, make all the lines green and smiles happy.",
                    "game_url"      : "http://games.gamedistribution.com/Smiley-Puzzle",
                    "promoted"      : true,
                    "category"      : "Puzzle",
                    "name"          : "Smiley Puzzle",
                    "priority"      : 48,
                    "height"        : 480,
                    "swf_url"       : "http://swf.gamedistribution.com/3f088ebeda03513be71d34d214291986.swf",
                    "largeThumbnail": {
                        "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/3f088ebeda03513be71d34d214291986.jpg",
                        "height": 300,
                        "width" : 300
                    },
                    "width"         : 640,
                    "id"            : "smiley_puzzle"
                },
                "baseball_challenge"               : {
                    "price"         : "15000",
                    "source"        : "swf",
                    "thumbnails"    : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1461361199901.jpg",
                            "height": 300,
                            "width" : 300
                        }
                    ],
                    "promoted"      : true,
                    "description"   : "Youve got some challenges to complete in your Baseball game. Hit home-runs, specific sections of the field and even the pitcher himself.<br/>",
                    "game_url"      : "http://games.gamedistribution.com/Baseball-Challenge",
                    "category"      : "Sports",
                    "name"          : "Baseball Challenge",
                    "priority"      : 40,
                    "height"        : 550,
                    "swf_url"       : "http://swf.gamedistribution.com/1461361199901.swf",
                    "largeThumbnail": {
                        "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1461361199901.jpg",
                        "height": 300,
                        "width" : 300
                    },
                    "width"         : 670,
                    "premium"       : true,
                    "id"            : "baseball_challenge"
                },
                "angry_gran_run:_christmas_village": {
                    "price"     : "150",
                    "voteUp"    : 11,
                    "voteDown"  : 5,
                    "source"    : "swf",
                    "thumbnails": [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/9978b7063e297d84bb2ac8e46c1c845f.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "game_url"  : "http://games.gamedistribution.com/Angry-Gran-Run--Christmas-Village",
                    "category"  : "Running",
                    "name"      : "Angry Gran Run: Christmas Village",
                    "priority"  : 20,
                    "swf_url"   : "http://swf.gamedistribution.com/9978b7063e297d84bb2ac8e46c1c845f.swf",
                    "premium"   : false,
                    "id"        : "angry_gran_run:_christmas_village"
                },
                "racer_kartz"                      : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/e06f967fb0d355592be4e7674fa31d26.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Win the race in the great Kartz battle, challenge your friend or play by yourself. Rule the leaderbord playing with your friend!",
                    "game_url"   : "http://games.gamedistribution.com/Racer-Kartz",
                    "category"   : "Racing",
                    "name"       : "Racer Kartz",
                    "priority"   : 80,
                    "height"     : 520,
                    "swf_url"    : "http://swf.gamedistribution.com/e06f967fb0d355592be4e7674fa31d26.swf",
                    "width"      : 750,
                    "id"         : "racer_kartz"
                },
                "train_rush"                       : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/f3ac63c91272f19ce97c7397825cc15f.jpg",
                            "height": 130,
                            "width" : 175
                        }
                    ],
                    "description": "Drive a train and rush to reach the end of the level in the quickest time possible. Use your NoS power to achieve your goal, but there is also a twist: you will have to pick up passengers from the train station and transpot them safely until the next one. Collect coins and extra NoS on the way and try to get a high score. Make sure your passengers still have some health remaining when reaching the end. There are eight incredible levels available for you to enjoy. Have fun!<br/>",
                    "game_url"   : "http://games.gamedistribution.com/Train-Rush",
                    "category"   : "Racing",
                    "name"       : "Train Rush",
                    "priority"   : 19,
                    "height"     : 600,
                    "swf_url"    : "http://swf.gamedistribution.com/f3ac63c91272f19ce97c7397825cc15f.swf",
                    "width"      : 800,
                    "id"         : "train_rush"
                },
                "bomber_clash"                     : {
                    "price"      : "900",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1211369342032.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Place bombs to kill all enemies and clear a level. Control the cute bear and bomb and blast everything in this 2 player bomb it type game.",
                    "game_url"   : "http://games.gamedistribution.com/Bomber-Clash",
                    "category"   : "Action",
                    "name"       : "Bomber Clash",
                    "priority"   : 15,
                    "height"     : 600,
                    "swf_url"    : "http://swf.gamedistribution.com/1211369342070.swf",
                    "width"      : 740,
                    "premium"    : false,
                    "id"         : "bomber_clash"
                },
                "skate_mania"                      : {
                    "voteUp"     : 3,
                    "hot"        : true,
                    "voteDown"   : 2,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/331342595517.jpg",
                            "height": 200,
                            "width" : 200
                        }
                    ],
                    "description": "You are the new skater in town. Take over the city by pulling insane tricks and scoring as many points as possible. Destroy things along the way as you, jump, flip and smash your way to victory! ",
                    "game_url"   : "http://games.gamedistribution.com/Skate-Mania",
                    "category"   : "Sports",
                    "name"       : "Skate Mania",
                    "priority"   : 39,
                    "height"     : 480,
                    "swf_url"    : "http://swf.gamedistribution.com/331342595517.swf",
                    "width"      : 640,
                    "id"         : "skate_mania"
                },
                "chain_master"                     : {
                    "price"         : "888",
                    "source"        : "swf",
                    "thumbnails"    : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/281341225551.jpg",
                            "height": 300,
                            "width" : 400
                        }
                    ],
                    "promoted"      : true,
                    "description"   : "This clever game is all about chain reaction, in the true sense of the word! Connect the gearwheels with a single chain, in the directions which are displayed. You will find out it is not that easy as it sounds. Get it on! Prove that you are the one and only Chain Master! ;]<br/>",
                    "game_url"      : "http://games.gamedistribution.com/Chain-Master",
                    "category"      : "Puzzle",
                    "name"          : "Chain Master",
                    "priority"      : 66,
                    "height"        : 600,
                    "swf_url"       : "http://swf.gamedistribution.com/281341225551.swf",
                    "largeThumbnail": {
                        "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/281341225551.jpg",
                        "height": 300,
                        "width" : 400
                    },
                    "width"         : 800,
                    "premium"       : false,
                    "id"            : "chain_master"
                },
                "jelly_go!"                        : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/281371212362.jpg",
                            "height": 150,
                            "width" : 200
                        }
                    ],
                    "description": "War, war never changes. Or does it Join this beautifully bubbly battle over the jelly kingdom and defend the rightful ruler’s claim against evil pirates. You are King Jelly’s elite commander, burdened with the challenging task to defeat wave after wave of enemies. No need to despair though, for you have mighty allies at your command. Utilize their unique strengths and spells to defeat the enemy and keep the jelly kingdom alive.",
                    "game_url"   : "http://games.gamedistribution.com/Jelly-GO!",
                    "category"   : "Strategy",
                    "name"       : "Jelly GO!",
                    "priority"   : 13,
                    "height"     : 600,
                    "swf_url"    : "http://swf.gamedistribution.com/281371212499.swf",
                    "width"      : 800,
                    "id"         : "jelly_go!"
                },
                "north_pole_racing"                : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/7dc1c7653ac42a05642a667959c12239.jpg",
                            "height": 250,
                            "width" : 300
                        }
                    ],
                    "description": "Even though the snow has covered the every possible land area in the region, the work load of the truck riders has not reduced a bit. For the safety of the truck riders to ride in the hazardous snow we have made a special course for them to practice their driving skill before they are entrusted with the load ",
                    "game_url"   : "http://games.gamedistribution.com/North-Pole-Racing",
                    "category"   : "Racing",
                    "name"       : "North Pole Racing",
                    "priority"   : 55,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/7dc1c7653ac42a05642a667959c12239.swf",
                    "width"      : 600,
                    "id"         : "north_pole_racing"
                },
                "plants_vs_zombies_2"              : {
                    "source"        : "swf",
                    "thumbnails"    : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/a19acd7d2689207f9047f8cb01357370.jpg",
                            "height": 629,
                            "width" : 843
                        }
                    ],
                    "description"   : "Flash version of Famous Game plants vs zombies 2 : its about time",
                    "game_url"      : "http://games.gamedistribution.com/Plants-vs-Zombies-2",
                    "category"      : "Tower Defense",
                    "name"          : "Plants vs Zombies 2",
                    "priority"      : 9,
                    "height"        : 768,
                    "swf_url"       : "http://swf.gamedistribution.com/a19acd7d2689207f9047f8cb01357370.swf",
                    "largeThumbnail": {
                        "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/a19acd7d2689207f9047f8cb01357370.jpg",
                        "height": 629,
                        "width" : 843
                    },
                    "width"         : 1024,
                    "id"            : "plants_vs_zombies_2"
                },
                "speedy_car_race"                  : {
                    "price"      : "500",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/dc5d637ed5e62c36ecb73b654b05ba2a.jpg",
                            "height": 250,
                            "width" : 300
                        }
                    ],
                    "description": "The more you practice the better you become. We give you ten different circuits with three laps in each exclusively for you to drive in the orbicular way to enjoy yourself.",
                    "game_url"   : "http://games.gamedistribution.com/Speedy-Car-Race",
                    "category"   : "Racing",
                    "name"       : "Speedy Car Race",
                    "priority"   : 51,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/dc5d637ed5e62c36ecb73b654b05ba2a.swf",
                    "width"      : 600,
                    "premium"    : false,
                    "id"         : "speedy_car_race"
                },
                "kiba_and_the_golden_artifact"     : {
                    "source"        : "swf",
                    "thumbnails"    : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/281349182053.jpg",
                            "height": 300,
                            "width" : 400
                        }
                    ],
                    "description"   : "Finally a new game starring Kiba & Kumba - the popular monkey couple known from KaiserGames successful portals like SpielAffe.de, KralOyun.com or KibaGames.com. This time Kiba on her own has to interrupt Dr. Slipp van Ices evil plans to rule the island. To do so, you have to solve some little logical riddles In this point & click adventure and help Kiba out through this snowy island ! Have fun!",
                    "game_url"      : "http://games.gamedistribution.com/Kiba-and-the-Golden-Artifact",
                    "category"      : "Point And Click",
                    "name"          : "Kiba and the Golden Artifact",
                    "priority"      : 12,
                    "height"        : 635,
                    "swf_url"       : "http://swf.gamedistribution.com/281349182053.swf",
                    "largeThumbnail": {
                        "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/281349182053.jpg",
                        "height": 300,
                        "width" : 400
                    },
                    "width"         : 960,
                    "id"            : "kiba_and_the_golden_artifact"
                },
                "desert_drift"                     : {
                    "price"      : "1000",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1601365595831.jpg",
                            "height": 250,
                            "width" : 250
                        }
                    ],
                    "description": "Ride the sunset in this cool racing game and make sure you are home before midnight!",
                    "game_url"   : "http://games.gamedistribution.com/Desert-Drift",
                    "category"   : "Bike",
                    "name"       : "Desert Drift",
                    "priority"   : 6,
                    "height"     : 400,
                    "swf_url"    : "http://swf.gamedistribution.com/1601365595831.swf",
                    "width"      : 600,
                    "premium"    : false,
                    "id"         : "desert_drift"
                },
                "atv_champions"                    : {
                    "price"      : "300",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/231141b34c82aa95e48810a9d1b33a79.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Ride your way through the twists, turns, and jumps from these 6 courses. Try to win gold in all races to be crowned ATV Champion! Use spikes, mines, oil, and nitro to your advantage and take out anyone who tries to get in your way!",
                    "game_url"   : "http://games.gamedistribution.com/ATV-Champions",
                    "category"   : "Racing",
                    "name"       : "ATV Champions",
                    "priority"   : 20,
                    "height"     : 480,
                    "swf_url"    : "http://swf.gamedistribution.com/231141b34c82aa95e48810a9d1b33a79.swf",
                    "width"      : 640,
                    "premium"    : false,
                    "id"         : "atv_champions"
                },
                "los_angeles_tow_truck"            : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/e8dfff4676a47048d6f0c4ef899593dd.jpg",
                            "height": 250,
                            "width" : 300
                        }
                    ],
                    "description": "You are a tow truck driver you have to make sure that all the cars are parked there are few who go against the rule so you have to tow them to the tow area.  Make sure you bring the car in one piece.",
                    "game_url"   : "http://games.gamedistribution.com/Los-Angeles-Tow-Truck",
                    "category"   : "Parking",
                    "name"       : "Los Angeles Tow Truck",
                    "priority"   : 16,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/e8dfff4676a47048d6f0c4ef899593dd.swf",
                    "width"      : 600,
                    "id"         : "los_angeles_tow_truck"
                },
                "tequila_zombies_2"                : {
                    "hot"        : false,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/331344323927.jpg",
                            "height": 200,
                            "width" : 200
                        }
                    ],
                    "description": "The zombie hordes are back and more hungry then ever. Good thing Miguel is better than ever this time around. Also, this time you have a choice of which fighter you want to be. You can be the sexy zombie assassin, Jaqueline or the zombie murdering machete man, Miguel. Grab your weapons and take on the zombie hordes as the attack endlessly from both sides. Do your best to survive until the end because you are the last hope in the battle for mankind.",
                    "game_url"   : "http://games.gamedistribution.com/Tequila-Zombies-2",
                    "category"   : "Shooting",
                    "name"       : "Tequila Zombies 2",
                    "priority"   : 15,
                    "height"     : 480,
                    "swf_url"    : "http://swf.gamedistribution.com/331344323927.swf",
                    "width"      : 640,
                    "id"         : "tequila_zombies_2"
                },
                "the_chopper_ride_2"               : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/758a06618c69880a6cee5314ee42d52f.jpg",
                            "height": 200,
                            "width" : 200
                        }
                    ],
                    "description": "Ride your chopper bike around the town to explore your driving skills. Ride down the hills, beautiful city and drive through the amazing valley.Experience the real ride with new bikes and upgrades.",
                    "game_url"   : "http://games.gamedistribution.com/The-Chopper-Ride-2",
                    "category"   : "Sports",
                    "name"       : "The Chopper Ride 2",
                    "priority"   : 55,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/758a06618c69880a6cee5314ee42d52f.swf",
                    "width"      : 700,
                    "id"         : "the_chopper_ride_2"
                },
                "Enough Plumbers 2"                : {
                    "hot"        : false,
                    "source"     : "swf",
                    "description": "Utilise the special abilities of clones and control them all simultaneously to reach the exit flag in each level.",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/games/enoughplumbers2/enoughplumbers2-thumb-175x80.png",
                            "height": 120,
                            "width" : 120
                        }
                    ],
                    "category"   : "Action",
                    "name"       : "Enough Plumbers 2",
                    "priority"   : 2,
                    "height"     : 640,
                    "swf_url"    : "http://s3.amazonaws.com/www.mojo-games.com/games/enoughplumbers2/enoughplumbers2.swf",
                    "width"      : 480,
                    "id"         : "Enough Plumbers 2"
                },
                "fluffy_bird"                      : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/c5dc3e08849bec07e33ca353de62ea04.jpg",
                            "height": 200,
                            "width" : 200
                        }
                    ],
                    "description": "Enter the amazingly fun challenge of the Fluffy Bird and help him fly away to the sunny lands. This wacky creature is super clumsy and you need to help him reach he’s destinations as soon as possible. Make sure you avoid all the obstacles in order to keep him safe and sound make the highest score. become the ultimate Fluffy Bird “pilot” and challenge your friends to see who has the best concentration and technique, in this funny adventure. Flap your way into having a blast! ",
                    "game_url"   : "http://games.gamedistribution.com/Fluffy-Bird",
                    "category"   : "Arcade",
                    "name"       : "Fluffy Bird",
                    "priority"   : 20,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/c5dc3e08849bec07e33ca353de62ea04.swf",
                    "width"      : 750,
                    "id"         : "fluffy_bird"
                },
                "gang_wars"                        : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/f2d887e01a80e813d9080038decbbabb.jpg",
                            "height": 130,
                            "width" : 175
                        }
                    ],
                    "description": "Have an incredible time driving, parking and shooting, all in this great new game called Gang Wars! What you have to do is look for the members of the opposite gang with whom you are at war, get out of the car and shoot them down. But they will not just sit there and die, they will also fight back and shoot at you, so try to avoid getting killed. Complete eight fun levels to win the war. Enjoy playing this exciting game!",
                    "game_url"   : "http://games.gamedistribution.com/Gang-Wars",
                    "category"   : "Car",
                    "name"       : "Gang Wars",
                    "priority"   : 40,
                    "height"     : 600,
                    "swf_url"    : "http://swf.gamedistribution.com/f2d887e01a80e813d9080038decbbabb.swf",
                    "width"      : 800,
                    "id"         : "gang_wars"
                },
                "3d_super_ride"                    : {
                    "price"      : "2000",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1801369129877.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Go out for a ride and enjoy the power and confidence that your super car brings.  But be careful because you might make the other traffic participants very envious on your brand new super car so they will start acting crazy. Now is your chance to show the other drivers your incredible driving skills. Start your ride and be careful because it would be a pity to hit other cars or obstacles that will come in your way. Get to the finish line unharmed and collect money that you can use to buy upgrades for you super car. Enjoy!",
                    "game_url"   : "http://games.gamedistribution.com/3D-Super-Ride",
                    "category"   : "Car",
                    "name"       : "3D Super Ride",
                    "priority"   : 77,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/1801369129875.swf",
                    "width"      : 600,
                    "premium"    : true,
                    "id"         : "3d_super_ride"
                },
                "merry_fishing"                    : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/8f125da0b3432ed853c0b6f7ee5aaa6b.jpg",
                            "height": 250,
                            "width" : 300
                        }
                    ],
                    "description": "Go Fishing! Catch as many fish as you can <br/>before time runs out.<br/>",
                    "game_url"   : "http://games.gamedistribution.com/Merry-Fishing",
                    "category"   : "Skill",
                    "name"       : "Merry Fishing",
                    "priority"   : 13,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/8f125da0b3432ed853c0b6f7ee5aaa6b.swf",
                    "width"      : 600,
                    "id"         : "merry_fishing"
                },
                "wood_cutters_mania"               : {
                    "price"      : "300",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/a0f3601dc682036423013a5d965db9aa.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Elks and trees. Thats pretty much what Wood Cutters Mania is all about. Kind of like Canada! Control the Lumberjackmobile around the map and start cutting trees. Each log is worth 50$ and you will have to reach a certain amount of sum of money on each level to be able to pass it. Only some of the trees on each map are marked as future timber (follow the hints and you will know which ones). Once you get near a tree press the Z button and youll trigger a tree cutting mini game at the end of which the marked tree will be cut and placed on the Lumberjackmobile. Transport the log back to the sawmill to collect the 50$ the log is worth! ",
                    "game_url"   : "http://games.gamedistribution.com/Wood-Cutters-Mania",
                    "category"   : "Car",
                    "name"       : "Wood Cutters Mania",
                    "priority"   : 77,
                    "height"     : 600,
                    "swf_url"    : "http://swf.gamedistribution.com/a0f3601dc682036423013a5d965db9aa.swf",
                    "width"      : 800,
                    "premium"    : false,
                    "id"         : "wood_cutters_mania"
                },
                "pack_it"                          : {
                    "hot"        : false,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/301344890646.jpg",
                            "height": 250,
                            "width" : 300
                        }
                    ],
                    "description": "Pack the balls in this physics game full of awesome mind cracking levels. Are you ready to face this challenge",
                    "game_url"   : "http://games.gamedistribution.com/Pack-It",
                    "category"   : "Puzzle",
                    "name"       : "Pack It",
                    "priority"   : 56,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/301344890646.swf",
                    "width"      : 650,
                    "id"         : "pack_it"
                },
                "cycle_scramble_2"                 : {
                    "price"      : "500",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1641376487011.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Cycle Scramble is back for more wacky fun! Race against opponents across wild tracks, trying to meet objectives to unlock new crazy characters and earn money for upgrades.",
                    "game_url"   : "http://games.gamedistribution.com/Cycle-Scramble-2",
                    "category"   : "Bike",
                    "name"       : "Cycle Scramble 2",
                    "priority"   : 9,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/1641376487005.swf",
                    "width"      : 800,
                    "premium"    : false,
                    "id"         : "cycle_scramble_2"
                },
                "cranky_turkey_escape"             : {
                    "price"      : "1000",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/d79c6256b9bdac53a55801a066b70da3.jpg",
                            "height": 250,
                            "width" : 300
                        }
                    ],
                    "description": "As the days pass the puritans are getting ready for their favorite thanksgiving feast. Everyone except Mr. Turkey is happy about thanksgiving feast. For he is the one they are going to be feasted on. Help Mr. Turkey to escape from the barn so he can live to see another day light.",
                    "game_url"   : "http://games.gamedistribution.com/Cranky-Turkey-Escape",
                    "category"   : "Escape",
                    "name"       : "Cranky Turkey Escape",
                    "priority"   : 26,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/d79c6256b9bdac53a55801a066b70da3.swf",
                    "width"      : 600,
                    "premium"    : true,
                    "id"         : "cranky_turkey_escape"
                },
                "talking_tom_cat_4"                : {
                    "price"      : "500",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/11342388783.jpg",
                            "height": 243,
                            "width" : 314
                        }
                    ],
                    "description": "Spend a nice time with the cat couple and decide whats gonna happen in this romatic date. Click on the menu to play and have fun. ",
                    "game_url"   : "http://games.gamedistribution.com/Talking-Tom-Cat-4",
                    "category"   : "Adventure",
                    "name"       : "Talking Tom Cat 4",
                    "priority"   : 55,
                    "height"     : 480,
                    "swf_url"    : "http://swf.gamedistribution.com/11342388783.swf",
                    "width"      : 320,
                    "premium"    : false,
                    "id"         : "talking_tom_cat_4"
                },
                "atlantic_city_skyscrapers_racing" : {
                    "price"      : "120",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/f22e4747da1aa27e363d86d40ff442fe.jpg",
                            "height": 130,
                            "width" : 175
                        }
                    ],
                    "description": "Discover one of the most fun places in the world, Atlantic City, from a different view that you are used to: the skyscrapers. Drive on top of them in every part of the city and try to complete eight amazing levels. Use your nitro power to get some extra speed and do some flips while in the air to get bonus points to your score. Collect tokens and a Poseidon statue to get ahead of the game. Have an incredible time playing Atlantic City Skyscrapers Racing!",
                    "game_url"   : "http://games.gamedistribution.com/Atlantic-City-Skyscrapers-Racing",
                    "category"   : "Car",
                    "name"       : "Atlantic City Skyscrapers Racing",
                    "priority"   : 10,
                    "height"     : 600,
                    "swf_url"    : "http://swf.gamedistribution.com/f22e4747da1aa27e363d86d40ff442fe.swf",
                    "width"      : 800,
                    "premium"    : false,
                    "id"         : "atlantic_city_skyscrapers_racing"
                },
                "gangster_boys"                    : {
                    "hot"        : true,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1021377522373.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Try to take over the streets by shooting down the policemen that stand in the way! Be very careful not to crash your vehicle or remain out of fuel and try to shoot the target number of policemen until you complete the distance. Some cops are more difficult to shoot than others, but you will get more points to your score if you succeed in taking them out. Collect ammo and coins on the way to help you in the game. Enjoy eight exciting levels! Have a blast!",
                    "game_url"   : "http://games.gamedistribution.com/Gangster-Boys",
                    "category"   : "Cars",
                    "name"       : "Gangster Boys",
                    "priority"   : 40,
                    "height"     : 600,
                    "swf_url"    : "http://swf.gamedistribution.com/1021377522409.swf",
                    "width"      : 800,
                    "id"         : "gangster_boys"
                },
                "eric_bikerman"                    : {
                    "price"      : "900",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1601362482774.jpg",
                            "height": 250,
                            "width" : 250
                        }
                    ],
                    "description": "Eric Cartman is back! but now on his brand new bike, help him to finish all the levels and dont let him lose from Kyle!!",
                    "game_url"   : "http://games.gamedistribution.com/Eric-BikerMan",
                    "category"   : "Bike",
                    "name"       : "Eric BikerMan",
                    "priority"   : 77,
                    "height"     : 400,
                    "swf_url"    : "http://swf.gamedistribution.com/1601362482774.swf",
                    "width"      : 600,
                    "premium"    : false,
                    "id"         : "eric_bikerman"
                },
                "3d_hummer_racing"                 : {
                    "price"      : "300",
                    "hot"        : false,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/421362056619.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Race with giant Hummer cars on various track. Beat the other Hummer drivers and set the fastest time. You can even drive in the rain.",
                    "game_url"   : "http://games.gamedistribution.com/3D-Hummer-Racing",
                    "category"   : "Racing",
                    "name"       : "3D Hummer Racing",
                    "priority"   : 50,
                    "height"     : 544,
                    "swf_url"    : "http://swf.gamedistribution.com/421362056619.swf",
                    "width"      : 680,
                    "premium"    : false,
                    "id"         : "3d_hummer_racing"
                },
                "planet_escape"                    : {
                    "hot"        : false,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/0233f3bb964cf325a30f8b1c2ed2da93.jpg",
                            "height": 200,
                            "width" : 200
                        }
                    ],
                    "description": "An accident,Researchers spacecraft landed on another planet,there have many dangerous monsters. They have been threatening the life of a researcher.To be able to escape from the planet,Researchers must repair spaceship,Assembled parts and prevent the monster attacks.",
                    "game_url"   : "http://games.gamedistribution.com/Planet-Escape",
                    "category"   : "Shooting",
                    "name"       : "Planet Escape",
                    "priority"   : 9,
                    "height"     : 480,
                    "swf_url"    : "http://swf.gamedistribution.com/0233f3bb964cf325a30f8b1c2ed2da93.swf",
                    "width"      : 640,
                    "id"         : "planet_escape"
                },
                "rescue_kiba_english"              : {
                    "source"        : "swf",
                    "thumbnails"    : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/281358864281.jpg",
                            "height": 300,
                            "width" : 400
                        }
                    ],
                    "description"   : "Kiba & Kumba, the popular monkey couple best known from KaiserGames games network (SpielAffe / KralOyun / KibaGames ...), are now finally starring in their own entire game! Monkey lady Kiba has been hijacked by an evil villain, which brings Monkey King Kumba to the scene. Ready for rescueing his girlfriend. Accompany him on his adventure through various worlds, which will amaze you!",
                    "game_url"      : "http://games.gamedistribution.com/Rescue-Kiba-English",
                    "promoted"      : true,
                    "category"      : "Action",
                    "name"          : "Rescue Kiba English",
                    "priority"      : 31,
                    "height"        : 480,
                    "swf_url"       : "http://swf.gamedistribution.com/281358864281.swf",
                    "largeThumbnail": {
                        "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/281358864281.jpg",
                        "height": 300,
                        "width" : 400
                    },
                    "width"         : 640,
                    "id"            : "rescue_kiba_english"
                },
                "hitchhikers_mayhem"               : {
                    "price"      : "555",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1021377180555.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Try to reach the end of your destination with your car, but be aware that hitchhikers are on the way, determined to slow you down. So run them over and get their money! Use their cash to buy cool upgrades and improve your vehicle so you can drive further each day. You can use Nitro power to get a speed boost, but the day will end when you will run out of fuel. Have a great time playing this fun game!",
                    "game_url"   : "http://games.gamedistribution.com/Hitchhikers-Mayhem",
                    "category"   : "Car",
                    "name"       : "Hitchhikers Mayhem",
                    "priority"   : 55,
                    "height"     : 600,
                    "swf_url"    : "http://swf.gamedistribution.com/1021377180577.swf",
                    "width"      : 800,
                    "premium"    : false,
                    "id"         : "hitchhikers_mayhem"
                },
                "green_love"                       : {
                    "voteUp"        : 19,
                    "voteDown"      : 3,
                    "source"        : "swf",
                    "thumbnails"    : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/281342527475.jpg",
                            "height": 300,
                            "width" : 400
                        }
                    ],
                    "description"   : "Welcome to this froggy adventure! You are in quest of your lost love, which leads you to some funny and strange stages. Just use your mouse and logic in this fun point & click game! ",
                    "game_url"      : "http://games.gamedistribution.com/Green-Love",
                    "category"      : "Adventure",
                    "name"          : "Green Love",
                    "priority"      : 1,
                    "height"        : 480,
                    "swf_url"       : "http://swf.gamedistribution.com/281342527475.swf",
                    "largeThumbnail": {
                        "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/281342527475.jpg",
                        "height": 300,
                        "width" : 400
                    },
                    "width"         : 640,
                    "id"            : "green_love"
                },
                "monster_eats_food"                : {
                    "hot"        : false,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/194cf6c2de8e00c05fcf16c498adc7bf.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Meanwhile in Monsterland, a group of few hungry monsters are competing with each other in a fast food eating game, where the fastest monster could be the next eating champ. Monster Eats Food offers a relaxing 2 player gameplay where two cute monsters charge in a feasting event of eating watermelons, cherries, apples and even fresh jungle bananas! Call your friend, grab the keyboard and start eating all kinds of tasty foods, and avoiding rotten or frozen stuff.",
                    "game_url"   : "http://games.gamedistribution.com/Monster-Eats-Food",
                    "category"   : "Action",
                    "name"       : "Monster Eats Food",
                    "priority"   : 22,
                    "height"     : 525,
                    "swf_url"    : "http://swf.gamedistribution.com/194cf6c2de8e00c05fcf16c498adc7bf.swf",
                    "width"      : 700,
                    "id"         : "monster_eats_food"
                },
                "sonic_the_hedgehog_biker"         : {
                    "hot"        : true,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1601369656522.jpg",
                            "height": 200,
                            "width" : 240
                        }
                    ],
                    "description": "Welcome to the colourful world of Sonic Hedgehog! This crazy bike game takes you thru his epic world, in this Sonic game you need to drive across a bumpy landscape and you can flip over so watch out! Are you the best Sonic biker Good luck!!<br/>",
                    "game_url"   : "http://games.gamedistribution.com/Sonic-The-Hedgehog-Biker",
                    "category"   : "Sonic",
                    "name"       : "Sonic The Hedgehog Biker",
                    "priority"   : 49,
                    "height"     : 400,
                    "swf_url"    : "http://swf.gamedistribution.com/1601369656512.swf",
                    "width"      : 600,
                    "id"         : "sonic_the_hedgehog_biker"
                },
                "3d_wheelchair_race"               : {
                    "price"      : "250",
                    "hot"        : false,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/421370503705.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Race with old granny in a wheelchair, a funny 3D Racing game. Set the fastest laptime and collect the power boost for extra speed. Wheelchair racing was never this fun, try it now.",
                    "game_url"   : "http://games.gamedistribution.com/3D-Wheelchair-race",
                    "category"   : "3D",
                    "name"       : "3D Wheelchair race",
                    "priority"   : 5,
                    "height"     : 400,
                    "swf_url"    : "http://swf.gamedistribution.com/421370503683.swf",
                    "width"      : 550,
                    "premium"    : false,
                    "id"         : "3d_wheelchair_race"
                },
                "touch_the_sky"                    : {
                    "price"         : "10000",
                    "source"        : "swf",
                    "thumbnails"    : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1461359562104.jpg",
                            "height": 300,
                            "width" : 300
                        }
                    ],
                    "description"   : "Have you ever wanted to learn how to fly and touch the sky Surely everyone dreams of this at some point. Well let it become reality",
                    "game_url"      : "http://games.gamedistribution.com/Touch-The-Sky",
                    "category"      : "Flying",
                    "name"          : "Touch The Sky",
                    "priority"      : 19,
                    "height"        : 550,
                    "swf_url"       : "http://swf.gamedistribution.com/1461359562104.swf",
                    "largeThumbnail": {
                        "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1461359562104.jpg",
                        "height": 300,
                        "width" : 300
                    },
                    "width"         : 670,
                    "premium"       : true,
                    "id"            : "touch_the_sky"
                },
                "cheese_barn_levels_pack"          : {
                    "price"      : "1000",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/98c7242894844ecd6ec94af67ac8247d.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Be nice, help a hungry mouse. Guide the mouse to his favorite cheese in fun new levels.",
                    "game_url"   : "http://games.gamedistribution.com/Cheese-Barn-Levels-Pack",
                    "category"   : "Puzzle",
                    "name"       : "Cheese Barn Levels Pack",
                    "priority"   : 2,
                    "height"     : 480,
                    "swf_url"    : "http://swf.gamedistribution.com/98c7242894844ecd6ec94af67ac8247d.swf",
                    "width"      : 720,
                    "premium"    : false,
                    "id"         : "cheese_barn_levels_pack"
                },
                "best_guess"                       : {
                    "price"         : "500",
                    "source"        : "swf",
                    "thumbnails"    : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/36d7534290610d9b7e9abed244dd2f28.jpg",
                            "height": 300,
                            "width" : 300
                        }
                    ],
                    "description"   : "Best Guess is a new and funny guessing app from KaiserGames, the experts for free games for Kids, boys, girls and the whole family. Experience an exciting quiz game with countless pictures over 5 rounds. In each round you have three seconds to guess, how many objects or animals are on the screen. Be fast and accurate to get a better score. Best Guess is a great free game and an entertaining guessing game for kids. But grown-up players will also be challenged by this clever quiz game.",
                    "game_url"      : "http://games.gamedistribution.com/Best-Guess",
                    "category"      : "Puzzle",
                    "name"          : "Best Guess",
                    "priority"      : 80,
                    "height"        : 480,
                    "swf_url"       : "http://swf.gamedistribution.com/36d7534290610d9b7e9abed244dd2f28.swf",
                    "largeThumbnail": {
                        "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/36d7534290610d9b7e9abed244dd2f28.jpg",
                        "height": 300,
                        "width" : 300
                    },
                    "width"         : 800,
                    "premium"       : false,
                    "id"            : "best_guess"
                },
                "All We Need Is Brain"             : {
                    "hot"        : false,
                    "source"     : "swf",
                    "description": "Strategically place brains in each level to lure zombies into traps.",
                    "thumbnails" : [
                        {
                            "url"   : "http://s3.amazonaws.com/www.mojo-games.com/games/allweneedisbrainlevelpack/image100x100.png",
                            "height": 120,
                            "width" : 120
                        }
                    ],
                    "category"   : "Strategy",
                    "name"       : "All We Need Is Brain",
                    "priority"   : 2,
                    "height"     : 640,
                    "swf_url"    : "http://s3.amazonaws.com/www.mojo-games.com/games/allweneedisbrainlevelpack/allweneedisbrainlevelpack.swf",
                    "width"      : 480,
                    "id"         : "All We Need Is Brain"
                },
                "colonial_wars_special_edition"    : {
                    "price"         : "400",
                    "source"        : "swf",
                    "thumbnails"    : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/921366048857.jpg",
                            "height": 300,
                            "width" : 300
                        }
                    ],
                    "description"   : "Feeling colonial Build your own island empire by launching invasion fleets at your neighbors! The longer you hold an island, the more valuable your troops. Think strategically about where you want to send your sailors and pilots. Enemies abound on the high seas, you guys...",
                    "game_url"      : "http://games.gamedistribution.com/Colonial-Wars-Special-Edition",
                    "category"      : "Strategy",
                    "name"          : "Colonial Wars Special Edition",
                    "priority"      : 1,
                    "height"        : 480,
                    "swf_url"       : "http://swf.gamedistribution.com/921366048857.swf",
                    "largeThumbnail": {
                        "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/921366048857.jpg",
                        "height": 300,
                        "width" : 300
                    },
                    "width"         : 640,
                    "premium"       : false,
                    "id"            : "colonial_wars_special_edition"
                },
                "apple_boom"                       : {
                    "price"      : "1000",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/2d405b367158e3f12d7c1e31a96b3af3.jpg",
                            "height": 100,
                            "width" : 135
                        }
                    ],
                    "description": "Destroy apples by blowing up the angry hedgehogs in this fun filled physics puzzler! Use your skills to do insane maneuvers mid-air to get your hedgehogs as close to the apples as possible before you blow them to bits!",
                    "game_url"   : "http://games.gamedistribution.com/Apple-Boom",
                    "category"   : "Puzzle",
                    "name"       : "Apple Boom",
                    "priority"   : 1,
                    "height"     : 600,
                    "swf_url"    : "http://swf.gamedistribution.com/2d405b367158e3f12d7c1e31a96b3af3.swf",
                    "width"      : 800,
                    "premium"    : true,
                    "id"         : "apple_boom"
                },
                "ben10_moon_biker"                 : {
                    "price"      : "400",
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/1601361015628.jpg",
                            "height": 250,
                            "width" : 250
                        }
                    ],
                    "description": "Ben 10 is saving the milky way, but he needs your help! Get him so fast as you can on the other side of the Moon and save our universe.",
                    "game_url"   : "http://games.gamedistribution.com/Ben10-Moon-Biker",
                    "category"   : "Ben 10",
                    "name"       : "Ben10 Moon Biker",
                    "priority"   : 5,
                    "height"     : 400,
                    "swf_url"    : "http://swf.gamedistribution.com/1601361015628.swf",
                    "width"      : 600,
                    "premium"    : false,
                    "id"         : "ben10_moon_biker"
                },
                "zombie_takedown"                  : {
                    "hot"        : true,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/5227b6aaf294f5f027273aebf16015f2.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Zombie Takedown is a First Person Shooter game. Its a zombie killing action game with lots of guns to upgrade like shotguns, assault rifles, machine guns, sniper guns and many more. You get in-game weapons like time bombs, grenades and c4 to explode the zombies. Play the game in three modes - easy, normal and hard. Achieve and unlock new achievements after each level. Unlock bonus points for headshots. Beware of the dead city zombies and animals attacking you! Reclaim your lost city! Get ready for the action!",
                    "game_url"   : "http://games.gamedistribution.com/Zombie-Takedown",
                    "category"   : "Shooting",
                    "name"       : "Zombie Takedown",
                    "priority"   : 80,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/5227b6aaf294f5f027273aebf16015f2.swf",
                    "width"      : 800,
                    "id"         : "zombie_takedown"
                },
                "endless_war_5"                    : {
                    "voteUp"        : 1,
                    "hot"           : true,
                    "source"        : "swf",
                    "thumbnails"    : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/11342391189.jpg",
                            "height": 572,
                            "width" : 795
                        }
                    ],
                    "description"   : "The fifth instalment of Endless War series brings you to a large scale tank warfare. You wouldn’t be able to control a singe soldier, instead you’ll be choosing from 11 different tanks, armored cars and self-propelled guns.<br/>Prepare to face over 25 types of enemies, including tanks, pillboxes, infantry, cannons, howitzers and so on.",
                    "game_url"      : "http://games.gamedistribution.com/Endless-War-5",
                    "category"      : "Action",
                    "name"          : "Endless War 5",
                    "priority"      : 8,
                    "height"        : 600,
                    "swf_url"       : "http://swf.gamedistribution.com/11342391189.swf",
                    "largeThumbnail": {
                        "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/11342391189.jpg",
                        "height": 572,
                        "width" : 795
                    },
                    "width"         : 800,
                    "id"            : "endless_war_5"
                },
                "Disappearing Path"                : {
                    "hot"        : false,
                    "source"     : "swf",
                    "description": "Create a path to guide the ball to the flag in each level, but hurry - the path won't stay for long!",
                    "thumbnails" : [
                        {
                            "url"   : "http://s3.amazonaws.com/www.mojo-games.com/games/disappearingpath/100x100.png",
                            "height": 120,
                            "width" : 120
                        }
                    ],
                    "category"   : "Strategy",
                    "name"       : "Disappearing Path",
                    "priority"   : 2,
                    "height"     : 640,
                    "swf_url"    : "http://s3.amazonaws.com/www.mojo-games.com/games/disappearingpath/disappearingpath.swf",
                    "width"      : 480,
                    "id"         : "Disappearing Path"
                },
                "robot_go_home"                    : {
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/6a81681a7af700c6385d36577ebec359.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "Help this lost little robot find his way home. Make your way through this puzzle, point and click adventure. Navigate through electric beans, lifts and more in order to help the robot get home",
                    "game_url"   : "http://games.gamedistribution.com/Robot-Go-Home",
                    "category"   : "Puzzle",
                    "name"       : "Robot Go Home",
                    "priority"   : 32,
                    "height"     : 500,
                    "swf_url"    : "http://swf.gamedistribution.com/6a81681a7af700c6385d36577ebec359.swf",
                    "width"      : 700,
                    "id"         : "robot_go_home"
                },
                "battlefield_medic"                : {
                    "price"      : "700",
                    "voteUp"     : 1,
                    "source"     : "swf",
                    "thumbnails" : [
                        {
                            "url"   : "//s3.amazonaws.com/www.mojo-games.com/img/games/8d420fa35754d1f1c19969c88780314d.jpg",
                            "height": 135,
                            "width" : 180
                        }
                    ],
                    "description": "During World War 2 the medics on the battlefield had to get supplies to and from battle during some of the worst battles ever. Now is your chance to show your ability to get to your destination. Upgrade your car with better engines, wheels, fuel, armor and more in order to fight your way through enemy forces.",
                    "game_url"   : "http://games.gamedistribution.com/Battlefield-Medic",
                    "category"   : "Action",
                    "name"       : "Battlefield Medic",
                    "priority"   : 40,
                    "height"     : 480,
                    "swf_url"    : "http://swf.gamedistribution.com/8d420fa35754d1f1c19969c88780314d.swf",
                    "width"      : 720,
                    "premium"    : false,
                    "id"         : "battlefield_medic"
                }
            };
        }
    ]);
