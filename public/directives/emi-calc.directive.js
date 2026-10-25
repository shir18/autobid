/**
 * directives/emi-calc.directive.js
 * EMI Calculator directive — embeddable on any page.
 * Formula: EMI = P * r * (1+r)^n / ((1+r)^n - 1)
 * The calculator follows the `base-price` attribute (e.g. when another variant is selected).
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .directive('emiCalc', function () {
      return {
        restrict: 'E',
        scope: { basePrice: '=' },
        template: `
          <div class="emi-calc">
            <h4>EMI Calculator</h4>
            <div class="emi-row">
              <label>Vehicle price: <strong>{{ctrl.inr(ctrl.price)}}</strong></label>
            </div>
            <div class="emi-row">
              <label>Down Payment: <strong>{{ctrl.inr(ctrl.down)}}</strong></label>
              <input type="range" ng-model="ctrl.down" min="0" ng-attr-max="{{ctrl.price}}" step="10000" ng-change="ctrl.calc()">
            </div>
            <div class="emi-row">
              <label>Interest Rate: <strong>{{ctrl.rate}}%</strong></label>
              <input type="range" ng-model="ctrl.rate" min="6" max="18" step="0.1" ng-change="ctrl.calc()">
            </div>
            <div class="emi-row">
              <label>Tenure: <strong>{{ctrl.tenure}} months</strong></label>
              <input type="range" ng-model="ctrl.tenure" min="12" max="84" step="6" ng-change="ctrl.calc()">
            </div>
            <div class="emi-result" ng-if="ctrl.emi">
              <span class="emi-label">Monthly EMI</span>
              <span class="emi-value">{{ctrl.inr(ctrl.emi)}}</span>
              <span class="emi-sub">Total: {{ctrl.inr(ctrl.total)}} (Interest: {{ctrl.inr(ctrl.interest)}})</span>
            </div>
            <div class="emi-result" ng-if="!ctrl.emi">
              <span class="emi-label">Monthly EMI</span>
              <span class="emi-value">No loan needed</span>
            </div>
          </div>`,
        controllerAs: 'ctrl',
        bindToController: true,
        controller: ['$filter', function ($filter) {
          const vm = this;
          vm.inr    = $filter('inr');
          vm.price  = 0;
          vm.down   = 0;
          vm.rate   = 9.0;
          vm.tenure = 60;
          let lastBase = null;

          function sync() {
            const base = Number(vm.basePrice) || 1000000;
            if (base !== lastBase) {          // price changed (first load or another variant)
              lastBase = base;
              vm.price = base;
              vm.down  = Math.round(base * 0.2 / 10000) * 10000;
              vm.calc();
            }
          }
          vm.$onInit  = sync;
          vm.$doCheck = sync;                 // '=' bindings don't fire $onChanges, so poll the value

          vm.calc = function () {
            const down = Math.min(Number(vm.down) || 0, vm.price);
            const P = vm.price - down;
            const r = Number(vm.rate) / 100 / 12;
            const n = Number(vm.tenure);
            if (P <= 0 || r <= 0 || n <= 0) { vm.emi = 0; return; }
            const emi = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
            vm.emi      = Math.round(emi);
            vm.total    = Math.round(emi * n);
            vm.interest = vm.total - P;
          };
        }]
      };
    });
}());
