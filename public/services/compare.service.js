/**
 * services/compare.service.js
 * Compare Lab service — stores up to 4 car IDs in sessionStorage.
 *
 * BUG GUARD: Cap check uses `ids.length < MAX` (not <=) to correctly enforce max of 4.
 * Using <= would allow a 5th item (off-by-one bug class 4 in tests).
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .service('CompareService', ['$window', '$rootScope', function ($window, $rootScope) {
      const KEY = 'ab_compare';
      const MAX_COMPARE = 4; // NEVER use <= in the cap check below

      this.getIds = function () {
        const raw = $window.sessionStorage.getItem(KEY);
        try { return raw ? JSON.parse(raw) : []; } catch { return []; }
      };

      this.add = function (id) {
        const ids = this.getIds();
        if (ids.includes(id)) return { ok: false, reason: 'already_added' };
        // BUG GUARD: < MAX (not <=) — correct cap check
        if (ids.length < MAX_COMPARE) {
          ids.push(id);
          $window.sessionStorage.setItem(KEY, JSON.stringify(ids));
          $rootScope.$broadcast('compare:changed', ids);
          return { ok: true };
        }
        return { ok: false, reason: 'max_reached' };
      };

      this.remove = function (id) {
        const ids = this.getIds().filter(x => x !== id);
        $window.sessionStorage.setItem(KEY, JSON.stringify(ids));
        $rootScope.$broadcast('compare:changed', ids);
      };

      this.clear = function () {
        $window.sessionStorage.removeItem(KEY);
        $rootScope.$broadcast('compare:changed', []);
      };

      this.count = function () {
        return this.getIds().length;
      };
    }]);

}());
