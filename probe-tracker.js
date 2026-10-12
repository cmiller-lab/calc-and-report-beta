(function () {
  'use strict';
  const root = document.getElementById('probeTrackerRoot');
  if (!root) return;
  const Core = window.ProbeCore, $ = id => root.querySelector('#pt-'+id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const properties = [...new Set(Core.POOLS.map(p => p.property))];
  const pref = name => { try { return localStorage.getItem('sw.probes.beta.'+name) || ''; } catch { return ''; } };
  const savePref = (name,value) => { try { localStorage.setItem('sw.probes.beta.'+name,value); } catch {} };
  const option = (value,label) => '<option value="'+esc(value)+'">'+esc(label)+'</option>';
  const poolLabel = p => p.id === p.name ? p.name : p.id+' — '+p.name;
  let saving = false, historyLimit = 20;
  let deviceId = pref('deviceId');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deviceId)) {
    deviceId = crypto.randomUUID(); savePref('deviceId',deviceId);
  }
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('sw-probes-beta') : null;
  root.innerHTML = `
    <div class="pt-head">
      <div><p class="pt-kicker">WATER QUALITY · PROBE INVENTORY</p><h2>Probe age tracker</h2>
      <p>pH &amp; ORP manufacturing age. CP-1 free chlorine time since replacement.</p></div>
      <div class="pt-sync-box"><span id="pt-sync" role="status" aria-live="polite">Opening offline storage…</span><button type="button" id="pt-syncNow">Sync now</button></div>
    </div>
    <p class="pt-notice" id="pt-storageError" role="alert" hidden></p>
    <div class="pt-stats" aria-label="Probe inventory summary">
      <div><span>Bodies of water</span><strong id="pt-poolCount">27</strong></div>
      <div><span>Ages recorded</span><strong id="pt-trackedCount">—</strong></div>
      <div><span>pH / ORP 8+ years</span><strong id="pt-oldCount">—</strong></div>
      <div><span>Unknown / unrecorded</span><strong id="pt-unknownCount">—</strong></div>
    </div>
    <section class="pt-card" aria-labelledby="pt-inventoryTitle">
      <div class="pt-section-head"><div><h3 id="pt-inventoryTitle">Pool overview</h3><p id="pt-asOf"></p></div>
      <div class="pt-export"><button type="button" id="pt-exportOverview">Export pool spreadsheet</button><button type="button" id="pt-exportHistory">Export probe history</button></div></div>
      <div class="pt-filters">
        <div><label for="pt-filter">Property</label><select id="pt-filter">${option('all','All properties')+properties.map(p => option(p,p)).join('')}</select></div>
        <div><label for="pt-search">Find body of water</label><input type="search" id="pt-search" placeholder="Pool number or name" autocomplete="off"></div>
        <label class="pt-check"><input type="checkbox" id="pt-oldest">Oldest first</label>
      </div>
      <p class="pt-help">Date-code ages are approximate. The 5- and 8-year markers are planning cues for pH/ORP; they do not determine probe condition. CP-1 uses its replacement date.</p>
      <div class="pt-table-wrap"><table class="pt-table"><caption class="pt-sr">Current pH, ORP and CP-1 probe ages for each body of water</caption>
        <thead><tr><th scope="col">Body of water</th><th scope="col">pH</th><th scope="col">ORP</th><th scope="col">FC · CP-1</th></tr></thead><tbody id="pt-overview"></tbody>
      </table></div>
      <p id="pt-empty" class="pt-help" hidden>No bodies of water match this search.</p>
      <p class="pt-help">Exports contain the displayed pools and their records, including pending offline saves. CSV files open in Excel, Numbers, and Google Sheets; ages are a snapshot of the export date.</p>
    </section>
    <section class="pt-card" id="pt-entry" aria-labelledby="pt-entryTitle">
      <div class="pt-section-head"><div><h3 id="pt-entryTitle">Record a probe</h3><p>Each save retains the previous record in history.</p></div></div>
      <form id="pt-form">
        <div class="pt-form-grid">
          <div><label for="pt-property">Property</label><select id="pt-property">${properties.map(p => option(p,p)).join('')}</select></div>
          <div><label for="pt-pool">Body of water</label><select id="pt-pool" required></select></div>
          <div><label for="pt-type">Probe</label><select id="pt-type">${Object.entries(Core.TYPES).map(([key,label]) => option(key,label)).join('')}</select></div>
          <div><label for="pt-action">Action</label><select id="pt-action">${option('inventory','Record / correct current probe')+option('replacement','Probe replaced')}</select></div>
          <div><label for="pt-tech">Technician</label><input id="pt-tech" autocomplete="name" maxlength="80" required placeholder="Technician name"></div>
          <div><label for="pt-observed">Record / replacement date</label><input type="date" id="pt-observed" min="2000-01-01" required></div>
        </div>
        <div id="pt-coded" class="pt-input-block">
          <label class="pt-check"><input type="checkbox" id="pt-unknown">Code missing, illegible, or does not follow A–L + digit</label>
          <div id="pt-codeFields" class="pt-form-grid">
            <div><label for="pt-month">Month letter</label><select id="pt-month">${option('','Select month')+Core.MONTHS.map((month,i) => option(String.fromCharCode(65+i),String.fromCharCode(65+i)+' — '+month)).join('')}</select></div>
            <div><label for="pt-year">Year digit</label><select id="pt-year">${option('','Select year digit')+Array.from({length:10},(_,i) => option(String(i),String(i))).join('')}</select></div>
          </div>
          <div id="pt-rawWrap" hidden><label for="pt-raw">Observed code (optional)</label><input id="pt-raw" maxlength="12" autocomplete="off" placeholder="e.g. PV or PX"></div>
          <p class="pt-help">A = January through L = December. We choose the most recent matching month/year that has occurred, within the last 10 years, and retain that resolved date. Manufacturing age does not establish time in service.</p>
        </div>
        <div id="pt-cp" class="pt-input-block" hidden>
          <label for="pt-installed">CP-1 installation / replacement date</label><input type="date" id="pt-installed" min="2000-01-01">
          <p class="pt-help">CP-1 has no date code. Enter the actual day it was installed or changed. Existing sensors remain unknown until their date is known.</p>
        </div>
        <div class="pt-preview" id="pt-preview" role="status" aria-live="polite">Select a date code to see its date and age.</div>
        <div><label for="pt-notes">Notes (optional)</label><textarea id="pt-notes" rows="2" maxlength="2000" placeholder="Probe condition, serial number, or replacement details"></textarea></div>
        <div class="pt-save-row"><button type="submit" class="pt-primary" id="pt-save" disabled>Save probe record</button><span id="pt-saveStatus" role="status" aria-live="polite"></span></div>
      </form>
    </section>
    <details class="pt-card" id="pt-historyDetails"><summary>Probe history · <span id="pt-historyPool"></span></summary>
      <p class="pt-help">History follows the body of water selected in the form. Earlier CP-1 replacements are retained; entering an older replacement does not replace a newer one in the overview.</p>
      <div id="pt-history"></div><button type="button" id="pt-more" hidden>Show more records</button>
    </details>`;

  const store = new window.ProbeStorage.Store({onChange:render});
  function filteredPools() {
    const query = $('search').value.trim().toLowerCase(), property = $('filter').value;
    const pools = Core.POOLS.filter(p => (property === 'all' || p.property === property) && (p.id+' '+p.name+' '+p.property).toLowerCase().includes(query));
    if ($('oldest').checked) {
      const current = Core.currentRecords(store.rows), age = pool => Math.max(-1,...['ph','orp','fc'].map(type => Core.describeRecord(current.get(pool.key+'|'+type)).age?.months ?? -1));
      pools.sort((a,b) => age(b)-age(a) || a.key.localeCompare(b.key));
    }
    return pools;
  }
  function fillPools(key) {
    const list = Core.POOLS.filter(p => p.property === $('property').value);
    $('pool').innerHTML = list.map(p => option(p.key,poolLabel(p))).join('');
    if (list.some(p => p.key === key)) $('pool').value = key;
    savePref('pool',$('pool').value); savePref('property',$('property').value);
    loadCurrent();
  }
  function loadCurrent() {
    const r = Core.currentRecords(store.rows).get($('pool').value+'|'+$('type').value);
    const replacing = $('action').value === 'replacement';
    $('month').value = !replacing && r?.manufacturedMonth ? r.dateCode[0] : '';
    $('year').value = !replacing && r?.manufacturedMonth ? r.dateCode[1] : '';
    $('unknown').checked = !!(!replacing && r && !r.manufacturedMonth && r.probeType !== 'fc');
    $('raw').value = !replacing && !r?.manufacturedMonth ? r?.dateCode || '' : '';
    $('installed').value = replacing ? $('observed').value : r?.installedOn || '';
    updateFields(); renderHistory();
  }
  function updateFields() {
    const fc = $('type').value === 'fc', unknown = $('unknown').checked;
    $('coded').hidden = fc; $('cp').hidden = !fc;
    $('codeFields').hidden = unknown; $('rawWrap').hidden = !unknown;
    $('month').required = $('year').required = !fc && !unknown;
    $('installed').required = fc;
    $('month').disabled = $('year').disabled = fc || unknown;
    $('raw').disabled = fc || !unknown; $('installed').disabled = !fc;
    preview();
  }
  function preview() {
    const today = Core.todayISO(), observed = $('observed').value;
    if (!Core.dateParts(observed) || observed > today) { $('preview').textContent = 'Select a valid record date on or before today.'; return; }
    if ($('type').value === 'fc') {
      const date = $('installed').value;
      if (!Core.dateParts(date) || date > observed) { $('preview').textContent = 'Enter the actual CP-1 installation/replacement date on or before the record date.'; return; }
      $('preview').textContent = 'CP-1 installed '+Core.formatDate(date)+' · '+Core.ageSince(date,today).label+' since installation';
    } else if ($('unknown').checked) $('preview').textContent = 'Date and age will remain unknown. The observed code is retained for verification.';
    else if (!$('month').value || !$('year').value) $('preview').textContent = 'Select a month letter and year digit to see its date and age.';
    else {
      const result = Core.decodeCode($('month').value+$('year').value,observed);
      $('preview').textContent = result.code+' → '+result.label+' · approximately '+Core.ageSince(result.date,today,true).label+' old';
    }
  }
  function cell(pool,type,current,asOf) {
    const r = current.get(pool.key+'|'+type), d = Core.describeRecord(r,asOf);
    const attrs = 'data-pool="'+esc(pool.key)+'" data-type="'+type+'"';
    if (!r) return '<td><span class="pt-age pt-missing">Unknown</span><button type="button" class="pt-link" '+attrs+'>'+(type === 'fc' ? 'Add replacement date' : 'Add date code')+'</button></td>';
    const label = d.age ? d.age.label+(type === 'fc' ? '' : ' approx.') : 'Unknown';
    return '<td><span class="pt-age pt-'+d.status+'">'+esc(label)+'</span><span class="pt-detail">'+esc((r.dateCode ? r.dateCode+' · ' : '')+Core.formatDate(d.date,type !== 'fc'))+'</span><span class="pt-detail">'+(type === 'fc' ? 'Since installation' : 'Since manufacture')+(r.syncStatus === 'pending' ? ' · Pending sync' : '')+'</span><button type="button" class="pt-link" '+attrs+'>'+(!d.age ? 'Verify code' : 'Record / replace')+'</button></td>';
  }
  function render() {
    const asOf = Core.todayISO(), pools = filteredPools(), current = Core.currentRecords(store.rows,asOf);
    let tracked = 0, old = 0;
    for (const p of pools) for (const type of ['ph','orp','fc']) {
      const d = Core.describeRecord(current.get(p.key+'|'+type),asOf);
      if (d.age) tracked++; if (d.status === 'old') old++;
    }
    $('poolCount').textContent = pools.length; $('trackedCount').textContent = tracked;
    $('oldCount').textContent = old; $('unknownCount').textContent = pools.length*3-tracked;
    $('asOf').textContent = 'Ages as of '+Core.formatDate(asOf)+' · Florida operating date';
    $('overview').innerHTML = pools.map(p => '<tr><th scope="row"><strong>'+esc(poolLabel(p))+'</strong><span class="pt-detail">'+esc(p.property)+'</span></th>'+['ph','orp','fc'].map(type => cell(p,type,current,asOf)).join('')+'</tr>').join('');
    $('empty').hidden = pools.length !== 0;
    const pending = store.rows.filter(r => r.syncStatus === 'pending').length;
    $('sync').textContent = !store.ready ? 'Opening offline storage…' : !navigator.onLine ? 'Offline · '+pending+' waiting to sync' : store.syncing ? 'Syncing shared probe records…' : store.error ? 'Saved locally · sync needs retry'+(pending ? ' · '+pending+' waiting' : '') : pending ? 'Saved locally · '+pending+' waiting to sync' : store.lastSync ? 'Shared records synced' : 'Local inventory · shared sync pending';
    $('sync').title = store.error || (store.lastSync ? 'Last synced '+new Date(store.lastSync).toLocaleString() : '');
    $('syncNow').disabled = !store.ready || store.syncing || !navigator.onLine;
    $('save').disabled = !store.ready || saving;
    renderHistory();
  }
  function renderHistory() {
    const pool = Core.POOLS.find(p => p.key === $('pool').value);
    $('historyPool').textContent = pool ? poolLabel(pool) : '';
    const history = store.rows.filter(r => r.poolKey === $('pool').value).sort((a,b) => Core.compareRecords(b,a));
    $('history').innerHTML = history.length ? history.slice(0,historyLimit).map(r => {
      const d = Core.describeRecord(r);
      return '<article class="pt-history-row"><div><strong>'+esc(Core.TYPES[r.probeType])+' · '+esc(r.action === 'replacement' ? 'Replaced' : 'Inventory update')+'</strong><span class="pt-detail">Record date '+esc(Core.formatDate(r.observedOn))+' · '+esc(r.technician)+'</span><span class="pt-detail">'+esc(r.dateCode || '')+(r.dateCode ? ' · ' : '')+esc(Core.formatDate(d.date,r.probeType !== 'fc'))+' · '+esc(d.age?.label || 'Unknown age')+'</span></div><span class="pt-tag">'+esc(r.syncStatus === 'pending' ? 'Pending sync' : r.source === 'baseline' ? 'Photo inventory' : 'Shared')+'</span>'+(r.notes ? '<p>'+esc(r.notes)+'</p>' : '')+'</article>';
    }).join('') : '<p class="pt-help">No probe records for this body of water yet.</p>';
    $('more').hidden = history.length <= historyLimit;
  }
  function download(rows,name) {
    const blob = new Blob([Core.csv(rows)],{type:'text/csv;charset=utf-8;'}), url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = name+'-'+Core.todayISO()+'.csv'; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  $('form').addEventListener('submit',async event => {
    event.preventDefault(); if (saving) return;
    saving = true; $('save').disabled = true; $('saveStatus').textContent = '';
    try {
      const record = Core.makeRecord({poolKey:$('pool').value,probeType:$('type').value,action:$('action').value,
        observedOn:$('observed').value,installedOn:$('installed').value,unknown:$('unknown').checked,
        dateCode:$('month').value+$('year').value,rawCode:$('raw').value,technician:$('tech').value,notes:$('notes').value},{deviceId});
      await store.save(record);
      savePref('tech',record.technician); $('notes').value = '';
      $('saveStatus').textContent = 'Saved on this device'+(navigator.onLine ? ' · syncing to the shared list.' : ' · will sync when online.');
      channel?.postMessage('changed'); store.sync();
    } catch (error) { $('saveStatus').textContent = error.message; }
    finally { saving = false; render(); }
  });
  $('property').addEventListener('change',() => { historyLimit = 20; fillPools(); });
  $('pool').addEventListener('change',() => { historyLimit = 20; savePref('pool',$('pool').value); loadCurrent(); });
  ['type','action'].forEach(id => $(id).addEventListener('change',loadCurrent));
  $('unknown').addEventListener('change',updateFields);
  ['month','year','raw','installed','observed'].forEach(id => $(id).addEventListener('input',preview));
  ['filter','search','oldest'].forEach(id => $(id).addEventListener('input',render));
  $('syncNow').addEventListener('click',() => store.sync());
  $('exportOverview').addEventListener('click',() => download(Core.overviewRows(store.rows,Core.todayISO(),filteredPools()),'probe-pool-overview'));
  $('exportHistory').addEventListener('click',() => download(Core.historyRows(store.rows,Core.todayISO(),filteredPools()),'probe-history'));
  $('more').addEventListener('click',() => { historyLimit += 20; renderHistory(); });
  $('overview').addEventListener('click',event => {
    const button = event.target.closest('button[data-pool]'); if (!button) return;
    const pool = Core.POOLS.find(p => p.key === button.dataset.pool);
    $('property').value = pool.property; $('type').value = button.dataset.type; $('action').value = 'inventory';
    fillPools(pool.key); historyLimit = 20; renderHistory();
    $('entry').scrollIntoView({behavior:'smooth',block:'start'}); $('type').focus({preventScroll:true});
  });
  if (properties.includes(pref('property'))) $('property').value = pref('property');
  const today = Core.todayISO(); $('observed').value = today; $('observed').max = $('installed').max = today;
  $('tech').value = pref('tech'); fillPools(pref('pool')); render();
  store.init().then(() => { loadCurrent(); return store.sync(); }).catch(error => {
    $('storageError').hidden = false; $('storageError').textContent = error.message+' Saving is disabled until offline storage is available.';
    $('sync').textContent = 'Offline storage unavailable'; $('save').disabled = true;
  });
  async function refresh() {
    if (!store.ready) return;
    const today = Core.todayISO(); $('observed').max = $('installed').max = today;
    try { store.rows = await store.adapter.load(); render(); preview(); await store.sync(); }
    catch (error) { $('saveStatus').textContent = error.message; }
  }
  channel?.addEventListener('message',refresh);
  window.addEventListener('online',refresh); window.addEventListener('offline',render);
  document.addEventListener('visibilitychange',() => { if (!document.hidden) refresh(); });
  setInterval(() => { if (!document.hidden) refresh(); },60000);
})();
