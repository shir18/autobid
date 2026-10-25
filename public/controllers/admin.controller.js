/**
 * controllers/admin.controller.js — Admin overview (GROUP BY stats + recent users).
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .controller('AdminCtrl', ['ApiService', 'AuthService', '$location', function (ApiService, AuthService, $location) {
      const vm = this;
      vm.user = AuthService.getUser();
      vm.stats = null;
      vm.users = [];
      vm.error = '';
      if (!vm.user || vm.user.role !== 'admin') { $location.path('/login'); return; }

      vm.count = function (list, key, val) {
        const row = (list || []).find(r => r[key] === val);
        return row ? row.count : 0;
      };
      vm.total = function (list) { return (list || []).reduce((s, r) => s + Number(r.count), 0); };

      ApiService.getAdminStats().then(r => vm.stats = r.data).catch(e => vm.error = ApiService.errorMessage(e));
      ApiService.getAdminUsers().then(r => vm.users = r.data);
    }]);
}());
