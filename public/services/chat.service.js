/**
 * services/chat.service.js — Chat state service.
 * Also provides startWith(): open (or re-open) a conversation with another user from anywhere in the app.
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .service('ChatService', ['ApiService', '$location', '$rootScope', function (ApiService, $location, $rootScope) {
      this.selectedConversation = null;
      const self0 = this;
      // never leak one user's conversation to the next user of this browser
      $rootScope.$on('auth:logout', function () { self0.selectedConversation = null; });
      $rootScope.$on('auth:login',  function () { self0.selectedConversation = null; });

      this.select = function (conv) {
        this.selectedConversation = conv;
      };

      this.send = function (senderId, text) {
        // BUG GUARD: null-guard — check selected conversation before sending (bug class 2)
        if (!this.selectedConversation) {
          console.warn('[chat] No conversation selected');
          return null;
        }
        return ApiService.sendMessage({
          conversation_id: this.selectedConversation._id,
          sender_id: String(senderId),
          text: text
        });
      };

      /** Start a chat with a user (e.g. the dealer of a car) and jump to the chat page. */
      this.startWith = function (userId, carId) {
        const self = this;
        return ApiService.startConversation(userId, carId).then(function (r) {
          self.selectedConversation = r.data;
          $location.path('/chat');
          return r.data;
        });
      };
    }]);

}());
