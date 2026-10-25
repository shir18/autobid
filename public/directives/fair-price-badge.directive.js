/**
 * directives/fair-price-badge.directive.js
 * Shows a colored "Great deal / Fair / Above market" badge from the Express
 * /api/cars/:id/fair-price endpoint. If the request fails the badge is simply hidden.
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .directive('fairPriceBadge', ['ApiService', function (ApiService) {
      return {
        restrict: 'E',
        scope: { listingId: '=', price: '=' },
        template: `
          <span ng-if="badge" class="fair-price-badge" ng-class="badgeClass" title="{{detail}}">
            {{badge}}
          </span>`,
        link: function (scope) {
          scope.$watch('listingId', function (id) {
            scope.badge = null;
            if (!id) return;
            ApiService.getFairPrice(id).then(function (d) {
              scope.badge = d.label;
              scope.detail = d.detail + ' (' + (d.method === 'ml' ? 'ML fair value' : 'market median') + ' ₹' + Number(d.median_price).toLocaleString('en-IN') + (d.range_low ? ', likely range ₹' + Number(d.range_low).toLocaleString('en-IN') + '–₹' + Number(d.range_high).toLocaleString('en-IN') : '') + ', ' + d.basis + ')';
              scope.badgeClass = {
                'badge-great': d.label === 'Great deal',
                'badge-fair':  d.label === 'Fair',
                'badge-above': d.label === 'Above market'
              };
            }).catch(function () { scope.badge = null; });
          });
        }
      };
    }]);
}());
