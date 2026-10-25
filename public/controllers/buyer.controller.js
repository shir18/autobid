/**
 * controllers/buyer.controller.js — Buyer dashboard:
 * My requirements, incoming offers (reverse bidding), shortlist, orders, test drives, activity.
 * Tab counts use the GROUP BY endpoint.
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .controller('BuyerCtrl', ['ApiService', 'AuthService', 'ChatService', 'Util', '$location', '$scope',
      function (ApiService, AuthService, ChatService, Util, $location, $scope) {
      const vm = this;
      vm.user         = AuthService.getUser();
      vm.tab          = 'requirements';
      vm.requirements = [];
      vm.shortlist    = [];
      vm.orders       = [];
      vm.bookings     = [];
      vm.activity     = [];
      vm.offersByReq  = {};
      vm.orderCounts  = {};
      vm.loading      = {};
      vm.notice       = null;   // { type: 'success'|'error', text }

      if (!vm.user) { $location.path('/login'); return; }
      if (vm.user.role !== 'buyer') { $location.path(vm.user.role === 'dealer' ? '/dealer-dash' : '/admin'); return; }

      vm.Util = Util;
      vm.today = Util.today();
      vm.parseDate = Util.parseDate;
      function notify(type, text) { vm.notice = { type: type, text: text }; }

      vm.selectTab = function (t) { vm.tab = t; vm.notice = null; vm.loadTab(t); };

      vm.loadTab = function (t) {
        vm.loading[t] = true;
        const done  = fn => r => { fn(r.data); vm.loading[t] = false; };
        const fail  = () => { vm.loading[t] = false; };
        if (t === 'requirements') {
          ApiService.getRequirements({}).then(done(d => { vm.requirements = d; vm.loadOrderCounts(); })).catch(fail);
        } else if (t === 'shortlist') {
          ApiService.getShortlist(vm.user.id).then(done(d => vm.shortlist = d)).catch(fail);
        } else if (t === 'orders') {
          ApiService.getMyOrders().then(done(d => vm.orders = d)).catch(fail);
        } else if (t === 'bookings') {
          ApiService.getBookings(vm.user.id).then(done(d => vm.bookings = d)).catch(fail);
        } else if (t === 'activity') {
          ApiService.getActivity().then(done(d => vm.activity = d)).catch(fail);
        }
      };

      // Offers panel (toggle) — sorted lowest price first by the server
      vm.loadOffers = function (req) {
        if (vm.offersByReq[req.id]) { vm.offersByReq[req.id] = null; return; }
        ApiService.getOffersForReq(req.id, 'price').then(function (r) {
          vm.offersByReq[req.id] = r.data;
          req.offer_count = r.data.length;
        }).catch(e => notify('error', ApiService.errorMessage(e)));
      };
      vm.lowestPrice = function (offers) {
        const p = (offers || []).filter(o => o.status !== 'rejected').map(o => Number(o.price));
        return p.length ? Math.min.apply(null, p) : null;
      };

      // ATOMIC ACCEPT — PATCH /api/offers/:id/accept (server rejects all other offers in one transaction)
      vm.acceptOffer = function (offer, req) {
        if (!confirm('Accept this offer? All other offers will be rejected and an order will be created.')) return;
        ApiService.acceptOffer(offer.id).then(function () {
          req.status = 'awarded';
          vm.offersByReq[req.id] = vm.offersByReq[req.id].map(o => Object.assign({}, o, {
            status: o.id === offer.id ? 'accepted' : 'rejected'
          }));
          notify('success', 'Offer accepted from ' + offer.dealer_name + ' — your order has been created.');
          vm.loadOrderCounts();
        }).catch(e => notify('error', 'Could not accept: ' + ApiService.errorMessage(e)));
      };

      vm.closeRequirement = function (req) {
        if (!confirm('Close this requirement? Pending offers will be rejected.')) return;
        ApiService.closeRequirement(req.id).then(function () {
          req.status = 'closed';
          vm.offersByReq[req.id] = null;
          notify('success', 'Requirement closed.');
        }).catch(e => notify('error', ApiService.errorMessage(e)));
      };

      vm.chatWithDealer = function (offer) { ChatService.startWith(offer.dealer_user_id, null); };

      // New requirement form
      vm.reqForm  = { budget_min: null, budget_max: null, body_type: '', fuel: '', city: '', timeline_days: 30 };
      vm.reqMsg   = '';
      vm.showReqForm = false;

      vm.submitReq = function () {
        vm.reqMsg = '';
        const f = vm.reqForm;
        if (!f.budget_max || !f.city) { vm.reqMsg = 'Please fill maximum budget and city.'; return; }
        if ((f.budget_min || 0) > f.budget_max) { vm.reqMsg = 'Minimum budget cannot exceed maximum budget.'; return; }
        ApiService.postRequirement({
          budget_min: f.budget_min || 0, budget_max: f.budget_max, body_type: f.body_type,
          fuel: f.fuel, city: f.city, timeline_days: f.timeline_days || 30
        }).then(function () {
          vm.showReqForm = false;
          vm.reqForm = { budget_min: null, budget_max: null, body_type: '', fuel: '', city: '', timeline_days: 30 };
          notify('success', 'Requirement posted! Dealers can now bid for it.');
          vm.loadTab('requirements');
        }).catch(e => { vm.reqMsg = ApiService.errorMessage(e, 'Failed to post. Try again.'); });
      };

      vm.cancelOrder = function (order) {
        if (!confirm('Cancel this order?')) return;
        ApiService.updateOrderStatus(order.id, 'cancelled').then(function () {
          order.status = 'cancelled'; vm.loadOrderCounts();
        }).catch(e => notify('error', ApiService.errorMessage(e)));
      };

      vm.cancelBooking = function (b) {
        ApiService.updateBooking(b.id, 'cancelled').then(() => { b.status = 'cancelled'; })
          .catch(e => notify('error', ApiService.errorMessage(e)));
      };

      vm.removeShortlisted = function (car) {
        ApiService.removeShortlist(vm.user.id, car.id).then(function () {
          vm.shortlist = vm.shortlist.filter(c => c.id !== car.id);
        });
      };

      // Order counts for tab badges (GROUP BY status)
      vm.loadOrderCounts = function () {
        ApiService.getOrderCounts().then(function (r) {
          vm.orderCounts = {};
          r.data.forEach(row => { vm.orderCounts[row.status] = row.count; });
        });
      };

      vm.loadTab('requirements');
    }]);
}());
