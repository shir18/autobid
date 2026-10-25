/**
 * controllers/dealer.controller.js — Dealer locator + test drive booking form.
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .controller('DealerCtrl', ['ApiService', 'AuthService', 'Util', function (ApiService, AuthService, Util) {
      const vm = this;
      vm.dealers  = [];
      vm.loading  = true;
      vm.cityFilter = '';
      vm.cities   = ['Mumbai','Delhi','Bangalore','Chennai','Hyderabad'];
      vm.user     = AuthService.getUser();
      vm.booking  = { dealer_id: '', car_id: '', scheduled_date: null, notes: '' };
      vm.today    = Util.today();
      vm.bookMsg  = '';
      vm.bookError = '';
      vm.cars     = [];

      function loadDealers() {
        vm.loading = true;
        const p = {};
        if (vm.cityFilter) p.city = vm.cityFilter;
        ApiService.getDealers(p).then(function (r) {
          vm.dealers = r.data;
          vm.loading = false;
        }).catch(() => vm.loading = false);
      }

      // For test drive — load available cars (server default page size is 12, so ask for more)
      ApiService.getCars({ type: 'new', limit: 120 }).then(r => vm.cars = r.data.data);

      vm.filterCity = function () { loadDealers(); };

      vm.book = function () {
        vm.bookMsg = ''; vm.bookError = '';
        if (!vm.user) { vm.bookError = 'Please login first.'; return; }
        if (!vm.booking.car_id || !vm.booking.scheduled_date) { vm.bookError = 'Please choose a car and a date.'; return; }
        const data = {
          car_id: Number(vm.booking.car_id),
          scheduled_date: Util.dateOnly(vm.booking.scheduled_date),
          notes: vm.booking.notes
        };
        if (vm.booking.dealer_id) data.dealer_id = Number(vm.booking.dealer_id);
        ApiService.bookTestDrive(data).then(function () {
          vm.bookMsg  = 'Test drive requested for ' + data.scheduled_date + '! Track it in your dashboard.';
          vm.booking  = { dealer_id: '', car_id: '', scheduled_date: null, notes: '' };
        }).catch(e => { vm.bookError = ApiService.errorMessage(e, 'Booking failed. Try again.'); });
      };

      loadDealers();
    }]);
}());
