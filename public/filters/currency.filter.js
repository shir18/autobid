/**
 * filters/currency.filter.js — Indian Rupee formatting (₹1,23,456).
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .filter('inr', function () {
      return function (amount) {
        if (amount == null || isNaN(amount)) return '—';
        const n = Number(amount);
        // Indian number formatting (lakh/crore system)
        if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr';
        if (n >= 100000)   return '₹' + (n / 100000).toFixed(2) + ' L';
        return '₹' + n.toLocaleString('en-IN');
      };
    })
    .filter('inrFull', function () {
      return function (amount) {
        if (amount == null) return '—';
        return '₹' + Number(amount).toLocaleString('en-IN');
      };
    });

}());
