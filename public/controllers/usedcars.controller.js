/**
 * controllers/usedcars.controller.js — Used car listing with filters.
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .controller('UsedCarsCtrl', ['ApiService', 'CompareService', '$location', '$routeParams',
      function (ApiService, CompareService, $location, $routeParams) {
      const vm = this;
      vm.cars    = [];
      vm.loading = true;
      vm.total   = 0;
      vm.compareCount = CompareService.count();
      vm.goCompare = function () { $location.path('/compare'); };
      vm.page    = 1;
      vm.pageSize = 12;
      vm.filters = {
        sort: 'price_asc', city: $routeParams.city || '', minPrice: $routeParams.minPrice || '',
        maxPrice: $routeParams.maxPrice || '', year: '', maxKm: '', owner: ''
      };
      vm.cities  = ['Mumbai','Delhi','Bangalore','Chennai','Hyderabad'];
      vm.years   = [2024,2023,2022,2021,2020,2019,2018,2017,2016];
      vm.ownerOptions = [{ val:'1', label:'1st Owner' }, { val:'2', label:'Up to 2 Owners' }, { val:'3', label:'Up to 3 Owners' }];
      vm.kmOptions    = [
        { val:'20000',  label:'< 20,000 km' },
        { val:'50000',  label:'< 50,000 km' },
        { val:'80000',  label:'< 80,000 km' },
        { val:'120000', label:'< 1,20,000 km' }
      ];

      vm.load = function () {
        vm.loading = true;
        const p = { type: 'used', page: vm.page };
        Object.entries(vm.filters).forEach(([k, v]) => { if (v) p[k] = v; });
        ApiService.getCars(p).then(function (r) {
          vm.cars    = r.data.data;
          vm.total   = r.data.total;
          vm.loading = false;
        }).catch(() => vm.loading = false);
      };

      vm.applyFilters = function () { vm.page = 1; vm.load(); };
      vm.clearFilters = function () {
        vm.filters = { sort: 'price_asc', city: '', minPrice: '', maxPrice: '', year: '', maxKm: '', owner: '' };
        vm.page = 1; vm.load();
      };
      vm.setPage = function (p) { if (p < 1 || p > vm.totalPages()) return; vm.page = p; vm.load(); };
      vm.totalPages = function () { return Math.ceil(vm.total / vm.pageSize); };
      vm.pages = function () { return Array.from({ length: Math.min(vm.totalPages(), 10) }, (_, i) => i + 1); };

      vm.addToCompare = function (car) {
        const res = CompareService.add(car.id);
        if (!res.ok) vm.compareMsg = res.reason === 'max_reached' ? 'Max 4 cars in compare' : 'Already in compare';
        else { vm.compareMsg = null; vm.compareCount = CompareService.count(); }
      };

      vm.load();
    }]);
}());
