/**
 * services/auth.service.js — JWT token storage and user state.
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .service('AuthService', ['$window', '$rootScope', function ($window, $rootScope) {
      const TOKEN_KEY = 'ab_token';
      const USER_KEY  = 'ab_user';

      this.getToken = function () {
        return $window.localStorage.getItem(TOKEN_KEY);
      };

      this.getUser = function () {
        if (!this.getToken()) return null;
        const u = $window.localStorage.getItem(USER_KEY);
        try { return u ? JSON.parse(u) : null; } catch (e) { return null; }
      };

      this.setSession = function (token, user) {
        $window.localStorage.setItem(TOKEN_KEY, token);
        $window.localStorage.setItem(USER_KEY, JSON.stringify(user));
        $rootScope.$broadcast('auth:login', user);
      };

      this.logout = function () {
        $window.localStorage.removeItem(TOKEN_KEY);
        $window.localStorage.removeItem(USER_KEY);
        $rootScope.$broadcast('auth:logout');
      };

      this.isLoggedIn = function () {
        return !!this.getToken();
      };
    }]);

}());
