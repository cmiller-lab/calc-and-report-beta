'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {webcrypto} = require('node:crypto');
const Core = require('../probe-core.js');
const {Store,toRemote,fromRemote} = require('../probe-store.js');
const TODAY = '2026-10-12';
const DEVICE = '11111111-1111-4111-8111-111111111111';
function record(overrides = {}, context = {}) {
  return Core.makeRecord({poolKey:'Aquatica|501',probeType:'ph',action:'inventory',dateCode:'G8',observedOn:TODAY,technician:'Test tech',...overrides},
    {id:webcrypto.randomUUID(),deviceId:DEVICE,today:TODAY,loggedAt:'2026-10-12T15:00:00Z',...context});
}
function remote(r) { return {...toRemote(r),source:r.source,source_ref:r.sourceRef,recorded_at:r.recordedAt || '2026-10-12T15:01:00Z'}; }
class MemoryAdapter {
  constructor() { this.rows = new Map(); this.fail = false; }
  async load() { return structuredClone([...this.rows.values()]); }
  async putMany(rows) { if (this.fail) throw new Error('Disk full'); for (const r of rows) this.rows.set(r.id,structuredClone(r)); }
  async merge(rows) { this.rows = new Map(Core.mergeRecords(await this.load(),rows).map(r => [r.id,structuredClone(r)])); }
}
test('all 120 codes resolve to the latest nonfuture month within a decade, including year/month boundaries',() => {
  for (const asOf of ['2026-01-01','2026-10-12','2026-12-31','2027-01-01','2035-02-28']) {
    for (let month = 0; month < 12; month++) for (let year = 0; year < 10; year++) {
      const code = String.fromCharCode(65+month)+year, result = Core.decodeCode(code,asOf);
      assert.equal(result.month,month+1); assert.equal(result.year%10,year);
      assert.ok(result.date <= asOf); assert.ok(Core.ageSince(result.date,asOf,true).months < 120);
    }
  }
  assert.equal(Core.decodeCode('L6',TODAY).date,'2016-12-01');
  assert.equal(Core.decodeCode('A7',TODAY).date,'2017-01-01');
  assert.equal(Core.decodeCode('A7','2027-01-01').date,'2027-01-01');
  assert.equal(Core.decodeCode(' a5 ',TODAY).date,'2025-01-01');
});
test('supplied image is fully represented, with PV/PX unknown and every CP-1 initially unrecorded',() => {
  const rows = Core.baselineRecords();
  assert.equal(Core.POOLS.length,27); assert.equal(rows.length,28);
  assert.deepEqual(rows.filter(r => !r.manufacturedMonth).map(r => [r.poolId,r.dateCode]),[['506','PV'],['509','PX']]);
  assert.equal(rows.filter(r => r.probeType === 'fc').length,0);
  const expected = {'501':['2018-07-01','2018-07-01'],'502':['2018-04-01','2018-06-01'],'503':['2025-01-01','2018-05-01'],
    '504':['2022-10-01','2022-09-01'],'505':['2017-08-01','2021-05-01'],'506':[null,'2018-06-01'],'507':['2018-07-01','2018-07-01'],
    '508':['2018-07-01','2018-07-01'],'509':[null,'2018-06-01'],'510':['2018-07-01','2018-06-01'],
    '512':['2018-07-01','2022-06-01'],'513':['2018-07-01','2018-05-01'],'520':['2023-01-01','2017-12-01'],'530':['2023-08-01','2018-06-01']};
  for (const [id,dates] of Object.entries(expected)) for (const [i,type] of ['ph','orp'].entries()) assert.equal(rows.find(r => r.poolId === id && r.probeType === type).manufacturedMonth,dates[i]);
});
test('stored manufacture dates do not switch decades when their code recurs',() => {
  const saved = record({dateCode:'A7'});
  assert.equal(saved.manufacturedMonth,'2017-01-01');
  assert.equal(Core.describeRecord(saved,'2028-01-01').age.months,132);
  assert.equal(fromRemote(remote(saved)).manufacturedMonth,'2017-01-01');
});
test('approximate manufacturing age and CP-1 service age handle leap days, month ends, and DST independently',() => {
  assert.equal(Core.ageSince('2017-08-01',TODAY,true).label,'9 yr 2 mo');
  assert.equal(Core.ageSince('2018-07-01',TODAY,true).label,'8 yr 3 mo');
  assert.equal(Core.ageSince(TODAY,TODAY).label,'0 d');
  assert.equal(Core.ageSince('2026-01-31','2026-02-28').months,0);
  assert.equal(Core.ageSince('2024-02-29','2024-03-01').days,1);
  assert.equal(Core.ageSince('2026-03-07','2026-03-09').days,2);
  assert.equal(Core.ageSince('2026-11-01',TODAY),null);
  assert.equal(Core.todayISO(new Date('2026-10-13T02:00:00Z')),TODAY);
});
test('CP-1 replacement history retains older sensors; backfilled replacements do not displace newer ones',() => {
  const old = record({probeType:'fc',action:'replacement',installedOn:'2024-06-05'});
  const latest = record({probeType:'fc',action:'replacement',installedOn:'2026-10-10'});
  const backfill = record({probeType:'fc',action:'replacement',installedOn:'2025-08-01'},{loggedAt:'2026-10-12T16:00:00Z'});
  const rows = [old,latest,backfill];
  assert.equal(Core.currentRecords(rows,TODAY).get('Aquatica|501|fc').id,latest.id);
  assert.equal(Core.historyRows(rows,TODAY).length,4);
  const newPh = record({dateCode:'A5'},{loggedAt:'2026-10-12T17:00:00Z'});
  assert.equal(Core.currentRecords([record(),newPh],TODAY).get('Aquatica|501|ph').id,newPh.id);
});
test('correcting a current CP-1 date updates its age while retaining older backfills',() => {
  const wrong = record({probeType:'fc',action:'replacement',installedOn:'2026-09-15'});
  const corrected = record({probeType:'fc',action:'inventory',installedOn:'2026-09-01'},{loggedAt:'2026-10-12T16:00:00Z'});
  const backfill = record({probeType:'fc',action:'replacement',installedOn:'2026-10-01'},{loggedAt:'2026-10-12T17:00:00Z'});
  const current = Core.currentRecords([wrong,corrected,backfill],TODAY).get('Aquatica|501|fc');
  assert.equal(current.id,corrected.id); assert.equal(Core.describeRecord(current,TODAY).age.days,41);
  const next = record({probeType:'fc',action:'replacement',installedOn:'2026-10-13',observedOn:'2026-10-13'},
    {today:'2026-10-13',loggedAt:'2026-10-13T15:00:00Z'});
  assert.equal(Core.currentRecords([wrong,corrected,backfill,next],'2026-10-13').get('Aquatica|501|fc').id,next.id);
});
test('invalid/future dates, unknown pools and missing CP-1 dates fail; unrecognized codes can be retained without invented age',() => {
  for (const invalid of [{poolKey:'Other|501'},{dateCode:'PV'},{observedOn:'2026-02-30'},{observedOn:'2026-10-13'},
    {probeType:'fc',installedOn:''},{probeType:'fc',installedOn:'2026-10-13'},{technician:' '},{notes:'x'.repeat(2001)}]) assert.throws(() => record(invalid));
  const unknown = record({unknown:true,rawCode:'PV'});
  assert.equal(unknown.manufacturedMonth,null); assert.equal(unknown.dateCode,'PV'); assert.equal(Core.describeRecord(unknown,TODAY).age,null);
});
test('CSV includes all pools, both source codes and dates, pending status, and spreadsheet formula protection',() => {
  const rows = Core.overviewRows(Core.baselineRecords(),TODAY);
  assert.equal(rows.length,28); assert.equal(rows[0].length,22);
  assert.ok(rows.some(row => row[1] === '512')); assert.ok(rows.some(row => row[1] === '513'));
  assert.equal(rows[1][4],'G8'); assert.equal(rows[1][5],'2018-07-01'); assert.equal(rows[1][7],'8 yr 3 mo');
  const dangerous = record({technician:'=HYPERLINK("https://example.invalid")',notes:'+SUM(1,2)\n"quoted"'});
  const exported = Core.csv(Core.historyRows([dangerous],TODAY));
  assert.ok(exported.startsWith('\uFEFF')); assert.ok(exported.includes("'=HYPERLINK")); assert.ok(exported.includes("'+SUM")); assert.ok(exported.includes('""quoted""'));
  assert.equal(Core.overviewRows([dangerous],TODAY,[Core.POOLS[0]])[1][9],'pending');
});
test('cloud baseline replaces its bundled placeholder; pending local writes survive a pull',() => {
  const baseline = Core.baselineRecords()[0], shared = {...baseline,id:webcrypto.randomUUID(),syncStatus:'synced'};
  const pending = record(), differing = {...pending,notes:'remote copy',syncStatus:'synced'};
  const merged = Core.mergeRecords([baseline,pending],[shared,differing]);
  assert.equal(merged.length,2); assert.ok(!merged.some(r => r.id === baseline.id));
  assert.equal(merged.find(r => r.id === pending.id).notes,'');
});
test('offline saves persist across reloads; failed durable writes are not reported as saves',async () => {
  const adapter = new MemoryAdapter(), store = new Store({adapter,online:() => false,fetch:() => {throw new Error('Unexpected network');}});
  await store.init(); const saved = record(); await store.save(saved); await store.sync();
  const reloaded = new Store({adapter,online:() => false}); await reloaded.init();
  assert.equal(reloaded.rows.find(r => r.id === saved.id).syncStatus,'pending');
  assert.equal(reloaded.rows.length,29);
  adapter.fail = true; const lost = record(); await assert.rejects(store.save(lost),/Disk full/);
  assert.ok(!store.rows.some(r => r.id === lost.id));
});
test('failed cloud pushes remain queued; retry is idempotent and a second technician receives shared records',async () => {
  const shared = new Map(); let fail = true, posts = 0;
  const fetch = async (url,options) => {
    if (options.method === 'POST') {
      posts++; if (fail) return new Response('',{status:503});
      const row = JSON.parse(options.body); if (!shared.has(row.id)) shared.set(row.id,{...row,source_ref:null,recorded_at:'2026-10-12T15:05:00Z'});
      return new Response(null,{status:201});
    }
    return new Response(JSON.stringify([...shared.values()]),{status:200});
  };
  const adapter = new MemoryAdapter(), first = new Store({adapter,online:() => true,fetch}); await first.init();
  const saved = record({probeType:'fc',action:'replacement',installedOn:TODAY}); await first.save(saved); await first.sync();
  assert.ok(first.error); assert.equal(first.rows.find(r => r.id === saved.id).syncStatus,'pending');
  fail = false; await first.sync(); assert.equal(first.error,null); assert.equal(shared.size,1);
  await adapter.putMany([saved]); await first.sync(); assert.equal(shared.size,1); assert.equal(posts,3);
  const second = new Store({adapter:new MemoryAdapter(),online:() => true,fetch}); await second.init(); await second.sync();
  assert.equal(second.rows.find(r => r.id === saved.id).installedOn,TODAY);
});
test('shared history is fully paginated beyond the API row limit',async () => {
  const rows = Array.from({length:1001},(_,i) => remote(record({notes:String(i)}))); let calls = 0;
  const fetch = async url => {calls++; const offset = Number(new URL(url).searchParams.get('offset')); return new Response(JSON.stringify(rows.slice(offset,offset+500)));};
  const store = new Store({adapter:new MemoryAdapter(),online:() => true,fetch}); await store.init(); await store.sync();
  assert.equal(calls,3); assert.equal(store.rows.filter(r => r.source === 'field').length,1001);
});

function workerHarness(network = async () => {throw new Error('Offline');}) {
  const listeners = {}, stores = new Map(), origin = 'https://cmiller-lab.github.io', scope = origin+'/calc-and-report-beta/';
  const caches = {
    async keys() {return [...stores.keys()];}, async delete(key) {return stores.delete(key);},
    async open(key) {
      if (!stores.has(key)) stores.set(key,new Map()); const rows = stores.get(key);
      return {async addAll(paths) {for (const asset of paths) rows.set(new URL(asset,scope).href,new Response(asset));},
        async put(key,response) {rows.set(key,response);}, async match(key) {return rows.get(key)?.clone();}};
    }
  };
  const ctx = vm.createContext({URL,Response,Set,Promise,caches,fetch:network,self:{registration:{scope},location:{origin},clients:{claim:async () => {}},skipWaiting:async () => {},addEventListener:(type,fn) => {listeners[type] = fn;}}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../service-worker.js'),'utf8'),ctx);
  return {ctx,listeners,stores,caches,scope,async event(type) {let promise; listeners[type]({waitUntil:p => {promise = p;}}); await promise;},
    async get(file,mode = 'navigate',method = 'GET') {let promise; listeners.fetch({request:{url:new URL(file,scope).href,mode,method},respondWith:p => {promise = p;}}); return promise ? await promise : null;}};
}
test('offline pages use their own cached HTML for query variants, and cache cleanup preserves other PWAs',async () => {
  const w = workerHarness(); await w.event('install');
  await w.caches.open('production-cache'); await w.caches.open('seaworld-chemistry-console-v15.11-maintenance-1');
  await w.caches.open('sw-chemistry-beta:/calc-and-report-beta/:old'); await w.event('activate');
  assert.ok(w.stores.has('production-cache')); assert.ok(w.stores.has('seaworld-chemistry-console-v15.11-maintenance-1'));
  assert.ok(!w.stores.has('sw-chemistry-beta:/calc-and-report-beta/:old'));
  assert.equal(await (await w.get('probes.html?check=1')).text(),'./probes.html');
  assert.equal(await (await w.get('calibration.html?embedded=1')).text(),'./calibration.html');
  assert.equal(await (await w.get('index.html?version=15.12')).text(),'./index.html');
  assert.equal(await (await w.get('./?version=15.11')).text(),'./index.html');
  assert.equal(await w.get('https://eseqjmcsdwqyohmoabnq.supabase.co/rest/v1/probe_events','cors'),null);
  assert.equal(await w.get('../SW-calc-dashboard-v2/','navigate'),null);
  assert.equal(await w.get('probes.html','navigate','POST'),null);
});
test('failed navigation responses cannot poison the precache',async () => {
  const w = workerHarness(async () => new Response('Not found',{status:404})); await w.event('install');
  assert.equal(await (await w.get('probes.html')).text(),'./probes.html');
});
test('dashboard and standalone entry points compile, link tracker assets, and include a responsive table layout',() => {
  for (const filename of ['index.html','probes.html']) {
    const html = fs.readFileSync(path.join(__dirname,'..',filename),'utf8');
    for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) if (!/\bsrc\s*=/.test(script[1])) new vm.Script(script[2],{filename});
    for (const file of ['probe-core.js','probe-store.js','probe-tracker.js','probe-tracker.css']) assert.ok(html.includes(file));
    assert.equal((html.match(/id="probeTrackerRoot"/g) || []).length,1);
  }
  const index = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.ok(index.includes("showTab('probes')")); assert.ok(index.includes("'calibration','probes'"));
  assert.ok(!index.includes('caches.delete('));
  const css = fs.readFileSync(path.join(__dirname,'../probe-tracker.css'),'utf8');
  assert.ok(css.includes('@media(max-width:760px)')); assert.ok(css.includes('@media(max-width:430px)'));
  assert.ok(css.includes('font-size:16px')); assert.ok(css.includes('[hidden]{display:none!important}'));
});
