/**
 * controllers/home.controller.js — Home page: hero search, brands grid, trending cars.
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .controller('HomeCtrl', ['ApiService', '$location', function (ApiService, $location) {
      const vm = this;
      vm.brands       = [];
      vm.trending     = [];
      vm.loading      = true;
      vm.search       = { brand: '', budget: '', city: '', type: 'new' };
      vm.cities       = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad'];
      vm.budgets      = [
        { label: 'Under ₹5L',   min: 0,       max: 500000  },
        { label: '₹5L–₹10L',   min: 500000,  max: 1000000 },
        { label: '₹10L–₹20L',  min: 1000000, max: 2000000 },
        { label: '₹20L–₹40L',  min: 2000000, max: 4000000 },
        { label: 'Above ₹40L', min: 4000000, max: 99999999 }
      ];

      ApiService.getBrands().then(function (r) { vm.brands = r.data.slice(0, 12); });
      ApiService.getCars({ type: 'new', group: 'model', sort: 'newest', page: 1 }).then(function (r) {
        vm.trending = r.data.data.slice(0, 6);
        vm.loading  = false;
      }).catch(function () { vm.loading = false; });

      vm.doSearch = function () {
        const p = { type: vm.search.type };
        if (vm.search.city)   p.city   = vm.search.city;
        if (vm.search.budget) {
          const b = vm.budgets.find(x => x.label === vm.search.budget);
          if (b) { p.minPrice = b.min; p.maxPrice = b.max; }
        }
        const path = vm.search.type === 'used' ? '/used-cars' : '/new-cars';
        $location.path(path).search(p);
      };

      vm.goToBrand = function (slug) {
        $location.path('/new-cars').search({ brand: slug });
      };
    }]);
}());
