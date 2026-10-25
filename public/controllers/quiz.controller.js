/**
 * controllers/quiz.controller.js — Smart Match Quiz
 * 5 questions → ML recommender (k-nearest-neighbours over variant features, done on the server)
 * → ranked cars (each with its best-matching variant) and a score breakdown.
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .controller('QuizCtrl', ['ApiService', function (ApiService) {
      const vm = this;
      vm.step    = 0;  // 0 = intro, 1-5 = questions, 6 = results
      vm.answers = {};
      vm.results = [];
      vm.loading = false;
      vm.allCars = [];

      const questions = [
        {
          id: 'budget',
          text: 'What is your budget?',
          icon: '💰',
          options: [
            { label: 'Under ₹5L',   value: 500000  },
            { label: '₹5L–₹10L',   value: 1000000 },
            { label: '₹10L–₹20L',  value: 2000000 },
            { label: 'Above ₹20L', value: 9999999  }
          ]
        },
        {
          id: 'usage',
          text: 'How do you mainly use your car?',
          icon: '🛣️',
          options: [
            { label: 'City commute',           value: 'city'    },
            { label: 'Highway trips',          value: 'highway' },
            { label: 'Both equally',           value: 'mixed'   },
            { label: 'Off-road/adventure',     value: 'offroad' }
          ]
        },
        {
          id: 'family',
          text: 'How many people travel regularly?',
          icon: '👨‍👩‍👧‍👦',
          options: [
            { label: '1–2 people',  value: 2 },
            { label: '3–4 people',  value: 4 },
            { label: '5–6 people',  value: 6 },
            { label: '7+ people',   value: 7 }
          ]
        },
        {
          id: 'fuel',
          text: 'Preferred fuel type?',
          icon: '⛽',
          options: [
            { label: 'Petrol',   value: 'Petrol'   },
            { label: 'Diesel',   value: 'Diesel'   },
            { label: 'Electric', value: 'Electric' },
            { label: 'CNG',      value: 'CNG'      }
          ]
        },
        {
          id: 'priority',
          text: 'What matters most to you?',
          icon: '⭐',
          options: [
            { label: 'Best mileage',         value: 'mileage' },
            { label: 'Safety & reliability', value: 'safety'  },
            { label: 'Style & features',     value: 'style'   },
            { label: 'Low maintenance cost', value: 'cost'    }
          ]
        }
      ];

      vm.questions = questions;

      vm.answer = function (q, val) {
        vm.answers[q.id] = val;
        if (vm.step < questions.length) { vm.step++; }   // go to the next question…
        else { vm.computeResults(); }                    // …and only compute after the LAST one is answered
      };

      vm.restart = function () { vm.step = 0; vm.answers = {}; vm.results = []; vm.loading = false; };

      vm.computeResults = function () {
        vm.loading = true;
        // The server ranks every variant with the content-based KNN recommender (services/recommender.js)
        // and returns ONE result per car — its best-matching variant.
        ApiService.recommend(vm.answers).then(function (results) {
          vm.results = results;
          vm.step    = 6;
          vm.loading = false;
        }).catch(() => { vm.loading = false; vm.step = 6; });
      };
    }]);
}());
