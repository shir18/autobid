/**
 * filters/status.filter.js
 * BUG GUARD: countByStatus normalizes to lowercase before comparing (bug class 3).
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .filter('statusLabel', function () {
      const map = {
        'open':      'Open',
        'awarded':   'Awarded',
        'closed':    'Closed',
        'pending':   'Pending',
        'accepted':  'Accepted',
        'rejected':  'Rejected',
        'confirmed': 'Confirmed',
        'delivered': 'Delivered',
        'cancelled': 'Cancelled',
        'available': 'Available',
        'sold':      'Sold',
        'reserved':  'Reserved'
      };
      return function (val) {
        if (!val) return '';
        // BUG GUARD: normalize to lowercase before lookup (bug class 3: case-sensitivity)
        return map[val.toLowerCase()] || val;
      };
    })
    .filter('statusClass', function () {
      const map = {
        'open':      'badge-green',
        'awarded':   'badge-blue',
        'closed':    'badge-grey',
        'pending':   'badge-yellow',
        'accepted':  'badge-green',
        'rejected':  'badge-red',
        'confirmed': 'badge-blue',
        'delivered': 'badge-green',
        'cancelled': 'badge-red',
        'available': 'badge-green',
        'sold':      'badge-grey',
        'reserved':  'badge-yellow'
      };
      return function (val) {
        if (!val) return '';
        return map[val.toLowerCase()] || 'badge-grey';
      };
    });

}());
