/**
 * middleware/responseTime.js
 * Express concept: measures request time, sets the X-Response-Time header
 * (just before headers are flushed) and logs it when the response finishes.
 */
'use strict';
module.exports = function responseTime(req, res, next) {
  const start = process.hrtime.bigint();
  const originalWriteHead = res.writeHead;
  res.writeHead = function () {
    if (!res.headersSent) {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      res.setHeader('X-Response-Time', ms.toFixed(2) + 'ms');
    }
    return originalWriteHead.apply(this, arguments);
  };
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`[timing] ${req.method} ${req.path} → ${ms.toFixed(2)}ms`);
  });
  next();
};
