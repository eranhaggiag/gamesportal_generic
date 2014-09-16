var counterModule = counterModule || angular.module('aio.counter', []);

counterModule.directive('aioCounter', ['$filter',
    function ($filter) {
        return function (scope, element, attrs) {
            var oldVal, countingInterval = 8,
                subAmount = 1,
                countingDuration = 1000;

            var doCount = function (newVal, calcInterval) {
                var subABS = Math.abs(newVal - oldVal);
                if (calcInterval) {
                    subAmount = 10;
                    if (subABS > 0) {
                        countingInterval = countingDuration / subABS;
                        if (countingDuration < 1) {
                            subAmount = 10;
                            countingInterval = countingDuration / subAmount;
                        }
                    }
                }

                if (subABS < subAmount) subAmount = subABS;
                if (oldVal === newVal) {
                    element.removeClass('counting');
                } else if (oldVal > newVal) {

                    applyVal(parseInt(oldVal) - subAmount);
                    setTimeout(function () {
                        doCount(newVal);
                    }, countingInterval);
                } else if (oldVal < newVal) {
                    element.addClass('counting');
                    applyVal(parseInt(oldVal) + subAmount);

                    setTimeout(function () {
                        doCount(newVal);
                    }, countingInterval);
                }
            };

            var applyVal = function (newVal) {
                oldVal = newVal;
                element.text((newVal));
            };

            attrs.$observe('aioCounter', function (newVal) {
                if (oldVal) {
                    doCount(newVal, true);
                } else {
                    applyVal(newVal);
                }
            });
        };
    }
]);
