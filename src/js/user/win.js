var winModule = winModule || angular.module('aio.win', []);

winModule.controller('WinCtrl', ['$scope', 'Facebook', 'Win', 'Chrome',
    function ($scope, Facebook, Win, Chrome) {

        //true if user has app installed
        $scope.isChromeInstalled = Chrome.isAppInstalled();

        //expose point amounts to scope
        $scope.points = Win.points;

        $scope.inviteFBFriends = function () {
            Win.winFacebookInvite().then(function () {
                console.log('succesfully shared to friends');
            }).
            catch (function (msg) {
                console.warn('Problem sharing to friends', msg);
                $scope.closeOverlay('WIN_COINS');
            });
        };

        $scope.connectNow = function () {
            $scope.login().then(function () {
                $scope.closeOverlay('WIN_COINS');
            });
        };

        $scope.installChromeApp = function () {
            //make sure app isn't installed safety
            if (!$scope.isChromeInstalled) {
                console.log('offer to download extension');
                //install app then add points
                Win.winChromeApp().then(function () {
                    console.log('success install');
                }, function (e) {
                    console.warn('error install', e);
                    $scope.closeOverlay('WIN_COINS');
                });
            }
        };

    }
]).factory('Win', ['$rootScope', 'Facebook', 'Firebase', 'Config', 'Chrome',
    function ($rootScope, Facebook, Firebase, Config, Chrome) {
        var points = {
            fbInvite: Config.POINTS.FACEBOOK_INVITE,
            chromeInstall: Config.POINTS.CHROME_APP_INSTALL,
            newGame: Config.POINTS.PLAY_NEW_GAME,
            fbConnect: Config.POINTS.FACEBOOK_CONNET
        };

        return {
            points: points,
            winPlayAnotherGame: function () {
                return Firebase.raisePoints(points.newGame);
            },
            winFacebookInvite: function () {
                return Facebook.inviteFriends().then(function () {
                    return Firebase.raisePoints(points.fbInvite);
                });
            },

            winChromeApp: function () {
                return Chrome.installApp().then(function () {
                    return Firebase.raisePoints(points.chromeInstall);
                });
            }
        };
    }
]);
