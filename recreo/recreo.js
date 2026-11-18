/* Recreo Newtoon · aplicación
   1) Carga datos (JSON) y pinta la interfaz DOM: funciona sin Three.js.
   2) Carga el mundo 3D de forma diferida como mejora; si falla, queda el escenario 2D.
   3) Capa "Para familias" contextual a la actividad abierta, sin reiniciarla. */
import { track, configureTracking } from '../shared/track.js';
import { audio } from '../shared/room/audio.js';

const ROOT = document.querySelector('meta[name="nt-root"]')?.content || '../';
const $ = (id) => document.getElementById(id);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k, s = sessionStorage){ try { return JSON.parse(s.getItem('nt.' + k)); } catch { return null; } },
  set(k, v, s = sessionStorage){ try { s.setItem('nt.' + k, JSON.stringify(v)); } catch {} },
};
const fetchJSON = (p) => fetch(ROOT + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
const LOCAL = /^https:\/\/newtoonaprende\.com\/((?:recreo|hogar|sala-docentes|instituciones|estudio)\/)?(#[\w-]*)?$/;
const localize = (u) => { const m = String(u || '').match(LOCAL); return m ? ROOT + (m[1] || '') + (m[2] || '') : u; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let CFG, EXP, GUIDES, CHARS, T;
let islands = [], state = { island: 0, exp: {} }, world = null, entered = false, userMoved = false, familyOpener = null;

try {
  [CFG, EXP, GUIDES, CHARS] = await Promise.all(['data/site-config.json', 'data/experiences.json', 'data/family-guides.json', 'data/characters.json'].map(fetchJSON));
  const loc = await fetchJSON('data/locales.json');
  T = loc[CFG.locale] || loc[loc.default];
} catch (e) {
  console.error(e); $('dataError').hidden = false; document.body.classList.remove('is-loading');
  throw e;
}
const t = (k, vars = {}) => (T[k] || k).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? '');
configureTracking({ ...CFG.analytics, debug: false });
document.documentElement.lang = CFG.locale;

/* ---------- islas: máximo 3 (regla 2026) ---------- */
const max = CFG.recreo.max_main_islands || 3;
if (CFG.recreo.active_islands.length > max) console.warn(`[recreo] Hay ${CFG.recreo.active_islands.length} islas activas; se muestran ${max}.`);
islands = CFG.recreo.active_islands.slice(0, max).map(id => EXP.islands.find(i => i.id === id)).filter(Boolean);
const expById = Object.fromEntries(EXP.experiences.map(e => [e.id, e]));
const guideById = Object.fromEntries(GUIDES.guides.map(g => [g.activity_id, g]));
const charById = Object.fromEntries(CHARS.characters.map(c => [c.id, c]));

/* ---------- estado inicial: URL > sesión > configuración ---------- */
const qs = new URLSearchParams(location.search);
const saved = store.get('state');
if (saved && typeof saved === 'object') state = { ...state, ...saved };
const byId = (id) => islands.findIndex(i => i.id === id);
let start = byId(qs.get('isla') || '') ; if (start < 0) start = (saved && Number.isInteger(saved.island) && saved.island < islands.length) ? saved.island : Math.max(0, byId(CFG.recreo.start_island));
if (qs.get('exp')){ const ix = islands.findIndex(i => i.experience_ids.includes(qs.get('exp'))); if (ix >= 0){ start = ix; state.exp[islands[ix].id] = qs.get('exp'); } }
state.island = start;

/* ---------- textos de la interfaz ---------- */
document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
$('scrub').setAttribute('aria-label', t('slider'));
$('prev').setAttribute('aria-label', t('prev')); $('next').setAttribute('aria-label', t('next'));
$('slider').setAttribute('aria-label', t('slider'));
$('famClose').setAttribute('aria-label', t('family_close')); $('setClose').setAttribute('aria-label', t('close'));
$('familyBtn').setAttribute('aria-label', t('family_open_aria'));
for (const id of ['brandLogo', 'gateLogo']){ $(id).src = ROOT + CFG.brand.logo; $(id).alt = CFG.brand.logo_alt; }
$('brand').href = ROOT;
$('adultLinks').innerHTML = [['Sala de docentes', localize(CFG.urls.sala_docentes)], ['Guías para familias (Hogar)', localize(CFG.urls.hogar)], ['Inicio', ROOT]]
  .map(([l, u]) => `<li><a href="${esc(u)}">${esc(l)} <span aria-hidden="true">↗</span></a></li>`).join('');
$('more').textContent = EXP.more.label; $('more').href = localize(EXP.more.url);

/* ---------- escenario 2D ---------- */
function paint2D(i){
  const isl = islands[i], p = isl.palette, st = $('stage2d');
  if (!st.firstChild) st.innerHTML = '<div class="lip"></div><div class="wall"></div><div class="floor"></div><img class="hero" alt="">';
  st.style.setProperty('--w', p.wall); st.style.setProperty('--l', p.lip); st.style.setProperty('--f', p.floor); st.style.setProperty('--s', p.r2); st.style.setProperty('--s2', p.r1);
  const ch = charById[isl.guide_character]; const img = st.querySelector('.hero');
  if (ch?.appears_in_universe && ch.assets?.cutout){ img.src = ROOT + ch.assets.cutout; img.hidden = false; img.classList.toggle('fish', ch.id === 'tuti'); } else img.hidden = true;
}

/* ---------- tarjeta de isla ---------- */
const stopsEl = $('stops');
stopsEl.innerHTML = islands.map((isl, i) => `<button class="stop" type="button" data-i="${i}">${esc(isl.label)}</button>`).join('');
stopsEl.addEventListener('click', e => { const b = e.target.closest('.stop'); if (b) goIsland(+b.dataset.i, true); });

function activeExp(i = state.island){ const isl = islands[i]; const id = state.exp[isl.id] && isl.experience_ids.includes(state.exp[isl.id]) ? state.exp[isl.id] : isl.experience_ids[0]; return expById[id]; }

function renderCard(i){
  const isl = islands[i], ex = activeExp(i);
  document.documentElement.style.setProperty('--accent', isl.palette.accent);
  $('islandNum').textContent = t('island_of', { n: i + 1, total: islands.length });
  $('islandTitle').textContent = isl.kid_title;
  $('islandText').textContent = isl.kid_text;
  const exps = isl.experience_ids.map(id => expById[id]).filter(Boolean);
  const box = $('exps'); box.hidden = exps.length < 2; box.setAttribute('aria-label', isl.kid_title);
  box.innerHTML = exps.length < 2 ? '' : exps.map(x => `<button class="exp" type="button" data-id="${esc(x.id)}" aria-pressed="${x.id === ex.id}">${esc(x.title)}</button>`).join('');
  $('ctaText').textContent = ex.cta; $('cta').href = ex.url; $('cta').dataset.id = ex.id;
  $('cta').setAttribute('aria-label', `${ex.cta}: ${ex.title}`);
  const touch = isl.touch;
  $('touch').hidden = !touch;
  if (touch){ $('touchLabel').textContent = touch.label;
    $('touchRow').innerHTML = touch.items.map(it => `<button class="tchip" type="button" data-id="${esc(it.id)}" aria-label="${esc(it.word ? `${it.text} de ${it.word}` : it.say)}">${esc(it.text)}</button>`).join(''); }
  [...stopsEl.children].forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false'));
  if (!$('family').hidden) renderFamily();
}
$('exps').addEventListener('click', e => { const b = e.target.closest('.exp'); if (!b) return;
  state.exp[islands[state.island].id] = b.dataset.id; store.set('state', state); renderCard(state.island); audio.pop(); });
$('touchRow').addEventListener('click', e => { const b = e.target.closest('.tchip'); if (!b) return;
  const it = islands[state.island].touch.items.find(x => x.id === b.dataset.id);
  if (world && world.trigger(it.id)) return;
  audio.speak(it.say); audio.keyNote(72, .2); announce(it.word ? `${it.text} de ${it.word}` : it.say);
});

/* abrir una experiencia: registra apertura o repetición; el enlace sale del universo solo hacia la experiencia */
$('cta').addEventListener('click', () => {
  const id = $('cta').dataset.id, opened = store.get('opened') || [];
  track(opened.includes(id) ? 'experience_replayed' : 'experience_opened', { surface: 'recreo', island_id: islands[state.island].id, experience_id: id });
  if (!opened.includes(id)){ opened.push(id); store.set('opened', opened); }
});

function setIsland(i, fromUser){
  if (i === state.island && $('islandTitle').textContent) return;
  state.island = i; store.set('state', state);
  renderCard(i); paint2D(i);
  if (fromUser || entered){ announce(`${islands[i].kid_title}. ${islands[i].kid_text}`); }
  if (fromUser) track('island_selected', { surface: 'recreo', island_id: islands[i].id });
  if (entered) audio.zoneChime(i);
}
function goIsland(i, fromUser){
  i = ((i % islands.length) + islands.length) % islands.length; userMoved = userMoved || fromUser;
  if (world){ arrived = true; world.goIsland(i); } else setIsland(i, fromUser);
  if (fromUser) hideHint();
}
$('prev').addEventListener('click', () => goIsland(state.island - 1, true));
$('next').addEventListener('click', () => goIsland(state.island + 1, true));
$('slider').addEventListener('input', e => { const v = e.target.value / 1000; if (world) world.setFromSlider(v); else goIsland(Math.round(v * islands.length) % islands.length, true); hideHint(); });
addEventListener('keydown', e => {
  if (e.key === 'Escape'){ if (!$('settings').hidden) closeSettings(); else if (!$('family').hidden) closeFamily(); return; }
  if (!$('gate').classList.contains('done') || !$('settings').hidden) return;
  if (e.target.closest('input,textarea,select,.family')) return;
  if (e.key === 'ArrowRight'){ e.preventDefault(); goIsland(state.island + 1, true); }
  if (e.key === 'ArrowLeft'){ e.preventDefault(); goIsland(state.island - 1, true); }
});
let hintT = null; function hideHint(){ if (hintT) return; hintT = setTimeout(() => $('hint').classList.add('off'), 1500); }
const live = $('live'); function announce(msg){ live.textContent = ''; setTimeout(() => live.textContent = msg, 60); }

/* ---------- capa para familias (contextual, no modal, no reinicia nada) ---------- */
function list(arr){ return `<ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`; }
function renderFamily(){
  const ex = activeExp(), g = guideById[ex.id];
  $('famTitle').textContent = ex.title;
  if (!g || (g.review_status === 'BORRADOR' && !CFG.family_guides.show_drafts)){
    const gen = GUIDES.general;
    $('famBody').innerHTML = `<section class="fam-sec"><h3>${esc(gen.title)}</h3><ol>${gen.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></section><p class="fam-note">${esc(gen.note)}</p>`;
    return;
  }
  const dl = g.download_url ? `<a class="dl" id="famDl" href="${esc(g.download_url)}" target="_blank" rel="noopener">${esc(t('family_download'))}: ${esc(g.download_label)}</a>` : '';
  $('famBody').innerHTML = `
    <div class="fam-meta">
      <span class="chip">${esc(t('family_skill'))}: ${esc(g.skill)}</span>
      <span class="chip">${esc(t('family_duration'))}: ${esc(t('family_minutes', { n: g.duration_minutes }))}</span>
      ${g.review_status === 'BORRADOR' ? `<span class="chip draft">${esc(t('family_draft'))}</span>` : ''}
    </div>
    <section class="fam-sec"><h3>${esc(t('family_objective'))}</h3><p>${esc(g.observable_objective)}</p></section>
    <section class="fam-sec"><h3>${esc(t('family_materials'))}</h3>${list(g.materials)}</section>
    <div class="steps3">
      <div class="step"><b>${esc(t('family_before'))}</b>${esc(g.before)}</div>
      <div class="step"><b>${esc(t('family_during'))}</b>${esc(g.during)}</div>
      <div class="step"><b>${esc(t('family_after'))}</b>${esc(g.after)}</div>
    </div>
    <section class="fam-sec"><h3>${esc(t('family_prompts'))}</h3>${list(g.prompts)}</section>
    <section class="fam-sec"><h3>${esc(t('family_observe'))}</h3>${list(g.observe)}</section>
    <section class="fam-sec"><h3>${esc(t('family_help'))}</h3>${list(g.help_levels)}</section>
    <section class="fam-sec"><h3>${esc(t('family_evidence'))}</h3><p>${esc(g.evidence)}</p></section>
    <section class="fam-sec"><h3>${esc(t('family_lowtech'))}</h3><p>${esc(g.low_tech_alternative)}</p></section>
    ${dl}
    <p class="fam-note">${esc(t('family_note'))} ${esc(GUIDES.general.note)}</p>`;
  $('famDl')?.addEventListener('click', () => track('family_download_clicked', { surface: 'recreo', activity_id: g.activity_id }));
}
function openFamily(opener){
  familyOpener = opener || $('familyBtn');
  renderFamily(); $('family').hidden = false; $('familyBtn').setAttribute('aria-expanded', 'true');
  $('famTitle').focus(); audio.paperFlip();
  track('family_guidance_opened', { surface: 'recreo', activity_id: activeExp().id });
}
function closeFamily(){
  $('family').hidden = true; $('familyBtn').setAttribute('aria-expanded', 'false'); audio.paperFlip();
  (familyOpener || $('familyBtn')).focus();
}
$('familyBtn').addEventListener('click', () => $('family').hidden ? openFamily($('familyBtn')) : closeFamily());
$('famClose').addEventListener('click', closeFamily);

/* ---------- ajustes ---------- */
const LOW_KEY = 'quality_low';
const autoLow = (navigator.deviceMemory && navigator.deviceMemory <= CFG.quality.auto_low_when.device_memory_gb_lte) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= CFG.quality.auto_low_when.cpu_cores_lte);
let lowQuality = store.get(LOW_KEY, localStorage) ?? !!autoLow;
function syncSoundUI(){
  $('musicBtn').setAttribute('aria-pressed', audio.music); $('musicBtn').setAttribute('aria-label', audio.music ? t('music_on') : t('music_off'));
  $('soundBtn').setAttribute('aria-pressed', audio.sound); $('soundBtn').setAttribute('aria-label', audio.sound ? t('sound_on') : t('sound_off'));
  $('optMusic').checked = audio.music; $('optSound').checked = audio.sound; $('optLow').checked = lowQuality;
}
audio.onChange(syncSoundUI);
const toggleMusic = () => { audio.startMusicLoop(); audio.setMusic(!audio.music); };
const toggleSound = () => { audio.setSound(!audio.sound); if (audio.sound) audio.pop(); };
$('musicBtn').addEventListener('click', toggleMusic); $('soundBtn').addEventListener('click', toggleSound);
$('optMusic').addEventListener('change', e => { if (e.target.checked !== audio.music) toggleMusic(); });
$('optSound').addEventListener('change', e => { if (e.target.checked !== audio.sound) toggleSound(); });
$('optLow').addEventListener('change', e => { lowQuality = e.target.checked; store.set(LOW_KEY, lowQuality, localStorage); world?.setQuality(lowQuality); });
let settingsOpener = null;
function openSettings(){ settingsOpener = document.activeElement; syncSoundUI(); $('settings').hidden = false; $('setClose').focus(); world?.setPaused(true); audio.paperFlip(); }
function closeSettings(){ $('settings').hidden = true; world?.setPaused(false); audio.paperFlip(); (settingsOpener || $('settingsBtn')).focus(); }
$('settingsBtn').addEventListener('click', openSettings); $('setClose').addEventListener('click', closeSettings);
$('settings').addEventListener('click', e => { if (e.target === $('settings')) closeSettings(); });
$('settings').addEventListener('keydown', e => {            // foco atrapado dentro del diálogo modal
  if (e.key !== 'Tab') return; const f = [...$('settings').querySelectorAll('button,input,a')]; const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
});

/* ---------- arranque DOM (antes de Three.js) ---------- */
renderCard(state.island); paint2D(state.island); syncSoundUI();
document.body.classList.remove('is-loading');
track('child_universe_viewed', { surface: 'recreo', island_id: islands[state.island].id });
if (qs.get('familias') === '1') openFamily($('familyBtn'));
$('enterBtn').focus();

/* ---------- entrada con o sin sonido ---------- */
function enter(withSound){
  entered = true; $('gate').classList.add('done'); $('gate').inert = true;
  setTimeout(() => { $('gate').hidden = true; }, RM ? 0 : 700);
  audio.enterWorld(withSound); syncSoundUI();
  world?.enter();
  track('session_started', { surface: 'recreo', sound: withSound, quality: lowQuality ? 'low' : 'high' });
  $('isla').focus({ preventScroll: true });
  setTimeout(() => { if (guide && world) world.say(guide, esc(t('kikino_hello')), 2.4, 3200); }, RM ? 400 : 2600);
}
$('enterBtn').addEventListener('click', () => enter(true));
$('quietBtn').addEventListener('click', () => enter(false));

/* ---------- mundo 3D diferido ---------- */
let guide = null, arrived = false;
function notice(msg, ms = 0){ const n = $('notice'); n.textContent = msg; n.hidden = false; if (ms) setTimeout(() => n.hidden = true, ms); }
async function loadWorld(){
  const canvas = $('world');
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('webgl');
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), CFG.recreo.world_timeout_ms));
  $('gateStatus').textContent = t('world_loading');
  const mod = await Promise.race([import('../shared/room/world.js'), timeout]);
  audio.setScenes(islands.map(i => i.scene));
  world = await Promise.race([mod.createWorld({
    canvas, islands, startIndex: state.island, assetsBase: ROOT, characters: CHARS.characters.filter(c => c.appears_in_universe), text: T,
    audio, bubbleEl: $('bubble'), tipEl: $('tip'), lowQuality, reducedMotion: RM, maxDpr: CFG.quality.max_device_pixel_ratio,
    hooks: {
      onIsland: (i, isEntered) => { if (!arrived){ if (i !== state.island) return; arrived = true; } setIsland(i, isEntered && userMoved); },
      onAngle: (v) => { if (document.activeElement !== $('slider')) $('slider').value = Math.round(v * 1000); },
      onInput: () => { userMoved = true; hideHint(); },
      onSign: () => { const c = $('cta'); c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); c.focus({ preventScroll: true }); },
      onSay: (txt) => announce(txt),
      registerGuide: (obj) => { guide = obj; },
    },
  }), timeout]);
  if (entered) world.enter();
  if (/[?&]debug=1/.test(location.search)) window.__world = world;
  document.body.classList.add('world-ready'); $('gateStatus').textContent = '';
}
// Se deja respirar al hilo principal para que la interfaz aparezca primero
(window.requestIdleCallback || ((f) => setTimeout(f, 60)))(() => loadWorld().catch(err => {
  console.warn('[recreo] mundo 3D no disponible:', err.message);
  world = null; document.body.classList.add('no-webgl'); $('gateStatus').textContent = '';
  notice(t('world_failed'), 9000);
}));
