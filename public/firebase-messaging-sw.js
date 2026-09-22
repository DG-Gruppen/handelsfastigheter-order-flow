/* SHF Intra – service worker för Firebase Cloud Messaging.
   Cachar ingenting och rör inte app-skalet. */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
firebase.messaging();
