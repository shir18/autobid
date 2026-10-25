/**
 * controllers/cardetail.controller.js — ONE page per car (e.g. "Maruti Suzuki Swift").
 * The buyer picks a variant (LXI / VXI / VXI CNG / ZXI …) on this page and everything variant-specific
 * changes with it: fuel, engine, power, torque, mileage / EV range, boot, airbags, features, price,
 * on-road price, EMI, the dealer stocking that variant, and the listing used for shortlist,
 * compare, chat and test drives.
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .controller('CarDetailCtrl', ['ApiService', 'AuthService', 'CompareService', 'ChatService', 'Util', '$routeParams', '$location',
      function (ApiService, AuthService, CompareService, ChatService, Util, $routeParams, $location) {
      const vm = this;
      vm.car      = null;
      vm.reviews  = [];
      vm.similar  = [];
      vm.newReview = { rating: 5, title: '', body: '', pros: '', cons: '' };
      vm.loading  = true;
      vm.user     = AuthService.getUser();
      vm.tab      = 'specs';
      vm.selectedVariant = null;
      vm.fuelFilter = '';
      vm.shortlisted = false;
      vm.bookForm  = { scheduled_date: null, notes: '' };
      vm.today     = Util.today();
      vm.booked    = false;
      vm.bookMsg   = '';
      vm.bookError = '';

      const routeId = Number($routeParams.id);
      let shortlistIds = [];

      // ── loading ──────────────────────────────────────────────────────────────
      ApiService.getCar(routeId).then(function (r) {
        vm.car = r.data;
        const variants = r.data.variants || [];
        const wanted = Number($routeParams.variant);
        vm.selectedVariant = variants.find(v => v.id === wanted)
          || variants.find(v => v.id === r.data.variant_id) || variants[0] || null;
        vm.fuelFilter = '';
        afterVariantChange();
        vm.loading = false;
        if (r.data.type === 'new') ApiService.getSimilar(routeId).then(s => vm.similar = s).catch(() => {});
      }).catch(() => vm.loading = false);

      if (vm.user && vm.user.role === 'buyer') {
        ApiService.getShortlist(vm.user.id).then(r => { shortlistIds = r.data.map(c => c.id); refreshFlags(); });
      }

      function loadReviews() { ApiService.getReviews(vm.activeId()).then(r => vm.reviews = r.data); }

      function refreshFlags() {
        const id = vm.activeId();
        vm.shortlisted = shortlistIds.includes(id);
        vm.inCompare   = CompareService.getIds().includes(id);
      }

      function afterVariantChange() {
        refreshFlags();
        loadReviews();
        vm.compareMsg = vm.shortlistMsg = vm.chatMsg = '';
      }

      // ── which listing / variant is active ────────────────────────────────────
      vm.isNew = function () { return !!vm.car && vm.car.type === 'new'; };

      /** The listing behind the selected variant (new cars); for used cars it is the car itself. */
      vm.listing = function () {
        if (!vm.car) return null;
        if (!vm.isNew()) return vm.car;
        return vm.selectedVariant ? vm.selectedVariant.listing : vm.car;
      };
      vm.hasListing = function () { return !!vm.listing(); };
      vm.activeId = function () { const l = vm.listing(); return l ? l.id : routeId; };

      /** Spec source: the variant for new cars, the car's own (variant) columns for used cars. */
      vm.spec = function () { return vm.isNew() && vm.selectedVariant ? vm.selectedVariant : (vm.car || {}); };

      vm.dealer = function () {
        const l = vm.listing() || {};
        if (vm.isNew()) return { id: l.dealer_id, name: l.dealer_name, address: l.dealer_address, city: l.dealer_city || l.city, user_id: l.dealer_user_id };
        return { id: vm.car.dealer_id, name: vm.car.dealer_name, address: vm.car.dealer_address, city: vm.car.dealer_city, user_id: vm.car.dealer_user_id };
      };
      vm.image = function () { const l = vm.listing(); return (l && l.image_url) || (vm.car && vm.car.image_url); };

      // ── variant picker ───────────────────────────────────────────────────────
      vm.fuels = function () {
        const out = [];
        ((vm.car && vm.car.variants) || []).forEach(v => { if (out.indexOf(v.fuel_type) === -1) out.push(v.fuel_type); });
        return out;
      };
      vm.visibleVariants = function () {
        const all = (vm.car && vm.car.variants) || [];
        return vm.fuelFilter ? all.filter(v => v.fuel_type === vm.fuelFilter) : all;
      };
      vm.setFuel = function (f) {
        vm.fuelFilter = f;
        const list = vm.visibleVariants();
        if (list.length && !list.some(v => vm.selectedVariant && v.id === vm.selectedVariant.id)) vm.selectVariant(list[0]);
      };
      vm.selectVariant = function (v) {
        vm.selectedVariant = v;
        $location.search('variant', v.id);          // shareable link, no page reload (route has reloadOnSearch:false)
        afterVariantChange();
      };

      // ── display helpers ──────────────────────────────────────────────────────
      vm.mileageUnit = function (s) { return (s || vm.spec()).fuel_type === 'CNG' ? 'km/kg' : 'kmpl'; };
      vm.isEv = function (s) { return (s || vm.spec()).fuel_type === 'Electric'; };
      vm.stars = function (n) { n = Number(n) || 0; return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); };

      vm.currentPrice = function () {
        if (vm.car && vm.car.type === 'used') return Number(vm.car.listing_price);
        const l = vm.listing();
        if (l && l.listing_price) return Number(l.listing_price);
        return vm.selectedVariant ? Number(vm.selectedVariant.price) : (vm.car ? Number(vm.car.listing_price) : 0);
      };

      vm.avgRating = function () {
        if (!vm.reviews.length) return 0;
        return Math.round(vm.reviews.reduce((s, r) => s + Number(r.rating), 0) / vm.reviews.length * 10) / 10;
      };

      // On-road price breakdown (simplified)
      vm.onRoadPrice = function () {
        const ex = vm.currentPrice();
        return {
          exShowroom: ex,
          rto:        Math.round(ex * 0.075),
          insurance:  Math.round(ex * 0.035),
          others:     Math.round(ex * 0.01),
          total:      Math.round(ex * 1.12)
        };
      };

      // ── actions (always on the ACTIVE variant's listing) ─────────────────────
      vm.addToCompare = function () {
        if (!vm.hasListing()) { vm.compareMsg = 'No dealer stocks this variant right now.'; return; }
        const res = CompareService.add(vm.activeId());
        vm.inCompare  = res.ok || res.reason === 'already_added';
        vm.compareMsg = res.ok ? 'Added to compare!' : (res.reason === 'max_reached' ? 'Compare full (max 4)' : 'Already in compare');
      };

      vm.toggleShortlist = function () {
        if (!vm.user) { vm.shortlistMsg = 'Please login to shortlist cars.'; return; }
        if (vm.user.role !== 'buyer') { vm.shortlistMsg = 'Only buyers can shortlist cars.'; return; }
        if (!vm.hasListing()) { vm.shortlistMsg = 'No dealer stocks this variant right now.'; return; }
        vm.shortlistMsg = '';
        const id = vm.activeId();
        if (vm.shortlisted) {
          ApiService.removeShortlist(vm.user.id, id).then(() => { shortlistIds = shortlistIds.filter(x => x !== id); vm.shortlisted = false; });
        } else {
          ApiService.addShortlist(vm.user.id, id).then(() => { shortlistIds.push(id); vm.shortlisted = true; });
        }
      };

      vm.chatWithDealer = function () {
        const d = vm.dealer();
        if (!vm.user) { vm.chatMsg = 'Please login to chat with the dealer.'; return; }
        if (!d.user_id) { vm.chatMsg = 'This listing has no dealer to chat with.'; return; }
        if (d.user_id === vm.user.id) { vm.chatMsg = 'This is your own listing.'; return; }
        ChatService.startWith(d.user_id, vm.activeId()).catch(e => { vm.chatMsg = ApiService.errorMessage(e); });
      };

      vm.submitReview = function () {
        vm.reviewMsg = '';
        if (!vm.user) { vm.reviewMsg = 'Please login to review'; return; }
        if (!vm.newReview.rating) { vm.reviewMsg = 'Please pick a star rating.'; return; }
        const split = s => (s || '').split(',').map(x => x.trim()).filter(Boolean);
        ApiService.postReview({
          car_id: vm.activeId(), rating: vm.newReview.rating, title: vm.newReview.title, body: vm.newReview.body,
          pros: split(vm.newReview.pros), cons: split(vm.newReview.cons)
        }).then(function (r) {
          vm.reviews.unshift(r.data);
          vm.newReview = { rating: 5, title: '', body: '', pros: '', cons: '' };
          vm.reviewMsg = 'Review submitted — thank you!';
        }).catch(e => { vm.reviewMsg = ApiService.errorMessage(e); });
      };

      vm.bookTestDrive = function () {
        vm.bookError = '';
        if (!vm.user || !vm.car) return;
        if (!vm.hasListing()) { vm.bookError = 'No dealer stocks this variant right now.'; return; }
        if (!vm.bookForm.scheduled_date) { vm.bookError = 'Please choose a date.'; return; }
        ApiService.bookTestDrive({
          car_id: vm.activeId(),
          scheduled_date: Util.dateOnly(vm.bookForm.scheduled_date),
          notes: vm.bookForm.notes
        }).then(function () {
          vm.booked  = true;
          vm.bookMsg = 'Test drive requested for ' + Util.dateOnly(vm.bookForm.scheduled_date) + '. The dealer will confirm it — track it in your dashboard.';
        }).catch(e => { vm.bookError = ApiService.errorMessage(e, 'Failed to book. Try again.'); });
      };
    }]);
}());
