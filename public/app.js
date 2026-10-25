/**
 * app.js — AngularJS module definition and route configuration.
 * Pattern: controllerAs 'vm', ngRoute for SPA routing.
 */
(function () {
  'use strict';

  angular.module('autoBid', ['ngRoute'])
    .config(['$routeProvider', '$locationProvider', function ($routeProvider, $locationProvider) {

      $routeProvider
        .when('/', {
          templateUrl: '/templates/home.html',
          controller:  'HomeCtrl',
          controllerAs: 'vm'
        })
        .when('/new-cars', {
          templateUrl: '/templates/newcars.html',
          controller:  'NewCarsCtrl',
          controllerAs: 'vm'
        })
        .when('/new-cars/:id', {
          templateUrl: '/templates/cardetail.html',
          controller:  'CarDetailCtrl',
          controllerAs: 'vm',
          reloadOnSearch: false          // picking a variant only updates ?variant=…, no page reload
        })
        .when('/used-cars', {
          templateUrl: '/templates/usedcars.html',
          controller:  'UsedCarsCtrl',
          controllerAs: 'vm'
        })
        .when('/compare', {
          templateUrl: '/templates/compare.html',
          controller:  'CompareCtrl',
          controllerAs: 'vm'
        })
        .when('/dealers', {
          templateUrl: '/templates/dealers.html',
          controller:  'DealerCtrl',
          controllerAs: 'vm'
        })
        .when('/login', {
          templateUrl: '/templates/login.html',
          controller:  'AuthCtrl',
          controllerAs: 'vm'
        })
        .when('/register', {
          templateUrl: '/templates/register.html',
          controller:  'AuthCtrl',
          controllerAs: 'vm'
        })
        .when('/buyer', {
          templateUrl: '/templates/buyer.html',
          controller:  'BuyerCtrl',
          controllerAs: 'vm'
        })
        .when('/dealer-dash', {
          templateUrl: '/templates/dealerdash.html',
          controller:  'DealerDashCtrl',
          controllerAs: 'vm'
        })
        .when('/quiz', {
          templateUrl: '/templates/quiz.html',
          controller:  'QuizCtrl',
          controllerAs: 'vm'
        })
        .when('/tco', {
          templateUrl: '/templates/tco.html',
          controller:  'TcoCtrl',
          controllerAs: 'vm'
        })
        .when('/chat', {
          templateUrl: '/templates/chat.html',
          controller:  'ChatCtrl',
          controllerAs: 'vm'
        })
        .when('/admin', {
          templateUrl: '/templates/admin.html',
          controller:  'AdminCtrl',
          controllerAs: 'vm'
        })
        .when('/xml-lab', {
          templateUrl: '/templates/xmllab.html',
          controller:  'XmlLabCtrl',
          controllerAs: 'vm'
        })
        .otherwise({ redirectTo: '/' });
    }])
    // Scroll to top on every page change; toast helper for the whole app
    .run(['$rootScope', '$window', function ($rootScope, $window) {
      $rootScope.$on('$routeChangeSuccess', function () { $window.scrollTo(0, 0); });
    }]);

}());
