/**
 * services/util.service.js — small helpers shared by controllers.
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .service('Util', function () {
      /** Date (from <input type="date">) or string → local "YYYY-MM-DD" (no timezone shift). */
      this.dateOnly = function (d) {
        if (!d) return '';
        if (typeof d === 'string') return d.slice(0, 10);
        const p = n => (n < 10 ? '0' : '') + n;
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      };
      /** Today as "YYYY-MM-DD" (for min= on date inputs). */
      this.today = function () { return this.dateOnly(new Date()); };
      /** "2026-10-04" → Date at local midnight, so the date filter prints the same day. */
      this.parseDate = function (s) {
        if (!s) return null;
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
        return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
      };
    });
}());
