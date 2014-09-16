/*
 * main module
 */
angular.module('myApp', [
    'aio.main', 'aio.settings', 'aio.analytics', 'aio.games', 'aio.firebase', 'wu.masonry',
    'ui.router', 'ngSanitize', 'aio.counter', 'angularjs.media.directives', 'infinite-scroll',
    'aio.win', 'aio.leaderboard', 'aio.facebook', 'aio.config', 'aio.chrome', 'aio.common', 'ui.bootstrap',
    'pascalprecht.translate'
]).config(['$stateProvider', '$urlRouterProvider', '$sceDelegateProvider',
    function ($stateProvider, $urlRouterProvider, $sceDelegateProvider) {
        $urlRouterProvider.otherwise('/');

        $stateProvider
            .state('main', {
                url: '/:overlayID',
                templateUrl: 'main.html'
            })
            .state('game', {
                url: '/games/:gameID',
                templateUrl: 'game.html',
                controller: 'GameCtrl'
            }).state('editGame', {
                url: '/games/:gameID/edit',
                templateUrl: 'edit-game.html',
                controller: 'EditGameCtrl'
            });

        $sceDelegateProvider.resourceUrlWhitelist([
            // Allow same origin resource loads.
            'self',
            'http://**',
            // Allow loading from our assets domain.  Notice the difference between * and **.
            'http://cdn1.kongcdn.com/**',
            'http://ads.ad4game.com/www/**',
            'http://e.miniclip.com/**',
            'http://external.kongregate-games.com/**',
            'http://external.kongregate-games.com/**',
            'http://static.miniclip.com/**',
            'http://swf.gamedistribution.com/**',
            'http://www.miniclip.com/**',
            'http://www.myplayyard.com/**'
        ]);
    }
]).config(['$translateProvider',
    function ($translateProvider) {
        $translateProvider.translations('en', {
            'FIND_GAME': 'Find A Game',
            'COINS_COLLECTED': 'coins collected',
            'CONNECT': 'Connect',
            'SIGNOUT': 'Sign Out',
            'WIN_FREE_COINS': 'Win Free Coins!',
            'JOIN_NOW': 'Join Now',
            'SIGNIN_TO_GET': 'Sign In To Get',
            'GET': 'Get',
            'GET_COINS': 'Get Coins',
            'INVITE_FRIENDS': 'Invite Friends',
            'PLAY_ANOTHER_GAME': 'Play Another Game',
            'PLAY_ON_CHROME': 'Play On Chrome'
        }).translations('es', {
            'FIND_GAME': 'Busca un Juego',
            'COINS_COLLECTED': 'monedas recogidas',
            'CONNECT': 'Conectar',
            'SIGNOUT': 'Salir',
            'WIN_FREE_COINS': 'Gana monedas gratis!',
            'JOIN_NOW': 'Únete ahora',
            'SIGNIN_TO_GET': 'Identifícate para recibir',
            'GET': 'Obtener',
            'GET_COINS': 'Obtén monedas',
            'INVITE_FRIENDS': 'Invite a los amigos',
            'PLAY_ANOTHER_GAME': 'Jugar a otro juego',
            'PLAY_ON_CHROME': 'Juega en el cromo'
        }).translations('he', {
            'FIND_GAME': 'מצא משחק',
            'COINS_COLLECTED': 'מטבעות שצברת',
            'CONNECT': 'התחבר',
            'SIGNOUT': 'התנתק',
            'WIN_FREE_COINS': 'קבל מטבעות בחינם',
            'JOIN_NOW': 'הצטרף עכשיו',
            'SIGNIN_TO_GET': 'התחבר כדי לקבל',
            'GET': 'קבל',
            'GET_COINS': 'קבל מטבעות',
            'INVITE_FRIENDS': 'הזמן חברים',
            'PLAY_ANOTHER_GAME': 'שחק משחק נוסף',
            'PLAY_ON_CHROME': 'שחק ב- Chrome'
        }).translations('pt', {
            'FIND_GAME': 'encontrar um Jogo',
            'COINS_COLLECTED': 'moedas coletadas',
            'CONNECT': 'Conectar',
            'SIGNOUT': 'Sair',
            'WIN_FREE_COINS': 'Ganhe moedas de livre!',
            'JOIN_NOW': 'Cadastre-se agora',
            'SIGNIN_TO_GET': 'Entrar para obter',
            'GET': 'obter',
            'GET_COINS': 'Obter moedas',
            'INVITE_FRIENDS': 'Convidar amigos',
            'PLAY_ANOTHER_GAME': 'Jogue mais um jogo',
            'PLAY_ON_CHROME': 'Jogue no chrome'
        }).translations('de', {
            'FIND_GAME': 'Finden Sie ein Spiel',
            'COINS_COLLECTED': 'münzen gesammelt',
            'CONNECT': 'Verbinden',
            'SIGNOUT': 'austragen',
            'WIN_FREE_COINS': 'Gana monedas gratis!',
            'JOIN_NOW': 'Werden Sie jetzt Mitglied',
            'SIGNIN_TO_GET': 'Anmelden, um zu erhalten',
            'GET': 'Erhalten',
            'GET_COINS': 'Holen Münzen',
            'INVITE_FRIENDS': 'Freunde einladen',
            'PLAY_ANOTHER_GAME': 'Ein anderes Spiel spielen',
            'PLAY_ON_CHROME': 'Spielen Sie auf chrome'
        }).translations('fr', {
            'FIND_GAME': 'trouver un jeu',
            'COINS_COLLECTED': 'pièces collectées',
            'CONNECT': 'Relier',
            'SIGNOUT': 'Déconnexion',
            'WIN_FREE_COINS': 'Gagner des pièces libres!',
            'JOIN_NOW': 'Inscris-toi maintenant',
            'SIGNIN_TO_GET': 'Enregistrez-vous pour obtenir',
            'GET': 'Obtenir',
            'GET_COINS': 'Obtenir des pièces',
            'INVITE_FRIENDS': 'Invitez vos amis',
            'PLAY_ANOTHER_GAME': 'Jouer un autre jeu',
            'PLAY_ON_CHROME': 'Jouer sur le chrome'
        }).translations('pl', {
            'FIND_GAME': 'Znajdź grę',
            'COINS_COLLECTED': 'Monety zebrane',
            'CONNECT': 'Połączyć',
            'SIGNOUT': 'Zaloguj się',
            'WIN_FREE_COINS': 'Wygraj darmowe monety!',
            'JOIN_NOW': 'Dołącz teraz',
            'SIGNIN_TO_GET': 'Zaloguj się, aby uzyskać',
            'GET': 'Dostać',
            'GET_COINS': 'Zdobądź monety',
            'INVITE_FRIENDS': 'Zaproś przyjaciół',
            'PLAY_ANOTHER_GAME': 'Grać w inną grę',
            'PLAY_ON_CHROME': 'Jugar en Chrome'
        }).preferredLanguage('en');
    }
]);

(function (i, s, o, g, r, a, m) {
    i['GoogleAnalyticsObject'] = r;
    i[r] = i[r] || function () {
        (i[r].q = i[r].q || []).push(arguments)
    }, i[r].l = 1 * new Date();
    a = s.createElement(o),
    m = s.getElementsByTagName(o)[0];
    a.async = 1;
    a.src = g;
    m.parentNode.insertBefore(a, m)
})(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');
