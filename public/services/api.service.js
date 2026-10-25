/**
 * services/api.service.js — Centralized HTTP API wrapper.
 * An $http interceptor (below) adds the JWT + API key to every /api request and
 * logs the user out automatically when the server says the session is invalid.
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .factory('AuthInterceptor', ['$q', '$injector', '$window', function ($q, $injector, $window) {
      return {
        request: function (config) {
          if (config.url.indexOf('/api/') === 0) {
            config.headers = config.headers || {};
            config.headers['x-api-key'] = 'demo-key';
            const token = $window.localStorage.getItem('ab_token');
            if (token) config.headers['Authorization'] = 'Bearer ' + token;
          }
          return config;
        },
        responseError: function (rejection) {
          const url = (rejection.config && rejection.config.url) || '';
          if (rejection.status === 401 && url.indexOf('/api/auth/login') === -1 && url.indexOf('/api/auth/register') === -1
              && $window.localStorage.getItem('ab_token')) {
            // token expired / invalid → clear session and go to login
            $injector.get('AuthService').logout();
            $injector.get('$location').path('/login');
          }
          return $q.reject(rejection);
        }
      };
    }])
    .config(['$httpProvider', function ($httpProvider) {
      $httpProvider.interceptors.push('AuthInterceptor');
    }])
    .service('ApiService', ['$http', '$q', function ($http, $q) {
      const API = '';

      /** Turns an $http error into a human-readable message. */
      this.errorMessage = function (e, fallback) {
        if (e && e.data && e.data.error) return e.data.error;
        if (e && e.status === -1) return 'Cannot reach the server — is it running?';
        return fallback || 'Something went wrong. Please try again.';
      };

      // ── Cars ───────────────────────────────────────────────────────────────
      this.getCars       = p => $http.get(API + '/api/cars', { params: p });
      this.getCar        = id => $http.get(API + '/api/cars/' + id);
      this.getVariants   = () => $http.get(API + '/api/cars/variants');
      this.createCar     = data => $http.post(API + '/api/cars', data);
      this.updateCar     = (id, data) => $http.patch(API + '/api/cars/' + id, data);
      this.deleteCar     = id => $http.delete(API + '/api/cars/' + id);
      this.compareCars   = ids => $http.get(API + '/api/cars/compare', { params: { ids: ids.join(',') } });
      this.getShortlist  = uid => $http.get(API + '/api/cars/shortlist/' + uid);
      this.addShortlist  = (uid, cid) => $http.post(API + '/api/cars/shortlist', { user_id: uid, car_id: cid });
      this.removeShortlist = (uid, cid) => $http.delete(API + '/api/cars/shortlist/' + uid + '/' + cid);

      // ── Brands ────────────────────────────────────────────────────────────
      this.getBrands     = () => $http.get(API + '/api/brands');

      // ── Dealers & bookings ────────────────────────────────────────────────
      this.getDealers    = params => $http.get(API + '/api/dealers', { params });
      this.getMyDealer   = () => $http.get(API + '/api/dealers/me');
      this.bookTestDrive = data => $http.post(API + '/api/dealers/bookings', data);
      this.getBookings   = uid  => $http.get(API + '/api/dealers/bookings/user/' + uid);
      this.getDealerBookings = () => $http.get(API + '/api/dealers/me/bookings');
      this.updateBooking = (id, status) => $http.patch(API + '/api/dealers/bookings/' + id, { status });

      // ── Requirements (reverse bidding) ────────────────────────────────────
      this.getRequirements = p  => $http.get(API + '/api/requirements', { params: p });
      this.getRequirement  = id => $http.get(API + '/api/requirements/' + id);
      this.postRequirement = data => $http.post(API + '/api/requirements', data);
      this.closeRequirement = id => $http.patch(API + '/api/requirements/' + id, {});

      // ── Offers ────────────────────────────────────────────────────────────
      this.getOffersForReq = (rid, sort) => $http.get(API + '/api/offers/requirement/' + rid, { params: { sort } });
      this.getMyOffers = () => $http.get(API + '/api/offers/mine');
      this.postOffer   = data => $http.post(API + '/api/offers', data);
      this.updateOffer = (id, data) => $http.patch(API + '/api/offers/' + id, data);
      this.acceptOffer = id  => $http.patch(API + '/api/offers/' + id + '/accept', {});
      this.offerCounts = ()  => $http.get(API + '/api/offers/counts');

      // ── Orders ────────────────────────────────────────────────────────────
      this.getMyOrders    = () => $http.get(API + '/api/orders/mine');
      this.getOrderCounts = () => $http.get(API + '/api/orders/counts');
      this.updateOrderStatus = (id, status) => $http.patch(API + '/api/orders/' + id + '/status', { status });

      // ── Chat ──────────────────────────────────────────────────────────────
      this.getConversations   = ()   => $http.get(API + '/api/chat/conversations');
      this.startConversation  = (withUserId, carId) => $http.post(API + '/api/chat/conversations', { with_user_id: withUserId, car_id: carId || null });
      this.getMessages        = cid  => $http.get(API + '/api/chat/messages/' + cid);
      this.sendMessage        = data => $http.post(API + '/api/chat/messages', data);

      // ── Reviews ───────────────────────────────────────────────────────────
      this.getReviews    = cid  => $http.get(API + '/api/reviews/car/' + cid);
      this.postReview    = data => $http.post(API + '/api/reviews/car/' + data.car_id, data);

      // ── Activity ──────────────────────────────────────────────────────────
      this.getActivity   = ()   => $http.get(API + '/api/activity/mine');

      // ── Admin ─────────────────────────────────────────────────────────────
      this.getAdminStats = () => $http.get(API + '/api/admin/stats');
      this.getAdminUsers = () => $http.get(API + '/api/admin/users');

      // ── Auth ──────────────────────────────────────────────────────────────
      this.login    = creds => $http.post(API + '/api/auth/login', creds);
      this.register = data  => $http.post(API + '/api/auth/register', data);

      // ── ML (recommender, similar cars, price + bid models) ────────────────
      this.recommend      = answers => $http.post(API + '/api/ml/recommend', answers).then(r => r.data);
      this.getSimilar     = carId   => $http.get(API + '/api/ml/similar/' + carId).then(r => r.data);
      this.getUsedPriceEstimate = p => $http.get(API + '/api/ml/used-price', { params: p }).then(r => r.data);
      this.getBidSuggestion = rid   => $http.get(API + '/api/ml/bid-suggestion/' + rid).then(r => r.data);

      // ── Fair price (served by Express; cached per car id) ─────────────────
      const fairCache = {};
      this.getFairPrice = function (listingId) {
        if (!fairCache[listingId]) {
          fairCache[listingId] = $http.get(API + '/api/cars/' + listingId + '/fair-price').then(r => r.data);
        }
        return fairCache[listingId];
      };
      this.clearFairPriceCache = function () { Object.keys(fairCache).forEach(k => delete fairCache[k]); };
    }]);

}());
