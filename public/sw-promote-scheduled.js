// public/sw-promote-scheduled.js
// Service worker module for promoting scheduled prescriptions
// Registered via Workbox in vite.config.ts

const DB_NAME = 'rxscan-db';
const DB_VERSION = 2;

async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('prescriptions')) {
        const store = db.createObjectStore('prescriptions', { keyPath: 'id', autoIncrement: true });
        store.createIndex('by_dedup_key', ['reference_number', 'patient_national_id'], { unique: true });
        store.createIndex('by_status', 'status');
        store.createIndex('by_queue_position', 'queue_position');
        store.createIndex('by_status_queue_position', ['status', 'queue_position']);
        store.createIndex('by_patient_national_id', 'patient_national_id');
        store.createIndex('by_scheduled_date', 'scheduled_date');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

function todayISO() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function nowISO() {
  return new Date().toISOString();
}

async function promoteScheduled() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('prescriptions', 'readwrite');
    const store = tx.objectStore('prescriptions');
    const index = store.index('by_status');
    
    const scheduledRequest = index.getAll('scheduled');
    scheduledRequest.onsuccess = () => {
      const scheduled = scheduledRequest.result;
      const today = todayISO();
      const toOverdue: number[] = [];
      const toDueToday: number[] = [];
      
      for (const rx of scheduled) {
        if (!rx.scheduled_date || !rx.id) continue;
        if (rx.scheduled_date < today) toOverdue.push(rx.id);
        else if (rx.scheduled_date === today) toDueToday.push(rx.id);
      }
      
      if (!toOverdue.length && !toDueToday.length) {
        resolve({ overdue: 0, dueToday: 0 });
        return;
      }
      
      const now = nowISO();
      let completed = 0;
      const total = toOverdue.length + toDueToday.length;
      
      function checkDone() {
        completed++;
        if (completed >= total) {
          resolve({ overdue: toOverdue.length, dueToday: toDueToday.length });
        }
      }
      
      for (const id of toOverdue) {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const existing = getReq.result;
          if (existing) {
            store.put({ ...existing, status: 'overdue', queue_position: null, updated_at: now });
          }
          checkDone();
        };
      }
      
      for (const id of toDueToday) {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const existing = getReq.result;
          if (existing) {
            store.put({ ...existing, status: 'due_today', queue_position: null, updated_at: now });
          }
          checkDone();
        };
      }
    };
    
    tx.onerror = () => reject(tx.error);
  });
}

// Run on SW activation
self.addEventListener('activate', (event) => {
  event.waitUntil(promoteScheduled());
});

// Listen for periodic sync (requires user permission)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'promote-scheduled') {
    event.waitUntil(promoteScheduled());
  }
});

// Listen for message from main thread
self.addEventListener('message', (event) => {
  if (event.data?.type === 'PROMOTE_SCHEDULED') {
    event.waitUntil(promoteScheduled().then(result => {
      event.ports[0]?.postMessage({ type: 'PROMOTE_SCHEDULED_RESULT', result });
    }));
  }
});

console.log('[SW] promote-scheduled module loaded');