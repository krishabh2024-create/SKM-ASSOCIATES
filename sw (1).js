const CACHE = 'skm-v2';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { self.clients.claim(); });

self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// Listen for messages from the main app to schedule notifications
self.addEventListener('message', e => {
  if(e.data && e.data.type === 'SCHEDULE_REMINDERS') {
    scheduleReminders(e.data.leads);
  }
  if(e.data && e.data.type === 'CANCEL_REMINDERS') {
    cancelReminders(e.data.leadId);
  }
});

// Store scheduled alarm times using service worker timers
let scheduledTimers = {};

function cancelReminders(leadId) {
  ['24hr','1hr','30min'].forEach(t => {
    const key = leadId + '_' + t;
    if(scheduledTimers[key]) {
      clearTimeout(scheduledTimers[key]);
      delete scheduledTimers[key];
    }
  });
}

function scheduleReminders(leads) {
  // Clear all first
  Object.values(scheduledTimers).forEach(t => clearTimeout(t));
  scheduledTimers = {};

  const now = Date.now();

  leads.forEach(l => {
    if(!l.visitDate || l.visited) return;
    const vt = new Date(l.visitDate).getTime();

    const reminders = [
      { offset: 86400000, type: '24hr',  title: '🏠 Visit Tomorrow — ' + l.society,         body: getBody(l, '24hr')  },
      { offset: 3600000,  type: '1hr',   title: '⏰ Visit in 1 Hour — ' + l.society,         body: getBody(l, '1hr')   },
      { offset: 1800000,  type: '30min', title: '🚨 Visit in 30 Minutes — ' + l.society,     body: getBody(l, '30min') },
    ];

    reminders.forEach(rem => {
      const delay = vt - rem.offset - now;
      if(delay > 0 && delay < 8 * 86400000) {
        const key = l.id + '_' + rem.type;
        scheduledTimers[key] = setTimeout(() => {
          self.registration.showNotification(rem.title, {
            body: rem.body,
            icon: '/SKM-property-manager/icon-192.png',
            badge: '/SKM-property-manager/icon-192.png',
            tag: 'skm_' + l.id + '_' + rem.type,
            vibrate: [200, 100, 200, 100, 200],
            requireInteraction: rem.type !== '24hr',
            data: { url: '/SKM-property-manager/' }
          });
        }, delay);
      }
    });
  });
}

function getBody(l, type) {
  const rent = l.rent >= 100 ? '₹' + (l.rent/100).toFixed(2) + 'L+' : '₹' + l.rent + 'K+';
  const dt = new Date(l.visitDate).toLocaleString('en-IN', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  const client = l.client ? ' with ' + l.client : '';
  if(type === '24hr')  return '📅 ' + dt + client + '\n' + l.bhk + ' · ' + rent + '\n⏰ Visit is tomorrow — be prepared!';
  if(type === '1hr')   return '📅 ' + dt + client + '\n' + l.bhk + ' · ' + rent + '\n🚗 Get ready — visit is in 1 hour!';
  if(type === '30min') return '📅 ' + dt + client + '\n' + l.bhk + ' · ' + rent + '\n🏃 Leave now — visit is in 30 minutes!';
}

// When user taps the notification, open the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(cls => {
      const appUrl = '/SKM-property-manager/';
      for(const c of cls) {
        if(c.url.includes('SKM-property-manager') && 'focus' in c) return c.focus();
      }
      if(clients.openWindow) return clients.openWindow(appUrl);
    })
  );
});
