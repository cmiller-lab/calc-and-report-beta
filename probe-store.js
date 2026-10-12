(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./probe-core.js'));
  else root.ProbeStorage = factory(root.ProbeCore);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
  'use strict';
  const DB_NAME = 'seaworld-probes-beta-v1';
  // The same public anon key and shared operational project used by calibration.html.
  // Never put a service-role key in a browser bundle.
  const API_URL = 'https://eseqjmcsdwqyohmoabnq.supabase.co/rest/v1/probe_events';
  const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZXFqbWNzZHdxeW9obW9hYm5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MjUxMTIsImV4cCI6MjEwNDIwMTExMn0.PIqeyV12we4gCuyFXYwcN9-tCgc-rIhYud2DuUhxqlQ';
  function indexedAdapter(factory = globalThis.indexedDB) {
    let connection;
    function open() {
      if (connection) return connection;
      connection = new Promise((resolve,reject) => {
        if (!factory) { reject(new Error('This browser cannot store offline probe records.')); return; }
        const request = factory.open(DB_NAME,1);
        request.onupgradeneeded = () => request.result.createObjectStore('events',{keyPath:'id'});
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Close another probe tracker tab and try again.'));
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); connection = null; };
          resolve(db);
        };
      }).catch(error => { connection = null; throw error; });
      return connection;
    }
    return {
      async load() {
        const db = await open();
        return new Promise((resolve,reject) => {
          const tx = db.transaction('events','readonly'), request = tx.objectStore('events').getAll();
          tx.oncomplete = () => resolve(request.result);
          tx.onerror = tx.onabort = () => reject(tx.error || new Error('Unable to read offline probe records.'));
        });
      },
      async putMany(records) {
        const db = await open();
        return new Promise((resolve,reject) => {
          const tx = db.transaction('events','readwrite');
          const store = tx.objectStore('events');
          for (const record of records) store.put(record);
          // Resolve only when the transaction is durably committed.
          tx.oncomplete = () => resolve();
          tx.onerror = tx.onabort = () => reject(tx.error || new Error('Probe record could not be saved on this device.'));
        });
      },
      async merge(remote) {
        const db = await open();
        return new Promise((resolve,reject) => {
          const tx = db.transaction('events','readwrite'), store = tx.objectStore('events'), request = store.getAll();
          request.onsuccess = () => {
            const merged = Core.mergeRecords(request.result,remote), ids = new Set(merged.map(r => r.id));
            for (const row of request.result) if (!ids.has(row.id)) store.delete(row.id);
            for (const row of merged) store.put(row);
          };
          tx.oncomplete = () => resolve();
          tx.onerror = tx.onabort = () => reject(tx.error || new Error('Could not save shared probe records locally.'));
        });
      }
    };
  }
  function toRemote(r) {
    return {id:r.id,pool_key:r.poolKey,property:r.property,pool_id:r.poolId,pool_name:r.poolName,probe_type:r.probeType,
      action:r.action,date_code:r.dateCode,manufactured_month:r.manufacturedMonth,installed_on:r.installedOn,
      observed_on:r.observedOn,technician:r.technician,notes:r.notes,device_id:r.deviceId,logged_at:r.loggedAt,source:'field'};
  }
  function fromRemote(r) {
    const pool = Core.POOLS.find(p => p.key === r.pool_key);
    if (!pool || !Object.hasOwn(Core.TYPES,r.probe_type)) throw new Error('Shared probe record has an unrecognized pool or probe type.');
    return {id:r.id,poolKey:r.pool_key,property:pool.property,poolId:pool.id,poolName:pool.name,probeType:r.probe_type,
      action:r.action,dateCode:r.date_code,manufacturedMonth:r.manufactured_month,installedOn:r.installed_on,
      observedOn:r.observed_on,technician:r.technician,notes:r.notes || '',deviceId:r.device_id,
      loggedAt:r.logged_at,recordedAt:r.recorded_at,source:r.source,sourceRef:r.source_ref,syncStatus:'synced'};
  }
  class Store {
    constructor(options = {}) {
      this.adapter = options.adapter || indexedAdapter();
      this.fetch = options.fetch || globalThis.fetch.bind(globalThis);
      this.online = options.online || (() => globalThis.navigator.onLine);
      this.onChange = options.onChange || (() => {});
      this.rows = [];
      this.syncing = false;
      this.lastSync = null;
      this.error = null;
      this.ready = false;
      this.syncPromise = null;
    }
    notify() { this.onChange(this); }
    async init() {
      const saved = await this.adapter.load();
      const savedRefs = new Set(saved.map(r => r.sourceRef).filter(Boolean));
      const baseline = Core.baselineRecords().filter(r => !savedRefs.has(r.sourceRef));
      await this.adapter.putMany(baseline);
      this.rows = await this.adapter.load(); this.ready = true; this.notify();
      return this.rows;
    }
    async save(record) {
      if (!this.ready) throw new Error('Offline storage is not ready. Reload and try again.');
      await this.adapter.putMany([record]);
      this.rows = await this.adapter.load(); this.notify();
      return record;
    }
    headers(extra = {}) { return {apikey:API_KEY,Authorization:'Bearer '+API_KEY,'Content-Type':'application/json',...extra}; }
    async request(url,options = {}) {
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(),15000);
      try {
        const response = await this.fetch(url,{...options,signal:controller.signal,cache:'no-store'});
        if (!response.ok) {
          const error = new Error(response.status === 404 ? 'Shared probe storage is not available yet.' : 'Shared sync failed (HTTP '+response.status+'). Local records are retained.');
          error.status = response.status;
          throw error;
        }
        return response;
      } finally { clearTimeout(timeout); }
    }
    async pull() {
      const remote = [];
      for (let offset = 0; ; offset += 500) {
        const response = await this.request(API_URL+'?select=*&order=recorded_at.asc,id.asc&limit=500&offset='+offset,{headers:this.headers()});
        const page = await response.json();
        if (!Array.isArray(page)) throw new Error('Shared storage returned an invalid response. Local records are retained.');
        remote.push(...page.map(fromRemote));
        if (page.length < 500) break;
      }
      await this.adapter.merge(remote);
    }
    sync() {
      if (this.syncPromise) return this.syncPromise;
      if (!this.ready || !this.online()) { this.notify(); return Promise.resolve(); }
      this.syncPromise = this.runSync().finally(() => { this.syncPromise = null; });
      return this.syncPromise;
    }
    async runSync() {
      this.syncing = true; this.error = null; this.notify();
      try {
        const pending = (await this.adapter.load()).filter(r => r.syncStatus === 'pending');
        for (const record of pending) {
          await this.request(API_URL+'?on_conflict=id',{method:'POST',headers:this.headers({Prefer:'resolution=ignore-duplicates,return=minimal'}),body:JSON.stringify(toRemote(record))});
          // UUIDs make retries idempotent. No remote UPDATE/DELETE privileges are needed.
          await this.adapter.putMany([{...record,syncStatus:'synced'}]);
        }
        await this.pull();
        this.lastSync = new Date().toISOString();
      } catch (error) { this.error = error.message || 'Sync failed. Local records are retained.'; }
      finally {
        this.syncing = false;
        try { this.rows = await this.adapter.load(); } catch (error) { this.error = error.message; }
        this.notify();
      }
    }
  }
  return {Store,indexedAdapter,toRemote,fromRemote,DB_NAME,API_URL};
});
