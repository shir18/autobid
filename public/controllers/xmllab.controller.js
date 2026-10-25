/**
 * controllers/xmllab.controller.js — Experiment 8 "XML Lab":
 * view the car catalog as raw XML / CSS-styled XML / XSLT table, and use the formatter + validator.
 */
(function () {
  'use strict';

  angular.module('autoBid')
    .controller('XmlLabCtrl', ['$http', '$sce', function ($http, $sce) {
      const vm = this;
      const SAMPLE = '<?xml version="1.0" encoding="UTF-8"?><catalog><car type="new"><brand>Maruti Suzuki</brand>' +
                     '<model>Swift</model><city>Mumbai</city><price>650000</price></car></catalog>';

      vm.filters  = { type: '', limit: 10 };
      vm.mode     = 'css';          // raw | css | xsl | html
      vm.rawXml   = '';
      vm.input    = SAMPLE;
      vm.report   = null;
      vm.formatted = '';
      vm.error    = '';
      vm.busy     = false;

      vm.modes = [
        { id: 'raw', label: '1 · Raw XML',      help: 'No stylesheet — the browser shows the plain XML tree.' },
        { id: 'css', label: '2 · CSS styled',   help: 'Uses <?xml-stylesheet type="text/css"?> and display rules for each element.' },
        { id: 'xsl', label: '3 · XSLT table',   help: 'Uses <?xml-stylesheet type="text/xsl"?> to transform the XML into an HTML table.' },
        { id: 'html', label: 'HTML fallback',   help: 'Same table built on the server — use it if your browser has dropped XSLT support.' }
      ];

      function query() {
        const q = ['mode=' + encodeURIComponent(vm.mode)];
        if (vm.filters.type)  q.push('type=' + encodeURIComponent(vm.filters.type));
        if (vm.filters.limit) q.push('limit=' + encodeURIComponent(vm.filters.limit));
        return q.join('&');
      }

      /** URL shown in the preview iframe / "open in new tab" link. */
      vm.url = function () { return '/api/xml/cars?' + query(); };
      vm.frameUrl = function () { return $sce.trustAsResourceUrl(vm.url()); };
      vm.downloadUrl = function () { return '/api/xml/cars?mode=raw&download=1' + (vm.filters.type ? '&type=' + vm.filters.type : ''); };
      vm.currentHelp = function () { return (vm.modes.find(m => m.id === vm.mode) || {}).help; };

      vm.setMode = function (id) { vm.mode = id; };

      /** Step: fetch the catalog XML text, then validate + auto-indent it with the formatter endpoint. */
      vm.loadRaw = function () {
        vm.busy = true; vm.error = '';
        const url = '/api/xml/cars?mode=raw' + (vm.filters.type ? '&type=' + vm.filters.type : '') + '&limit=' + (vm.filters.limit || 10);
        $http.get(url, { transformResponse: function (d) { return d; } })
          .then(function (r) { vm.input = r.data; return vm.format(); })
          .catch(function (e) { vm.error = (e.data && e.data.error) || 'Could not load the catalog'; })
          .finally(function () { vm.busy = false; });
      };

      vm.validate = function () {
        vm.error = ''; vm.formatted = '';
        return $http.post('/api/xml/validate', { xml: vm.input })
          .then(function (r) { vm.report = r.data; })
          .catch(function (e) { vm.report = null; vm.error = (e.data && e.data.error) || 'Validation failed'; });
      };

      vm.format = function () {
        vm.error = '';
        return $http.post('/api/xml/format', { xml: vm.input })
          .then(function (r) { vm.report = r.data; vm.formatted = r.data.formatted || ''; })
          .catch(function (e) { vm.report = null; vm.error = (e.data && e.data.error) || 'Formatting failed'; });
      };

      vm.useFormatted = function () { if (vm.formatted) { vm.input = vm.formatted; } };
      vm.useBroken = function () { vm.input = SAMPLE.replace('</model>', '</modle>').replace('Maruti Suzuki', 'Maruti & Suzuki'); vm.report = null; vm.formatted = ''; };
      vm.useSample = function () { vm.input = SAMPLE; vm.report = null; vm.formatted = ''; };

      vm.loadRaw();
    }]);
}());
