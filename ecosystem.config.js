/**
 * PM2 configuration for the Moslim Leader site (the shop and طريق together).
 *
 * Two things were wrong here, and both were invisible because nobody used this file — the
 * process is started from PM2's saved dump, not from this:
 *
 *  - `cwd` pointed at /var/www/moslimleader, which does not exist on this server. Anyone
 *    who did run `pm2 start ecosystem.config.js` would have got a confusing failure.
 *  - `instances: 1` meant one CPU core served everything while the rest sat idle.
 *
 * ## Before switching to cluster, read this
 *
 * Cluster mode is NOT a free upgrade on this server, for two reasons:
 *
 *  1. Rate limiting. Each process counts alone, so a limit of ten per hour becomes ten per
 *     hour PER PROCESS. Tareeq's twenty limits are safe — they moved to a shared store
 *     (src/lib/tareeq-store.ts) — but the twenty-three SHOP routes that call
 *     src/lib/rate-limit.ts directly are still per-process. Login, register,
 *     forgot-password, PayPal and the book reader are among them. Multiplying those is a
 *     real weakening, so cluster mode is left OFF here until they move too.
 *  2. Memory. `max_memory_restart` is per process, and this server runs other projects.
 *     Two instances at 1G is 2G that the other projects cannot have.
 *
 * So `instances` stays 1, deliberately, and the line below is what to change when the
 * shop's limits have moved as well.
 */
module.exports = {
  apps: [
    {
      name: 'moslimleader',
      script: 'node_modules/.bin/next',
      args: 'start',
      // The real path on this server. The old value was /var/www/moslimleader.
      cwd: '/home/moslimleader.com/app',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      // Raised from 512M: the PDF page cache, the Mushaf cache and the rate-limit fallback
      // all live in this process, and 512M meant restarts often enough to keep dropping
      // them — so users paid to render the same book pages again and again.
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
