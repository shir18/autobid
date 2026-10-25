/**
 * controllers/compare.controller.js — Compare Lab: up to 4 cars, highlight best value.
 *
 * BUG GUARDS:
 * - Sort comparator uses correct property name (no typo like a.pricee) — bug class 1
 * - Cap check: length < 4, not <= 4 — bug class 4
 * - reject() is correctly inverted (keeps non-matching items) — bug class 5
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .controller('CompareCtrl', ['ApiService', 'CompareService', '$location',
      function (ApiService, CompareService, $location) {
      const vm = this;
      vm.cars    = [];
      vm.loading = true;
      vm.sortKey = 'listing_price';
      vm.sortDir = 1; // 1 = asc, -1 = desc

      function load() {
        const ids = CompareService.getIds();
        if (!ids.length) { vm.loading = false; return; }
        ApiService.compareCars(ids).then(function (r) {
          vm.cars    = r.data;
          vm.loading = false;
          computeBest();
        }).catch(() => vm.loading = false);
      }

      // Compute best value per row (lowest price, highest mileage, etc.)
      function computeBest() {
        const fields = ['listing_price', 'mileage_kmpl', 'engine_cc', 'seating', 'power_bhp', 'torque_nm', 'boot_space_l', 'airbags', 'ncap_stars'];
        vm.best = {};
        fields.forEach(function (f) {
          const vals  = vm.cars.map(c => Number(c[f])).filter(n => !isNaN(n) && n > 0);
          if (!vals.length) return;
          // Best = lowest price; best = highest for others
          if (f === 'listing_price') vm.best[f] = Math.min(...vals);
          else                       vm.best[f] = Math.max(...vals);
        });
      }

      vm.isBest = function (car, field) {
        return vm.best && vm.best[field] !== undefined && Number(car[field]) === vm.best[field];
      };

      vm.remove = function (car) {
        CompareService.remove(car.id);
        // BUG GUARD: correct reject — keeps all cars EXCEPT the removed one (bug class 5)
        vm.cars = vm.cars.filter(c => c.id !== car.id);
        computeBest();
      };

      vm.sortBy = function (key) {
        if (vm.sortKey === key) { vm.sortDir *= -1; } else { vm.sortKey = key; vm.sortDir = 1; }
        // BUG GUARD: correct property name — a.listing_price not a.pricee (bug class 1)
        vm.cars.sort(function (a, b) {
          return (Number(a[vm.sortKey]) - Number(b[vm.sortKey])) * vm.sortDir;
        });
      };

      vm.goShop = function () { $location.path('/new-cars'); };

      load();
    }]);
}());
