(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProbeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const TYPES = {ph:'pH', orp:'ORP', fc:'FC · CP-1'};
  const POOLS = [
    ['Aquatica','501','Cutback Cove'], ['Aquatica','502','Big Surf Shores'], ['Aquatica','503','Omaka Rocka'],
    ['Aquatica','504','Katas Kookaburra'], ['Aquatica','505',"Roa's Rapids"], ['Aquatica','506','Whanau Way'],
    ['Aquatica','507','Walkabout Waters'], ['Aquatica','508','Ray Rush/Whahalla Wave'], ['Aquatica','509','Loggerhead/Tassie'],
    ['Aquatica','510','Dolphin Plunge'], ['Aquatica','511','511'], ['Aquatica','512','512'], ['Aquatica','513','513'], ['Aquatica','520','Ihu Breakaway Falls'],
    ['Aquatica','530','Taumata Racer'], ['Aquatica','540','KareKareKurl'], ['Aquatica','550','Riptide'],
    ['SeaWorld','Infinity Falls 1','Infinity Falls 1'], ['SeaWorld','Infinity Falls 2','Infinity Falls 2'],
    ['SeaWorld','Kraken','Kraken'], ['SeaWorld','Manta Pond','Manta Pond'], ['SeaWorld','Main Gate','Main Gate'],
    ['SeaWorld','Journey to Atlantis','Journey to Atlantis'], ['SeaWorld','Sesame','Sesame'], ['SeaWorld','Pearl','Pearl'],
    ['Discovery Cove','Tropical River/Resort Pool','Tropical River/Resort Pool'], ['Discovery Cove','Freshwater Oasis','Freshwater Oasis']
  ].map(([property,id,name]) => Object.freeze({property,id,name,key:property+'|'+id}));
  const BASELINE_CODES = {
    '501':['G8','G8'], '502':['D8','F8'], '503':['A5','E8'], '504':['J2','I2'], '505':['H7','E1'],
    '506':['PV','F8'], '507':['G8','G8'], '508':['G8','G8'], '509':['PX','F8'], '510':['G8','F8'],
    '512':['G8','F2'], '513':['G8','E8'], '520':['A3','L7'], '530':['H3','F8']
  };
  function dateParts(iso) {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const [year,month,day] = iso.split('-').map(Number);
    if (year < 2000 || year > 2199) return null;
    const date = new Date(Date.UTC(year,month-1,day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month-1 || date.getUTCDate() !== day) return null;
    return {year,month,day,time:date.getTime()};
  }
  function todayISO(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
    const get = type => parts.find(part => part.type === type).value;
    return get('year')+'-'+get('month')+'-'+get('day');
  }
  function decodeCode(raw, asOf = todayISO()) {
    const code = String(raw || '').trim().toUpperCase();
    const ref = dateParts(asOf);
    if (!ref) throw new Error('Enter a valid record date.');
    if (!/^[A-L][0-9]$/.test(code)) return {code,date:null,error:'Use A–L followed by one year digit, or record the code as unknown.'};
    const month = code.charCodeAt(0)-64;
    const digit = Number(code[1]);
    let year = Math.floor(ref.year/10)*10+digit;
    if (year > ref.year || (year === ref.year && month > ref.month)) year -= 10;
    const date = year+'-'+String(month).padStart(2,'0')+'-01';
    return {code,date,year,month,label:MONTHS[month-1]+' '+year,error:null};
  }
  function ageSince(start, asOf = todayISO(), monthOnly = false) {
    const a = dateParts(start), b = dateParts(asOf);
    if (!a || !b || start > asOf) return null;
    let months = (b.year-a.year)*12+b.month-a.month;
    if (!monthOnly && b.day < a.day) months--;
    const days = Math.floor((b.time-a.time)/86400000);
    const years = Math.floor(months/12), remainder = months%12;
    const label = months === 0 ? (monthOnly ? '<1 mo' : days+' d') : (years ? years+' yr'+(remainder ? ' '+remainder+' mo' : '') : remainder+' mo');
    return {months,days,years,remainder,label};
  }
  function formatDate(iso, monthOnly = false) {
    const p = dateParts(iso);
    if (!p) return 'Unknown';
    return monthOnly ? MONTHS[p.month-1].slice(0,3)+' '+p.year : MONTHS[p.month-1].slice(0,3)+' '+p.day+', '+p.year;
  }
  function makeRecord(input, context = {}) {
    const today = context.today || todayISO(), observedOn = input.observedOn || today;
    const pool = POOLS.find(p => p.key === input.poolKey);
    if (!pool) throw new Error('Select a body of water.');
    if (!Object.hasOwn(TYPES,input.probeType)) throw new Error('Select a probe type.');
    if (!dateParts(observedOn) || observedOn > today) throw new Error('Record date must be valid and cannot be in the future.');
    const technician = String(input.technician || '').trim();
    if (!technician || technician.length > 80) throw new Error('Enter a technician name (1–80 characters).');
    const notes = String(input.notes || '').trim();
    if (notes.length > 2000) throw new Error('Notes must be 2,000 characters or fewer.');
    if (!['inventory','replacement'].includes(input.action)) throw new Error('Select a record action.');
    let dateCode = null, manufacturedMonth = null, installedOn = null;
    if (input.probeType === 'fc') {
      installedOn = input.installedOn || null;
      if (!dateParts(installedOn) || installedOn > observedOn) throw new Error('Enter a valid CP-1 installation/replacement date on or before the record date.');
    } else if (input.unknown) {
      dateCode = String(input.rawCode || '').trim().toUpperCase() || null;
      if (dateCode && dateCode.length > 12) throw new Error('Unknown codes must be 12 characters or fewer.');
    } else {
      const decoded = decodeCode(input.dateCode,observedOn);
      if (decoded.error) throw new Error(decoded.error);
      dateCode = decoded.code;
      manufacturedMonth = decoded.date;
    }
    return {id:context.id || crypto.randomUUID(),poolKey:pool.key,property:pool.property,poolId:pool.id,poolName:pool.name,
      probeType:input.probeType,action:input.action,dateCode,manufacturedMonth,installedOn,observedOn,
      technician,notes,deviceId:context.deviceId,loggedAt:context.loggedAt || new Date().toISOString(),
      recordedAt:null,source:'field',sourceRef:null,syncStatus:'pending'};
  }
  function baselineRecords() {
    return Object.entries(BASELINE_CODES).flatMap(([id,codes]) => codes.map((code,i) => {
      const pool = POOLS.find(p => p.property === 'Aquatica' && p.id === id);
      const probeType = i === 0 ? 'ph' : 'orp', sourceRef = 'IMG_7339:2026-10-12:'+id+':'+probeType;
      const decoded = decodeCode(code,'2026-10-12');
      return {id:'baseline:'+sourceRef,poolKey:pool.key,property:pool.property,poolId:id,poolName:pool.name,
        probeType,action:'inventory',dateCode:code,manufacturedMonth:decoded.date,installedOn:null,
        observedOn:'2026-10-12',technician:'Supplied inventory',notes:decoded.error?'Code needs physical verification.':'Imported from supplied probe inventory photo.',
        loggedAt:'2026-10-12T12:00:00Z',recordedAt:null,deviceId:null,source:'baseline',sourceRef,syncStatus:'baseline'};
    }));
  }
  function mergeRecords(local, remote) {
    const rows = new Map(local.map(r => [r.id,r]));
    const refs = new Set(remote.map(r => r.sourceRef).filter(Boolean));
    for (const [id,r] of rows) if (r.syncStatus === 'baseline' && refs.has(r.sourceRef)) rows.delete(id);
    for (const r of remote) if (!rows.has(r.id) || rows.get(r.id).syncStatus !== 'pending') rows.set(r.id,r);
    return [...rows.values()];
  }
  // A current-inventory correction is authoritative on its record date. Replacement
  // backfills retain their actual installation ordering so older sensors stay historical.
  function effectiveOn(r) { return r.probeType === 'fc' && r.action === 'replacement' ? r.installedOn || r.observedOn : r.observedOn; }
  function compareRecords(a,b) {
    return effectiveOn(a).localeCompare(effectiveOn(b)) || a.loggedAt.localeCompare(b.loggedAt) || (a.recordedAt || '').localeCompare(b.recordedAt || '') || a.id.localeCompare(b.id);
  }
  function currentRecords(records, asOf = todayISO()) {
    const current = new Map();
    for (const r of records) {
      if (effectiveOn(r) > asOf) continue;
      const key = r.poolKey+'|'+r.probeType, prior = current.get(key);
      if (!prior || compareRecords(r,prior) > 0) current.set(key,r);
    }
    return current;
  }
  function describeRecord(record, asOf = todayISO()) {
    if (!record) return {date:null,basis:'Not recorded',age:null,status:'missing'};
    const monthOnly = record.probeType !== 'fc';
    const date = monthOnly ? record.manufacturedMonth : record.installedOn;
    const age = ageSince(date,asOf,monthOnly);
    const status = !age ? 'unknown' : monthOnly && age.months >= 96 ? 'old' : monthOnly && age.months >= 60 ? 'watch' : 'tracked';
    return {date,basis:monthOnly?'Manufactured (month only)':'Installed/replaced',age,status};
  }
  function csvCell(value) {
    let text = value == null ? '' : String(value);
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  }
  function csv(rows) { return '\uFEFF'+rows.map(row => row.map(csvCell).join(',')).join('\r\n')+'\r\n'; }
  function overviewRows(records, asOf = todayISO(), pools = POOLS) {
    const current = currentRecords(records,asOf);
    const header = ['Property','Body of water ID','Body of water','Age as of (America/New_York)'];
    for (const type of ['ph','orp','fc']) header.push(TYPES[type]+' code',TYPES[type]+' date',TYPES[type]+' date basis',TYPES[type]+' age',TYPES[type]+' age months',TYPES[type]+' sync');
    return [header,...pools.map(pool => {
      const row = [pool.property,pool.id,pool.name,asOf];
      for (const type of ['ph','orp','fc']) {
        const r = current.get(pool.key+'|'+type), d = describeRecord(r,asOf);
        row.push(r?.dateCode || '',d.date || '',d.basis,d.age?.label || 'Unknown',d.age?.months ?? '',r?.syncStatus || 'Not recorded');
      }
      return row;
    })];
  }
  function historyRows(records, asOf = todayISO(), pools = POOLS) {
    const keys = new Set(pools.map(p => p.key));
    return [['Property','Body of water ID','Body of water','Probe','Action','Date code','Manufactured month (first day represents month only)',
      'Installed/replaced on','Record date','Age as of (America/New_York)','Age','Age months','Days since CP-1 installation','Technician','Notes','Logged at (UTC)','Source','Sync status','Record ID'],
    ...records.filter(r => keys.has(r.poolKey)).sort((a,b) => compareRecords(b,a)).map(r => {
      const d = describeRecord(r,asOf);
      return [r.property,r.poolId,r.poolName,TYPES[r.probeType],r.action,r.dateCode,r.manufacturedMonth,r.installedOn,
        r.observedOn,asOf,d.age?.label || 'Unknown',d.age?.months ?? '',r.probeType === 'fc' ? d.age?.days ?? '' : '',
        r.technician,r.notes,r.loggedAt,r.source,r.syncStatus,r.id];
    })];
  }
  return {MONTHS,TYPES,POOLS,BASELINE_CODES,dateParts,todayISO,decodeCode,ageSince,formatDate,makeRecord,baselineRecords,
    mergeRecords,effectiveOn,compareRecords,currentRecords,describeRecord,csv,overviewRows,historyRows};
});
