/* global FB */
var facebookModule = facebookModule || angular.module('aio.facebook', []);

facebookModule.factory('Facebook', ['$rootScope', '$log', '$q', '$timeout', '$http', 'Firebase', 'Config',
    function ($rootScope, $log, $q, $timeout, $http, Firebase, Config) {

        if (typeof FB === 'undefined' || !FB.init) {
            $timeout(function () {
                $.getScript('//connect.facebook.net/en_US/all.js', function () {
                    FB.init({
                        appId: Config.FACEBOOK_APP_ID,
                        status: false, // check login status
                        cookie: true, // enable cookies to allow the server to access the session
                        xfbml: false // parse XFBML
                    });
                    FB.Event.subscribe('auth.authResponseChange', Firebase.handleFBAuth);
                });
            }, 500);
        }
        return {
            inviteFriends: function () {
                var defer = $q.defer();
                FB.ui({
                        method: 'feed',
                        name: Config.INVITE_FRIENDS_POST.NAME,
                        caption: Config.INVITE_FRIENDS_POST.CAPTION,
                        description: Config.INVITE_FRIENDS_POST.DESCRIPTION,
                        link: Config.INVITE_FRIENDS_POST.LINK,
                        picture: Config.INVITE_FRIENDS_POST.PICTURE
                    },
                    function (response) {
                        $rootScope.$apply(function () {
                            if (response && response.post_id) {
                                defer.resolve(response);
                            } else {
                                defer.reject('Post was not published.');
                            }
                        });
                    }
                );

                return defer.promise;
            },
            login: function () {
                var defer = $q.defer();
                FB.login(function (response) {
                    $rootScope.$apply(function () {
                        if (response.status === 'connected') {
                            defer.resolve();
                        } else {
                            defer.reject(['Could not login', response]);
                        }
                    });
                });
                return defer.promise;
            }
        };
    }
]);
