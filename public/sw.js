const CACHE_NAME = 'winscan-v3';
const STATIC_CACHE = 'winscan-static-v3';
const DYNAMIC_CACHE = 'winscan-dynamic-v3';

const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Cache duration (in milliseconds)
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for dynamic content

// Install service worker
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force immediate activation
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Check if cached response is still fresh
function isCacheFresh(response) {
  if (!response) return false;
  
  const cachedTime = response.headers.get('sw-cache-time');
  if (!cachedTime) return false;
  
  const age = Date.now() - parseInt(cachedTime);
  return age < CACHE_DURATION;
}

// Add timestamp to response
function addCacheTimestamp(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cache-time', Date.now().toString());
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

// Fetch resources
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Network First with Stale-While-Revalidate for API calls and dynamic pages
  if (url.pathname.startsWith('/api/') || 
      url.pathname.match(/^\/[a-z]+-(?:mainnet|test)(?:\/|$)/) ||
      url.pathname.includes('/validators/') ||
      url.pathname.includes('/transactions/') ||
      url.pathname.includes('/blocks/')) {
    
    event.respondWith(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              // Clone and cache the response with timestamp
              const responseToCache = addCacheTimestamp(networkResponse.clone());
              cache.put(request, responseToCache);
              return networkResponse;
            })
            .catch(() => cachedResponse); // Fallback to cache if network fails
          
          // If cache is fresh, return it immediately and update in background
          if (cachedResponse && isCacheFresh(cachedResponse)) {
            fetchPromise.catch(() => {}); // Update cache in background
            return cachedResponse;
          }
          
          // Otherwise, wait for network
          return fetchPromise;
        });
      })
    );
    return;
  }
  
  // Cache First for static assets (JS, CSS, images)
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(STATIC_CACHE)
            .then((cache) => {
              cache.put(request, responseToCache);
            });
          return response;
        });
      })
  );
});

// Activate and clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service worker activated and claimed clients');
      return self.clients.claim(); // Take control immediately
    })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Clear cache on demand
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName === DYNAMIC_CACHE) {
              console.log('Clearing dynamic cache');
              return caches.delete(cacheName);
            }
          })
        );
      })
    );
  }
});
