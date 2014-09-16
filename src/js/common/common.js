var commonModule = commonModule || angular.module('aio.common', []);

commonModule.directive('overlay', ['$rootScope',
        function ($rootScope) {
            return function (scope, element, attrs) {
                element.on('click',function () {
                    $rootScope.$apply(function () {
                        scope.closeOverlay(attrs.overlay);
                    });
                }).on('click', '.modal-dialog', function (e) {
                        e.stopPropagation();
                    });
            };
        }
    ]).directive('mojoHeader', ['$rootScope', '$window',
        function ($rootScope, $window) {
            return {
                restrict: 'A',
                scope   : {
                    isSmall: '=',
                    isFixed: '='
                },
                link    : function (scope, element, attrs) {
                    //make header small
                    var changeHeader = _.debounce(function () {
                        if (!scope.isFixed) {
                            return;
                        }
                        $rootScope.$apply(function () {
                            scope.isSmall = $window.scrollY > 10 || $window.pageYOffset > 10;
                            element.toggleClass('smaller', scope.isSmall);
                        });
                    }, 10);
                    angular.element($window).on('scroll', changeHeader);
                }
            };
        }
    ]).directive('adsenseAd', ['$compile',

        function ($compile) {
            var $elm = _.template('<ins class="adsbygoogle" style="display: inline-block; width: <%= width %>px; height: <%= height %>px;" data-ad-client="ca-pub-<%= pubId %>" data-ad-slot="<%= id %>"></ins>');
            return {
                restrict: 'E',
                replace : true,
                scope   : {
                    adSenseLoaded: '=',
                    adSlotId     : '@',
                    pubId        : '@',
                    adWidth      : '@',
                    adHeight     : '@'
                },
                link    : function (scope, element) {
                    window.unitLoaded = window.unitLoaded || {};
                    scope.$watch('adSenseLoaded', function () {
                        if (scope.adSenseLoaded) {
                            if (!window.unitLoaded[scope.adSlotId]) {
                                //create element html string
                                var _elm = $elm({
                                    id    : scope.adSlotId,
                                    width : scope.adWidth || 728,
                                    height: scope.adHeight || 90,
                                    pubId : scope.pubId || '4340706792144528'
                                });
                                //insert html to element
                                element.html(_elm);
                                //compile element and store it
                                window.unitLoaded[scope.adSlotId] = $compile(element.contents())(scope);
                                //only run this code once per banner
                                (adsbygoogle = window.adsbygoogle || []).push({});
                            } else {
                                element.replaceWith(window.unitLoaded[scope.adSlotId]);
                            }
                        }
                    });
                }
            };
        }
    ]).directive('adsenseAdAsync', ['$compile',
        function ($compile) {
            var $elm = _.template('<script type="text/javascript"><!-- google_ad_client = "ca-pub-<%= pubId %>";/* <%= adKind %> */google_ad_slot = "<%= id %>";google_ad_width = <%= width %>;google_ad_height = <%= height %>;//--></script><script type="text/javascript" src="//pagead2.googlesyndication.com/pagead/show_ads.js"></script>');
            return {
                restrict: 'E',
                replace : true,
                scope   : {
                    adSenseLoaded: '=',
                    adSlotId     : '@',
                    pubId        : '@',
                    adWidth      : '@',
                    adHeight     : '@',
                    adKind       : '@'
                },
                link    : function (scope, element) {
                    var _elm = $elm({
                        id    : scope.adSlotId,
                        width : scope.adWidth || 728,
                        height: scope.adHeight || 90,
                        pubId : scope.pubId || '4340706792144528',
                        adKind: scope.adKind || 'skyscrapers'
                    });
                    //insert html to element
                    element.html(_elm);
                }
            };
        }
    ]).service('geoLocation', ['$http', '$q',
        function ($http, $q) {
            var geolocation = function () {
                var GEOLOCATION_SERVICE_URL = 'http://ip-api.com/json';
                var deferred = $q.defer();

                function handleGeolocationRequest(result) {
                    if (result.data.status === 'success') {
                        deferred.resolve(result.data);
                    } else {
                        deferred.reject('status not success');
                    }
                }

                $http.get(GEOLOCATION_SERVICE_URL)
                    .then(handleGeolocationRequest).
                    catch(function () {
                    deferred.reject('no response');
                });

                return deferred.promise;
            };

            /**
             * Initialize module
             */
            return {
                geolocate: geolocation,
            };
        }
    ]);
