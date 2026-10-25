/**
 * controllers/dealerdash.controller.js — Dealer dashboard:
 * open requirements (bid / re-bid), my offers, orders, test drives, inventory.
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .controller('DealerDashCtrl', ['ApiService', 'AuthService', 'ChatService', 'Util', '$location',
      function (ApiService, AuthService, ChatService, Util, $location) {
      const vm = this;
      vm.user         = AuthService.getUser();
      vm.tab          = 'requirements';
      vm.requirements = [];
      vm.myOffers     = [];
      vm.orders       = [];
      vm.bookings     = [];
      vm.inventory    = [];
      vm.variants     = [];
      vm.dealer       = null;
      vm.offerForm    = {};
      vm.notice       = null;
      vm.loading      = {};
      vm.showCarForm  = false;
      vm.carForm      = { variant_id: '', type: 'used', year: new Date().getFullYear() - 2, km_driven: 20000, owner_count: 1, listing_price: null, city: '' };
      vm.parseDate    = Util.parseDate;

      if (!vm.user) { $location.path('/login'); return; }
      if (vm.user.role !== 'dealer') { $location.path(vm.user.role === 'admin' ? '/admin' : '/buyer'); return; }

      function notify(type, text) { vm.notice = { type: type, text: text }; }

      ApiService.getMyDealer().then(function (r) {
        vm.dealer = r.data;
        vm.carForm.city = vm.dealer.city;
        vm.loadTab('requirements');
      }).catch(e => notify('error', ApiService.errorMessage(e, 'Could not load your dealership')));

      vm.selectTab = function (t) { vm.tab = t; vm.notice = null; vm.loadTab(t); };

      vm.loadTab = function (t) {
        vm.loading[t] = true;
        const done = fn => r => { fn(r.data); vm.loading[t] = false; };
        const fail = () => { vm.loading[t] = false; };
        if (t === 'requirements') {
          ApiService.getRequirements({ status: 'open' }).then(done(d => vm.requirements = d)).catch(fail);
        } else if (t === 'offers') {
          ApiService.getMyOffers().then(done(d => vm.myOffers = d)).catch(fail);
        } else if (t === 'orders') {
          ApiService.getMyOrders().then(done(d => vm.orders = d)).catch(fail);
        } else if (t === 'bookings') {
          ApiService.getDealerBookings().then(done(d => vm.bookings = d)).catch(fail);
        } else if (t === 'inventory') {
          if (!vm.dealer) { vm.loading[t] = false; return; }
          ApiService.getCars({ dealer_id: vm.dealer.id, limit: 200, sort: 'newest' }).then(done(d => vm.inventory = d.data)).catch(fail);
          if (!vm.variants.length) ApiService.getVariants().then(r => vm.variants = r.data);
        }
      };

      // ── Bidding ───────────────────────────────────────────────────────────
      vm.form = function (req) { return vm.offerForm[req.id] || (vm.offerForm[req.id] = {}); };

      vm.submitOffer = function (req) {
        const f = vm.form(req);
        if (!f.price || !f.delivery_days) { notify('error', 'Enter both your price and delivery days.'); return; }
        const call = req.my_offer_id
          ? ApiService.updateOffer(req.my_offer_id, { price: f.price, delivery_days: f.delivery_days, freebies: f.freebies || '' })
          : ApiService.postOffer({ requirement_id: req.id, price: f.price, delivery_days: f.delivery_days, freebies: f.freebies || '' });
        call.then(function () {
          notify('success', (req.my_offer_id ? 'Offer updated' : 'Offer submitted') + ' for requirement #' + req.id);
          vm.offerForm[req.id] = {};
          vm.loadTab('requirements');
        }).catch(e => notify('error', ApiService.errorMessage(e)));
      };

      // 🤖 ML bid model: typical winning bid for a requirement like this one
      vm.bidHints = {};
      vm.suggestBid = function (req) {
        ApiService.getBidSuggestion(req.id).then(function (h) { vm.bidHints[req.id] = h; })
          .catch(e => notify('error', ApiService.errorMessage(e)));
      };
      vm.useSuggestedBid = function (req, price) { vm.form(req).price = price; };

      vm.reviseOffer = function (offer) {
        const price = Number(prompt('New (lower) price in ₹:', offer.price));
        if (!price) return;
        ApiService.updateOffer(offer.id, { price: price }).then(function () {
          offer.price = price;
          notify('success', 'Offer updated.');
        }).catch(e => notify('error', ApiService.errorMessage(e)));
      };

      // ── Orders ────────────────────────────────────────────────────────────
      vm.updateOrderStatus = function (order, status) {
        ApiService.updateOrderStatus(order.id, status).then(function () {
          order.status = status;
        }).catch(e => notify('error', ApiService.errorMessage(e)));
      };
      vm.chatWithBuyer = function (order) { ChatService.startWith(order.buyer_id, null); };

      // ── Test drives ───────────────────────────────────────────────────────
      vm.setBooking = function (b, status) {
        ApiService.updateBooking(b.id, status).then(() => { b.status = status; })
          .catch(e => notify('error', ApiService.errorMessage(e)));
      };
      vm.chatWithBookingBuyer = function (b) { ChatService.startWith(b.user_id, b.car_id); };

      // ── Inventory ─────────────────────────────────────────────────────────
      vm.addCar = function () {
        const f = vm.carForm;
        if (!f.variant_id || !f.listing_price || !f.city || !f.year) { notify('error', 'Variant, year, city and price are required.'); return; }
        ApiService.createCar({
          variant_id: Number(f.variant_id), type: f.type, year: f.year,
          km_driven: f.type === 'new' ? 0 : f.km_driven, owner_count: f.type === 'new' ? 0 : f.owner_count,
          city: f.city, listing_price: f.listing_price
        }).then(function () {
          notify('success', 'Listing added.');
          vm.showCarForm = false;
          vm.loadTab('inventory');
        }).catch(e => notify('error', ApiService.errorMessage(e)));
      };
      // 🤖 ML price model: fair market value for the used car being listed
      vm.priceHint = null;
      vm.estimatePrice = function () {
        const f = vm.carForm;
        vm.priceHint = null;
        if (!f.variant_id || !f.year) { notify('error', 'Pick a variant and year first.'); return; }
        ApiService.getUsedPriceEstimate({ variant_id: f.variant_id, year: f.year, km_driven: f.km_driven || 0, owner_count: f.owner_count || 1 })
          .then(h => vm.priceHint = h).catch(e => notify('error', ApiService.errorMessage(e)));
      };
      vm.useEstimate = function () { if (vm.priceHint) vm.carForm.listing_price = vm.priceHint.price; };
      vm.setCarStatus = function (car, status) {
        ApiService.updateCar(car.id, { status: status }).then(() => { car.status = status; })
          .catch(e => notify('error', ApiService.errorMessage(e)));
      };
      vm.deleteCar = function (car) {
        if (!confirm('Delete this listing?')) return;
        ApiService.deleteCar(car.id).then(function () {
          vm.inventory = vm.inventory.filter(c => c.id !== car.id);
        }).catch(e => notify('error', ApiService.errorMessage(e, 'Could not delete (it may have bookings).')));
      };
    }]);
}());
