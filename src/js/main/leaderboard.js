var leaderboardModule = leaderboardModule || angular.module('aio.leaderboard', ['aio.firebase']);

leaderboardModule.controller('LeaderboardCtrl', ['$scope', 'Firebase',
    function ($scope, Firebase) {

        Firebase.initLeaderboard().then(function (leaderboardData) {
            $scope.leaderboardData = leaderboardData;
        });

        $scope.$on('$destroy', function () {
            Firebase.closeLeaderboard();
        });
    }
]);
