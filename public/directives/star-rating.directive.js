/**
 * directives/star-rating.directive.js — Read/write star rating component.
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .directive('starRating', function () {
      return {
        restrict: 'E',
        scope: { rating: '=', readonly: '=' },
        template: `
          <span class="stars">
            <span ng-repeat="s in [1,2,3,4,5]"
                  class="star"
                  ng-class="{'star-filled': s <= ctrl.rating, 'star-hover': !ctrl.readonly && s <= ctrl.hover}"
                  ng-mouseover="!ctrl.readonly && (ctrl.hover = s)"
                  ng-mouseleave="ctrl.hover = 0"
                  ng-click="!ctrl.readonly && ctrl.set(s)">★</span>
          </span>`,
        controllerAs: 'ctrl',
        bindToController: true,
        controller: function () {
          const vm = this;
          vm.hover = 0;
          vm.set = function (n) { vm.rating = n; };
        }
      };
    });
}());
