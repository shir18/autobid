// karma.conf.js — Karma test runner configuration (free, open-source)
module.exports = function (config) {
  config.set({
    basePath:  '',
    frameworks: ['jasmine'],
    files: [
      // Angular from CDN is not available in node_modules, so we use
      // a locally bundled minimal stub for testing pure JS functions.
      // The tests in angular.spec.js are pure JS (no Angular DI needed).
      'tests/angular.spec.js'
    ],
    reporters:  ['progress', 'kjhtml'],
    port:        9876,
    colors:      true,
    logLevel:    config.LOG_INFO,
    autoWatch:   false,
    browsers:    ['ChromeHeadless'],
    customLaunchers: {
      ChromeHeadless: {
        base:  'Chrome',
        flags: ['--headless', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=9222']
      }
    },
    singleRun: true,
    concurrency: Infinity
  });
};
