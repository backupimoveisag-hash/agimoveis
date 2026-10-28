const CACHE_NAME='ag-crm-v156';
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest', './firebase-config.js',
  './assets/ag-logo.png', './assets/login-luxury-bg.jpg', './assets/login-luxury-bg-mobile.jpg', './assets/icon-192.png', './assets/icon-512.png', './assets/apple-touch-icon.png',
  './css/01-styles.css', './css/02-quiet-luxury-redesign.css', './css/03-typography-v4.css', './css/04-property-detail-v6.css',
  './css/05-crm-fluid-responsive-v16.css', './css/06-login-luxury-overrides.css', './css/07-ag-menu-identity.css', './css/08-ag-white-background-fix.css',
  './css/09-ag-menu-distribution-v32.css', './css/10-ag-menu-distribution-v33.css', './css/11-ag-menu-v34.css', './css/12-ag-v35-prospecting-style.css',
  './css/13-ag-v39-navy-accent.css', './css/14-ag-v40-dashboard-navy-data.css', './css/15-ag-v40b-blue-cards-fix.css', './css/16-ag-v43-dashboard-cards-refined.css',
  './css/17-ag-v44-journey-interactions.css', './css/18-ag-v46-property-media.css', './css/19-ag-v47-media-visible-fix.css', './css/20-ag-readable-typography.css',
  './css/23-ag-settings-automation-v55.css', './css/24-ag-auth-users-v56.css', './css/25-ag-mobile-pwa-v72.css', './css/26-ag-mobile-overflow-v73.css', './css/27-ag-mobile-menu-v74.css', './css/28-ag-login-logo-mobile-v75.css',
  './css/29-ag-mobile-redesign-v77.css', './css/30-ag-mobile-ux-v78.css', './css/31-ag-mobile-safe-top-v79.css', './css/32-ag-mobile-bottom-v80.css', './css/33-ag-mobile-fullscreen-v81.css', './css/34-ag-login-background-full-v82.css', './css/35-ag-site-real-preview-v88.css', './css/36-ag-modal-scroll-v89.css', './css/37-ag-mobile-scroll-v93.css', './css/38-ag-prospecting-checks-v94.css', './css/39-ag-agenda-mobile-v95.css', './css/40-ag-leads-mobile-cards-v96.css', './css/41-ag-properties-leads-reorg-v98.css', './css/42-ag-property-admin-watermark-v99.css', './css/43-ag-keys-v102.css', './css/45-ag-drive-appscript-v106.css', './css/46-ag-drive-appscript-v107.css','./css/47-ag-canal-pro-v113.css', './css/48-ag-lead-distribution-v118.css', './css/49-ag-agenda-meetings-v119.css', './css/50-ag-header-pwa-fix-v127.css', './css/51-ag-properties-compact-v133.css', './css/52-ag-property-client-ficha-v139.css',
  './js/01-ag-light-only.js', './js/02-app.js', './js/03-app.js', './js/04-app.js', './js/05-ag-v46-property-media-js.js',
  './js/06-ag-settings-automation-v55.js', './js/07-login-ui-v57.js', './js/08-ag-pwa-v72.js', './js/09-ag-mobile-menu-v74.js', './js/10-ag-mobile-ux-v78.js', './js/11-ag-mobile-viewport-v81.js','./js/12-ag-site-preview-embedded-v92.js','./js/13-ag-properties-leads-reorg-v98.js','./js/14-ag-property-admin-watermark-v99.js','./js/15-ag-keys-v102.js','./js/17-ag-drive-appscript-v106.js','./js/18-ag-drive-appscript-v107.js','./js/19-ag-canal-pro-v113.js','./js/20-ag-lead-distribution-v118.js','./js/21-ag-agenda-meetings-v119.js','./js/22-ag-property-client-ficha-v139.js','./js/23-ag-property-edit-permissions-v142.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ag-crm-') && k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put('./index.html', copy)); return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req)));
});
