/**
 * controllers/chat.controller.js — Live dealer ↔ buyer chat with activity feed.
 * BUG GUARD: null-guard on selectedConversation before sending (bug class 2).
 * New messages arrive by polling every 4 seconds.
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .controller('ChatCtrl', ['ApiService', 'AuthService', 'ChatService', '$interval', '$scope', '$timeout', '$location',
      function (ApiService, AuthService, ChatService, $interval, $scope, $timeout, $location) {
      const vm = this;
      vm.user          = AuthService.getUser();
      vm.conversations = [];
      vm.messages      = [];
      vm.selectedConv  = null;
      vm.newMsg        = '';
      vm.sendMsg       = '';
      vm.activity      = [];
      vm.loading       = true;

      if (!vm.user) { $location.path('/login'); return; }

      vm.isMine = function (msg) { return String(msg.sender_id) === String(vm.user.id); };

      /** "Chat with <other party>" label for a conversation. */
      vm.title = function (conv) {
        const other = (conv.participant_info || []).find(p => String(p.id) !== String(vm.user.id));
        return (other ? other.name : 'Conversation') + (conv.car_label ? ' · ' + conv.car_label : '');
      };

      function scrollDown() {
        $timeout(function () {
          const el = document.getElementById('chat-messages');
          if (el) el.scrollTop = el.scrollHeight;
        }, 0, false);
      }

      function loadMessages(conv, quiet) {
        return ApiService.getMessages(conv._id).then(function (r) {
          if (!vm.selectedConv || vm.selectedConv._id !== conv._id) return;   // user switched conversation meanwhile
          const grew = r.data.length !== vm.messages.length;
          vm.messages = r.data;
          if (grew) scrollDown();
        });
      }

      function loadConversations() {
        return ApiService.getConversations().then(function (r) {
          vm.conversations = r.data;
          vm.loading = false;
          return r.data;
        }).catch(() => { vm.loading = false; });
      }

      vm.selectConv = function (conv) {
        vm.selectedConv = conv;
        vm.messages = [];
        vm.sendMsg = '';
        ChatService.select(conv);
        loadMessages(conv);
      };

      loadConversations().then(function (convs) {
        // Coming from "Chat with dealer" → open that conversation
        const wanted = ChatService.selectedConversation;
        ChatService.selectedConversation = null;   // consume it — only auto-open once
        if (wanted && (wanted.participants || []).map(String).indexOf(String(vm.user.id)) !== -1) {
          let found = (convs || []).find(c => c._id === wanted._id);
          if (!found) { found = wanted; vm.conversations.unshift(found); }
          vm.selectConv(found);
        }
      });
      ApiService.getActivity().then(r => vm.activity = r.data.slice(0, 8));

      vm.send = function () {
        // BUG GUARD: null-guard (bug class 2) — do not send if no conversation selected
        if (!vm.selectedConv) {
          vm.sendMsg = 'Select a conversation first.';
          return;
        }
        const text = (vm.newMsg || '').trim();
        if (!text) return;
        const req = ChatService.send(vm.user.id, text);
        if (!req) return;
        req.then(function (r) {
          vm.messages.push(r.data);
          vm.newMsg  = '';
          vm.sendMsg = '';
          scrollDown();
        }).catch(e => { vm.sendMsg = ApiService.errorMessage(e, 'Message not sent.'); });
      };

      // Poll for new messages + conversation list (simple polling — no WebSocket needed)
      const poller = $interval(function () {
        if (vm.selectedConv) loadMessages(vm.selectedConv, true);
        ApiService.getConversations().then(r => { vm.conversations = r.data; });
      }, 4000);
      $scope.$on('$destroy', function () { $interval.cancel(poller); });
    }]);
}());
