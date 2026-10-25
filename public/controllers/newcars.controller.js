/**
 * controllers/newcars.controller.js — New cars: ONE card per car (model) with filters, sort, pagination.
 * The variant (LXI / VXI / ZXI …) is chosen on the car's page, where the specs change with it.
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .controller('NewCarsCtrl', ['ApiService', 'CompareService', '$location', '$routeParams',
      function (ApiService, CompareService, $location, $routeParams) {
      const vm = this;
      vm.cars     = [];
      vm.brands   = [];
      vm.loading  = true;
      vm.total    = 0;
      vm.page     = 1;
      vm.pageSize = 12;
      vm.compareCount = CompareService.count();

      // Filters — initialized from query params (deep-link support)
      vm.filters = {
        brand:        $routeParams.brand        || '',
        fuel:         $routeParams.fuel         || '',
        bodyType:     $routeParams.bodyType     || '',
        transmission: $routeParams.transmission || '',
        seats:        $routeParams.seats        || '',
        city:         $routeParams.city         || '',
        minPrice:     $routeParams.minPrice     || '',
        maxPrice:     $routeParams.maxPrice     || '',
        sort:         $routeParams.sort         || 'price_asc'
      };

      vm.bodyTypes     = ['Sedan','SUV','Hatchback','MUV','Coupe','Van'];
      vm.fuels         = ['Petrol','Diesel','Electric','Hybrid','CNG'];
      vm.transmissions = ['Manual','Automatic','CVT','DCT'];
      vm.cities        = ['Mumbai','Delhi','Bangalore','Chennai','Hyderabad'];
      vm.sortOptions   = [
        { val: 'price_asc',    label: 'Price: Low to High' },
        { val: 'price_desc',   label: 'Price: High to Low' },
        { val: 'mileage_desc', label: 'Best Mileage' },
        { val: 'newest',       label: 'Newest First' }
      ];

      ApiService.getBrands().then(r => vm.brands = r.data);

      function buildParams() {
        const p = { type: 'new', group: 'model', page: vm.page };   // one card per CAR; variants are picked on its page
        Object.entries(vm.filters).forEach(([k, v]) => { if (v) p[k] = v; });
        return p;
      }

      vm.load = function () {
        vm.loading = true;
        ApiService.getCars(buildParams()).then(function (r) {
          vm.cars    = r.data.data;
          vm.total   = r.data.total;
          vm.loading = false;
        }).catch(() => vm.loading = false);
      };

      vm.applyFilters = function () { vm.page = 1; vm.load(); };
      vm.clearFilters = function () {
        vm.filters = { brand: '', fuel: '', bodyType: '', transmission: '', seats: '', city: '', minPrice: '', maxPrice: '', sort: 'price_asc' };
        vm.page = 1; vm.load();
      };

      vm.setPage = function (p) {
        if (p < 1 || p > vm.totalPages()) return;
        vm.page = p; vm.load();
      };
      vm.totalPages = function () { return Math.ceil(vm.total / vm.pageSize); };
      vm.pages      = function () {
        const t = vm.totalPages();
        return Array.from({ length: Math.min(t, 10) }, (_, i) => i + 1);
      };

      vm.priceRange = function (car) {
        return car.min_price === car.max_price ? null : car.max_price;
      };

      vm.addToCompare = function (car) {
        const res = CompareService.add(car.id);
        if (res.ok) {
          car._inCompare = true;
          vm.compareCount = CompareService.count();
          vm.compareMsg = null;
        } else {
          vm.compareMsg = res.reason === 'max_reached' ? 'Compare is full (max 4)' : 'Already in compare';
        }
      };

      vm.goCompare = function () { $location.path('/compare'); };

      vm.load();
    }]);
}());
