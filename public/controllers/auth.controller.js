/**
 * controllers/auth.controller.js — Login and Register.
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .controller('AuthCtrl', ['ApiService', 'AuthService', '$location', function (ApiService, AuthService, $location) {
      const vm = this;
      vm.form  = { email: '', password: '', name: '', role: 'buyer', dealership: '', city: 'Mumbai' };
      vm.cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad'];
      vm.error = '';
      vm.loading = false;
      vm.isLogin = $location.path() === '/login';

      // Already logged in → go straight to the right dashboard
      const existing = AuthService.getUser();
      if (existing) { go(existing.role); }

      function go(role) {
        $location.path(role === 'dealer' ? '/dealer-dash' : role === 'admin' ? '/admin' : '/buyer');
      }

      vm.fill = function (email, password) { vm.form.email = email; vm.form.password = password; };

      vm.submit = function () {
        vm.loading = true;
        vm.error   = '';
        const payload = vm.isLogin
          ? { email: vm.form.email, password: vm.form.password }
          : angular.copy(vm.form);
        if (!vm.isLogin && payload.role !== 'dealer') { delete payload.dealership; delete payload.city; }

        (vm.isLogin ? ApiService.login(payload) : ApiService.register(payload))
          .then(function (r) {
            AuthService.setSession(r.data.token, r.data.user);
            go(r.data.user.role);
          })
          .catch(function (e) {
            vm.error   = ApiService.errorMessage(e, 'Authentication failed');
            vm.loading = false;
          });
      };
    }]);
}());
