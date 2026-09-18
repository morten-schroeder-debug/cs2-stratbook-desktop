const PRIORITY_MAPS = ['Dust2','Mirage','Inferno','Ancient','Anubis','Nuke','Cache'];
const STORAGE_PACK = 'cs2_stratbook_imported_pack_v1';
const STORAGE_FAVS = 'cs2_stratbook_favorites_v1';

let rootData = {};
let builtInPack = null;
let currentPack = null;
let state = { map:'Inferno', side:'T', area:'Alle', round:'Alle', favOnly:false, search:'' };
let favorites = new Set(JSON.parse(localStorage.getItem(STORAGE_FAVS) || '[]'));

const $ = (id) => document.getElementById(id);
const els = {
  subtitle:$('subtitle'), mapButtons:$('mapButtons'), sideButtons:$('sideButtons'), searchInput:$('searchInput'),
  areaButtons:$('areaButtons'), roundButtons:$('roundButtons'), cards:$('cards'), countText:$('countText'),
  viewTitle:$('viewTitle'), packButton:$('packButton'), resetButton:$('resetButton'), fileInput:$('fileInput'),
  modalBackdrop:$('modalBackdrop'), modal:$('modal'), modalClose:$('modalClose'), modalContent:$('modalContent')
};

const esc = (value='') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const norm = (s='') => String(s).trim().toLowerCase();

async function boot(){
  try{
    const response = await fetch('data/strategies.json');
    if(!response.ok) throw new Error('Eingebaute Strategien konnten nicht geladen werden.');
    builtInPack = await response.json();
    const saved = localStorage.getItem(STORAGE_PACK);
    if(saved){
      try{ applyPack(JSON.parse(saved), true); }
      catch{ localStorage.removeItem(STORAGE_PACK); applyPack(builtInPack, false); }
    } else applyPack(builtInPack, false);
    bindEvents();
    renderAll();
  }catch(err){
    els.cards.innerHTML = `<div class="empty">Fehler beim Laden: ${esc(err.message)}</div>`;
  }
}

function validatePack(pack){
  const maps = pack?.maps && typeof pack.maps === 'object' ? pack.maps : pack;
  if(!maps || typeof maps !== 'object' || Array.isArray(maps)) throw new Error('Das StratPack enthält keine gültigen Maps.');
  let count=0;
  for(const [map,list] of Object.entries(maps)){
    if(!Array.isArray(list)) throw new Error(`Map „${map}“ ist keine Strat-Liste.`);
    for(const s of list){
      if(!s || !s.id || !s.name || !['T','CT'].includes(s.side)) throw new Error(`Ungültige Strat in ${map}. Benötigt werden id, name und side.`);
      count++;
    }
  }
  if(count===0) throw new Error('Das StratPack enthält keine Taktiken.');
  return maps;
}

function applyPack(pack, imported){
  rootData = validatePack(pack);
  currentPack = { raw:pack, imported, meta:pack.meta || {} };
  const maps = orderedMaps();
  if(!maps.includes(state.map)) state.map = maps[0];
  state.area='Alle'; state.round='Alle';
}

function orderedMaps(){
  return [...PRIORITY_MAPS.filter(m=>rootData[m]), ...Object.keys(rootData).filter(m=>!PRIORITY_MAPS.includes(m)).sort()];
}
function allStrategies(){ return orderedMaps().flatMap(map => (rootData[map]||[]).map(s=>({...s,__map:map}))); }
function strategyKey(map,s){ return `${map}::${s.side}::${s.id}::${s.name}`; }
function packCount(){ return Object.values(rootData).reduce((a,v)=>a+(Array.isArray(v)?v.length:0),0); }

function bindEvents(){
  els.searchInput.addEventListener('input', e=>{state.search=norm(e.target.value); renderCards();});
  els.resetButton.addEventListener('click',()=>{ state.area='Alle'; state.round='Alle'; state.favOnly=false; state.search=''; els.searchInput.value=''; renderAll(); });
  els.packButton.addEventListener('click', showPackModal);
  els.fileInput.addEventListener('change', importPackFile);
  els.modalBackdrop.addEventListener('click', e=>{ if(e.target===els.modalBackdrop) closeModal(); });
  els.modalClose.addEventListener('click', closeModal);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });
}

function renderAll(){ renderHeader(); renderMapButtons(); renderSideButtons(); renderAreaButtons(); renderRoundButtons(); renderCards(); }
function renderHeader(){
  const meta=currentPack?.meta||{}; const name=meta.name || (currentPack?.imported?'Importiertes StratPack':'Eingebaut'); const version=meta.version?` v${meta.version}`:'';
  els.subtitle.textContent = `${currentPack?.imported?'Importiert':'Offline'} • ${orderedMaps().length} Maps • ${packCount()} Strats • ${name}${version}`;
}
function makeButton(text, cls, active, onClick){ const b=document.createElement('button'); b.className=`${cls}${active?' active':''}`; b.textContent=text; b.addEventListener('click',onClick); return b; }
function renderMapButtons(){
  els.mapButtons.innerHTML=''; orderedMaps().forEach(map=>els.mapButtons.appendChild(makeButton(map,'nav-button',state.map===map,()=>{state.map=map;state.area='Alle';state.round='Alle';renderAll();})));
}
function renderSideButtons(){
  els.sideButtons.innerHTML='';
  const t=makeButton('T','side-button t',!state.favOnly&&state.side==='T',()=>{state.side='T';state.favOnly=false;state.area='Alle';state.round='Alle';renderAll();});
  const ct=makeButton('CT','side-button ct',!state.favOnly&&state.side==='CT',()=>{state.side='CT';state.favOnly=false;state.area='Alle';state.round='Alle';renderAll();});
  const fav=makeButton('★ Favoriten','side-button favs',state.favOnly,()=>{state.favOnly=true;state.area='Alle';state.round='Alle';renderAll();});
  els.sideButtons.append(t,ct,fav);
}
function visibleBase(){
  let list=(rootData[state.map]||[]).filter(s=>state.favOnly?favorites.has(strategyKey(state.map,s)):s.side===state.side);
  return list;
}
function areaOptions(){
  const preferred=['Alle','A','B','Mid','Default']; const found=new Set();
  visibleBase().forEach(s=>(s.tags||[]).forEach(t=>found.add(String(t))));
  const extras=[...found].filter(x=>!preferred.includes(x)).sort((a,b)=>a.localeCompare(b,'de'));
  return ['Alle',...preferred.slice(1).filter(x=>found.has(x)),...extras];
}
function roundOptions(){
  const preferred=['Alle','Pistol','Eco / Low Buy','Anti-Eco','Force','Anti-Force','Full Buy','Break Glass']; const found=new Set(visibleBase().map(s=>s.roundType).filter(Boolean));
  const extras=[...found].filter(x=>!preferred.includes(x)).sort((a,b)=>a.localeCompare(b,'de'));
  return ['Alle',...preferred.slice(1).filter(x=>found.has(x)),...extras];
}
function renderAreaButtons(){
  const opts=areaOptions(); if(!opts.includes(state.area)) state.area='Alle'; els.areaButtons.innerHTML='';
  opts.forEach(x=>els.areaButtons.appendChild(makeButton(x,'chip',state.area===x,()=>{state.area=x;renderAreaButtons();renderCards();})));
}
function renderRoundButtons(){
  const opts=roundOptions(); if(!opts.includes(state.round)) state.round='Alle'; els.roundButtons.innerHTML='';
  opts.forEach(x=>els.roundButtons.appendChild(makeButton(x,'chip',state.round===x,()=>{state.round=x;renderRoundButtons();renderCards();})));
}

function searchHaystack(s){
  return norm([s.name,s.roundType,s.trigger,s.bestAgainst,s.setup,(s.steps||[]).join(' '),s.goal,s.call,s.utility,s.planB,s.pro,(s.tags||[]).join(' ')].join(' '));
}
function filtered(){
  return visibleBase().filter(s=>{
    if(state.area!=='Alle' && !(s.tags||[]).includes(state.area)) return false;
    if(state.round!=='Alle' && s.roundType!==state.round) return false;
    if(state.search && !searchHaystack(s).includes(state.search)) return false;
    return true;
  });
}
function renderCards(){
  const list=filtered(); const mode=state.favOnly?'Favoriten':state.side; els.viewTitle.textContent=`${state.map} · ${mode}`; els.countText.textContent=`${list.length} von ${visibleBase().length} Taktiken`;
  els.cards.innerHTML='';
  if(!list.length){ els.cards.innerHTML='<div class="empty">Keine Taktik passt zu den aktuellen Filtern.</div>'; return; }
  list.forEach(s=>{
    const key=strategyKey(state.map,s); const card=document.createElement('article'); card.className=`card ${s.side==='T'?'t':'ct'}`;
    card.innerHTML=`
      <div class="card-head">
        <div class="side-badge ${s.side==='T'?'t':'ct'}">${esc(s.side)}${esc(s.number||'')}</div>
        <div><div class="card-title">${esc(s.name)}</div><div class="card-meta">${esc(s.roundType||'')} ${s.emergency? '• BREAK GLASS':''}</div></div>
        <button class="fav ${favorites.has(key)?'active':''}" title="Favorit">★</button>
      </div>
      <div class="mini trigger"><strong>TRIGGER</strong>${esc(s.trigger||'—')}</div>
      <div class="mini setup"><strong>SETUP</strong>${esc(s.setup||'—')}</div>
      <div class="mini goal"><strong>ZIEL</strong>${esc(s.goal||'—')}</div>
      <div class="card-actions"><button class="primary details">Details</button><button class="quick">Quick Call</button></div>`;
    card.querySelector('.fav').addEventListener('click',()=>toggleFavorite(key));
    card.querySelector('.details').addEventListener('click',()=>showDetails(s));
    card.querySelector('.quick').addEventListener('click',()=>showQuickCall(s));
    els.cards.appendChild(card);
  });
}
function toggleFavorite(key){
  favorites.has(key)?favorites.delete(key):favorites.add(key);
  localStorage.setItem(STORAGE_FAVS,JSON.stringify([...favorites]));
  if(state.favOnly){renderAreaButtons();renderRoundButtons();} renderCards();
}

function showDetails(s){
  const steps=(s.steps||[]).map(x=>`<li>${esc(x)}</li>`).join('');
  openModal(`
    <h2 class="detail-title">${esc(s.side)}${esc(s.number||'')} · ${esc(s.name)}</h2>
    <div class="detail-sub">${esc(state.map)} • ${esc(s.roundType||'')} ${s.emergency?'• Break Glass':''}</div>
    <div class="detail-grid">
      <div class="detail-box trigger"><h3>TRIGGER</h3>${esc(s.trigger||'—')}</div>
      <div class="detail-box"><h3>AM BESTEN WENN / GEGEN</h3>${esc(s.bestAgainst||'—')}</div>
      <div class="detail-box"><h3>SETUP</h3>${esc(s.setup||'—')}</div>
      <div class="detail-box"><h3>ZIEL</h3>${esc(s.goal||'—')}</div>
      <div class="detail-box full"><h3>ABLAUF</h3><ol class="steps">${steps||'<li>—</li>'}</ol></div>
      <div class="detail-box call full"><h3>CALL</h3>${esc(s.call||'—')}</div>
      <div class="detail-box utility"><h3>UTILITY</h3>${esc(s.utility||'—')}</div>
      <div class="detail-box planb"><h3>PLAN B</h3>${esc(s.planB||'—')}</div>
      <div class="detail-box full"><h3>PRO-IDEE</h3>${esc(s.pro||'—')}</div>
    </div>`);
}
function showQuickCall(s){
  openModal(`
    <h2 class="detail-title">Quick Call · ${esc(s.name)}</h2>
    <div class="detail-sub">${esc(state.map)} • ${esc(s.side)}${esc(s.number||'')} • ${esc(s.roundType||'')}</div>
    <div class="quick-call">${esc(s.call||'—')}</div>
    <div class="quick-row"><strong>SETUP</strong>${esc(s.setup||'—')}</div>
    <div class="quick-row"><strong>UTILITY</strong>${esc(s.utility||'—')}</div>
    <div class="quick-row"><strong>PLAN B</strong>${esc(s.planB||'—')}</div>`);
}
function showPackModal(){
  const meta=currentPack?.meta||{}; const name=meta.name || (currentPack?.imported?'Importiertes StratPack':'Eingebaut'); const version=meta.version||'—';
  openModal(`
    <h2 class="detail-title">StratPack</h2>
    <div class="notice"><strong>${currentPack?.imported?'Importiertes Paket':'Eingebautes Paket'}</strong><br>${esc(name)}<br>Version: ${esc(version)}<br>${packCount()} Taktiken<br><br>Die Windows-App akzeptiert dieselben JSON-StratPacks wie deine Android-App.</div>
    <div class="pack-actions"><button id="importNow">JSON importieren</button><button id="restoreBuiltIn">Eingebaut zurücksetzen</button><button id="exportCurrent">Aktuelles Pack speichern</button></div>`);
  $('importNow').addEventListener('click',()=>els.fileInput.click());
  $('restoreBuiltIn').addEventListener('click',()=>{localStorage.removeItem(STORAGE_PACK);applyPack(builtInPack,false);closeModal();renderAll();});
  $('exportCurrent').addEventListener('click', exportCurrentPack);
}
function importPackFile(){
  const file=els.fileInput.files?.[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(reader.result); applyPack(parsed,true); localStorage.setItem(STORAGE_PACK,JSON.stringify(parsed)); closeModal(); renderAll();
    }catch(err){ alert(`Import fehlgeschlagen: ${err.message}`); }
    els.fileInput.value='';
  };
  reader.readAsText(file,'utf-8');
}
function exportCurrentPack(){
  const blob=new Blob([JSON.stringify(currentPack.raw,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='CS2_StratPack.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function openModal(html){els.modalContent.innerHTML=html;els.modalBackdrop.classList.remove('hidden');}
function closeModal(){els.modalBackdrop.classList.add('hidden');els.modalContent.innerHTML='';}

boot();
