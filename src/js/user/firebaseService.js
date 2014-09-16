/* global FirebaseSimpleLogin, Firebase */
var firebaseModule = firebaseModule || angular.module('aio.firebase', []);

firebaseModule.factory('Firebase', ['$rootScope', '$log', '$q', '$timeout', '$http', 'Config',
    function ($rootScope, $log, $q, $timeout, $http, Config) {

        var giveAwayPoints = Config.POINTS.GIVE_AWAY, // user's initial coins
            data = {}, // holds the user object while app is running
            initting = $q.defer(), // initializing defer
            ready = false, // whether app was initialized
            ref = new Firebase(Config.FIREBASE_URL), // basic firebase ref
            gamesRef = ref.child('games'),
            userRef, //user ref
            leaderboardRef, // leaderboard ref
            leaderboardData = {}; // leaderboard data

        // init auth ref and callback
        var auth = new FirebaseSimpleLogin(ref, function (error, user) {
            $rootScope.$apply(function () {
                if (error) {
                    // an error occurred while attempting login
                    console.warn('[FIREBASE]:auth error', error);
                    if (!ready) {
                        ready = true;
                        initting.reject();
                    }
                } else if (user) {
                    // user authenticated with Firebase
                    onLogin(user);
                    // console.debug('[FIREBASE]:logged in', user);
                } else {
                    // user is logged out
                    onLogout();
                    console.debug('[FIREBASE]:user is not logged in.');
                }
            });
        });

        /**
         * on successful login callback
         * get & initialize user object,
         * if new user give initial coins.
         * setup user's info
         * @param user
         */
        var onLogin = function (user) {
            data.loginUser = user;
            var info;
            userRef = ref.child('users').child(user.id);

            userRef.once('value', function (userSnap) {
                var userVal = userSnap.val();
                if (!userVal) {
                    info = infoFromLoginObject(user);

                    user = {
                        points: giveAwayPoints,
                        info: info
                    };

                    userRef.set(user);

                } else if (!userVal.info || !validateInfo(userVal.info)) {
                    console.log('here');
                    userVal.info = infoFromLoginObject(user);
                    userRef.set(userVal);
                }

                $rootScope.$apply(function () {
                    data.user = userVal;
                    if (!ready) {
                        ready = true;
                        initting.resolve();
                    }
                });
            });
        };

        /**
         * build user's info object from user login object
         * @param loginObject
         * @returns BOOL
         */
        var validateInfo = function (userInfo) {
            return userInfo.id && userInfo.displayName && userInfo.name && userInfo.profilePic;
        };

        /**
         * build user's info object from user login object
         * @param loginObject
         * @returns {{id: (*|id|id|id|id|id), displayName: *, name: (*|name|name|name|name|name)}}
         */
        var infoFromLoginObject = function (loginObject) {
            var firstName = loginObject.first_name || loginObject.name.split(' ')[0];
            return {
                id: loginObject.id,
                displayName: firstName,
                name: loginObject.name,
                profilePic: 'http://graph.facebook.com/' + loginObject.id + '/picture'
            };
        };

        /**
         * on logout, reset user object
         */
        var onLogout = function () {
            data.user = null;
            if (!ready) {
                ready = true;
                initting.resolve();
            }
        };

        return {

            /**
             * return init promise
             * @returns {Function|promise|promise}
             */
            initting: function () {
                return initting.promise;
            },

            /**
             * return basic ref
             * @returns {Firebase}
             */
            ref: function () {
                return ref;
            },

            /**
             * handle FB js sdk auth response
             * @returns {*}
             */
            handleFBAuth: function (response) {
                if (response.status === 'connected') {
                    console.info('connected to fb');
                    auth.login('facebook', {
                        access_token: response.authResponse.accessToken,
                        rememberMe: true,
                        scope: 'email'
                    });
                } else if (response.status === 'not_authorized') {
                    console.warn('not authorized for fb login');
                } else {
                    console.warn('unknown login response from fb', response);
                }
            },

            /**
             * log the user out
             * @returns {*}
             */
            logout: function () {
                return auth.logout();
            },

            /**
             * returns user data object
             * @returns {{}}
             */
            userData: function () {
                return data;
            },

            /**
             * raise points by amount
             * TODO: refresh point from server
             * @param amount
             */
            raisePoints: function (amount) {
                initting.promise.then(function () {
                    if (data.user) {
                        var points = data.user.points || 0;
                        points += amount || 0;
                        data.user.points = points;
                        userRef.child('points').set(points);
                    }
                });
            },

            /**
             * check if user has access to premium game
             * @param game
             * @returns {*}
             */
            checkAccessToGame: function (game) {
                return initting.promise.then(function () {
                    if (!game.premium) {
                        return true;
                    }

                    return data.user && data.user.info && data.user.unlockedGames && _.contains(data.user.unlockedGames, game.id);
                });
            },

            /**
             * unlock game and substract the amount of coins from the user's points
             * @param game
             * @returns {Function|promise|promise}
             */
            unlockGame: function (game) {
                var defer = $q.defer();
                if (data.user.points < game.price) {
                    defer.reject('NO_COINS');
                } else {
                    userRef.once('value', function (userSnap) {
                        $rootScope.$apply(function () {
                            if (!userSnap) {
                                return defer.reject('SERVER_ERROR');
                            }

                            var val = userSnap.val(),
                                points = val.points || 0,
                                unlockedGames = val.unlockedGames || [];
                            if (val.points < game.price) {
                                return defer.reject('NO_COINS');
                            } else {
                                points -= game.price;
                                val.points = points;
                                userRef.child('points').set(points);
                                if (unlockedGames.indexOf(game.id) === -1) unlockedGames.push(game.id);
                                userRef.child('unlockedGames').set(unlockedGames);
                                data.user = angular.extend(val);
                                defer.resolve();
                            }
                        });
                    });
                }
                return defer.promise;
            },

            /**
             * initializes the leaderboard listener
             */
            initLeaderboard: function () {
                var defer = $q.defer();
                var ready = false;
                leaderboardRef = leaderboardRef || ref.child('leaderboard');
                leaderboardRef.on('value', function (leaderboardSnap) {
                    $rootScope.$apply(function () {
                        leaderboardData.value = leaderboardSnap.val();
                        if (!ready) {
                            ready = true;
                            defer.resolve(leaderboardData);
                        }

                    });
                });

                return defer.promise;
            },

            /**
             * close the leaderboard listener
             */
            closeLeaderboard: function () {
                if (leaderboardRef) {
                    leaderboardRef.off('value');
                }
            },

            changeGameRating: function (game, side, done) {
                game = angular.copy(game);
                var tempRef = gamesRef.child(game.id).child(side);
                return tempRef.transaction(function (current_value) {
                    return current_value + 1;
                }, done);
            },

            /**
             * get games list
             * @returns {Function|promise|promise|promise}
             */
            getGames: function () {
                var defer = $q.defer();
                var gamesRefFunc = gamesRef;

                gamesRefFunc.on('value', function (gamesSnap) {
                    $rootScope.$apply(function () {
                        console.info('Queried from DB', _.size(gamesSnap.val()));
                        defer.resolve(gamesSnap.val());
                    });
                });

                return defer.promise;
            },

            setGameWithPriority: function (game, done) {
                game = angular.copy(game);
                var tempRef = gamesRef.child(game.id);
                tempRef.setWithPriority(game, game.priority, done);
            }
        };
    }
]);
