/**
 * controllers/nav.controller.js — Top navigation controller.
 */
(function () {
  'use strict';
  angular.module('autoBid')
    .controller('NavCtrl', ['AuthService', '$rootScope', '$location', function (AuthService, $rootScope, $location) {
      const vm = this;
      vm.user     = AuthService.getUser();
      vm.menuOpen = false;

      $rootScope.$on('auth:login',  function (e, user) { vm.user = user; });
      $rootScope.$on('auth:logout', function ()         { vm.user = null; });
      $rootScope.$on('$routeChangeSuccess', function () { vm.menuOpen = false; });

      vm.logout = function () {
        AuthService.logout();
        $location.path('/');
      };
    }]);
}());
