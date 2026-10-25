/**
 * controllers/tco.controller.js — True Cost of Ownership (5-year calculator).
 * Sliders for EMI inputs + fuel cost + insurance + maintenance.
 * SVG bar chart drawn client-side (no paid chart libraries).
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .controller('TcoCtrl', ['ApiService', function (ApiService) {
      const vm = this;
      vm.cars    = [];
      vm.carId   = '';
      vm.price   = 1000000;

      // Sliders
      vm.down    = 200000;
      vm.rate    = 9.0;
      vm.tenure  = 60;
      vm.kmMonth = 1500;
      vm.fuelPx  = 104;   // ₹/litre (India average petrol)
      vm.mileage = 18;    // kmpl (default; updates from car)
      vm.insPct  = 3.5;   // % of vehicle price (year 1), drops to 2% thereafter
      vm.maintPct = 1.5;  // % of vehicle price per year (year 1+)

      vm.result  = null;
      vm.bars    = [];    // SVG bar data

      ApiService.getCars({ type: 'new', limit: 500 }).then(function (r) {
        vm.cars = r.data.data;
        if (vm.cars.length) vm.selectCar(vm.cars[0].id);
      });

      vm.selectCar = function (id) {
        vm.carId = id;
        const car = vm.cars.find(c => c.id === Number(id));
        if (car) {
          vm.price   = Number(car.listing_price);
          vm.mileage = Number(car.mileage_kmpl) || 18;
          vm.down    = Math.round(vm.price * 0.2);
        }
        vm.calc();
      };

      vm.calc = function () {
        // EMI
        const P   = Math.max(0, vm.price - vm.down);
        const r   = vm.rate / 100 / 12;
        const n   = vm.tenure;
        const emi = P > 0 && r > 0
          ? P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
          : 0;
        const totalEmi = emi * n;

        // 5-year fuel cost
        const months5  = 60;
        const litersPerMonth = vm.kmMonth / vm.mileage;
        const fuelYear1 = litersPerMonth * 12 * vm.fuelPx;
        const fuel5     = fuelYear1 * 5;

        // Insurance (year 1 at insPct%, years 2-5 at ~60% of that)
        const ins1    = vm.price * vm.insPct / 100;
        const ins5    = ins1 + (ins1 * 0.6) * 4;

        // Maintenance (exponential growth per year)
        const maintPerYear = vm.price * vm.maintPct / 100;
        const maint5 = maintPerYear * (1 + 1.2 + 1.44 + 1.73 + 2.07); // 5 years

        const total5 = totalEmi + fuel5 + ins5 + maint5;

        vm.result = {
          emi:    Math.round(emi),
          emiTotal: Math.round(totalEmi),
          fuel5:  Math.round(fuel5),
          ins5:   Math.round(ins5),
          maint5: Math.round(maint5),
          total5: Math.round(total5)
        };

        buildChart();
      };

      function buildChart() {
        if (!vm.result) return;
        const items = [
          { label: 'EMI',         value: vm.result.emiTotal, color: '#3B82F6' },
          { label: 'Fuel',        value: vm.result.fuel5,    color: '#10B981' },
          { label: 'Insurance',   value: vm.result.ins5,     color: '#F59E0B' },
          { label: 'Maintenance', value: vm.result.maint5,   color: '#EF4444' }
        ];
        const maxVal = Math.max(...items.map(i => i.value));
        const W = 300, H = 160, barW = 50, gap = 20, padL = 10;
        vm.svgW = W;
        vm.svgH = H + 30;
        vm.bars = items.map(function (item, i) {
          const h = maxVal > 0 ? Math.round((item.value / maxVal) * H) : 0;
          const x = padL + i * (barW + gap);
          const y = H - h;
          return { x, y, h, w: barW, color: item.color, label: item.label, value: item.value };
        });
      }

      vm.calc();
    }]);
}());
