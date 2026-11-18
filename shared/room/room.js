/* Newtoon · sala de papel para las páginas del sitio (Inicio, Hogar, Sala de docentes, Instituciones).
   Misma experiencia que el Recreo: sala cilíndrica, tarjeta inferior, paradas, entrada con o sin sonido.
   1) La interfaz DOM se pinta desde data/pages/<página>.json y funciona sin Three.js.
   2) El mundo 3D se carga después como mejora; si falla, queda el escenario 2D.
   3) Formularios, buscador y guías completas viven en paneles DOM accesibles. */
import { track, configureTracking } from '../track.js';
import { audio } from './audio.js';
import { ILLU } from './illu.js';

const ROOT = document.querySelector('meta[name="nt-root"]')?.content ?? '../';
const PAGE = document.querySelector('meta[name="nt-page"]')?.content;
const $ = (id) => document.getElementById(id);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get(k, s = sessionStorage){ try { return JSON.parse(s.getItem('nt.' + k)); } catch { return null; } }, set(k, v, s = sessionStorage){ try { s.setItem('nt.' + k, JSON.stringify(v)); } catch {} } };
const fetchJSON = (p) => fetch(ROOT + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
const isExt = (h) => /^https?:/.test(h);
const href = (a) => isExt(a.href) ? a.href : ROOT + a.href;

let CFG, P, T, CAT, GUIDES, SESS, CHARS, EXP;
try {
  [CFG, P, CHARS] = await Promise.all([fetchJSON('data/site-config.json'), fetchJSON(`data/pages/${PAGE}.json`), fetchJSON('data/characters.json')]);
  const need = new Set(P.zones.flatMap(z => [z.items_from, z.panel?.type, z.guide ? 'guide' : null, z.card_from_session !== undefined || z.steps_from || z.boxes_from ? 'session' : null]));
  const loc = await fetchJSON('data/locales.json'); T = loc[CFG.locale] || loc[loc.default];
  if (need.has('catalog') || need.has('search')) CAT = await fetchJSON('data/catalog.json');
  if (need.has('guide') || P.zones.some(z => z.panel?.from === 'family_general')){ GUIDES = await fetchJSON('data/family-guides.json'); EXP = await fetchJSON('data/experiences.json'); }
  if (need.has('session')) SESS = await fetchJSON('data/teacher-sessions.json');
} catch (e) { console.error(e); $('dataError').hidden = false; throw e; }
configureTracking(CFG.analytics);
const t = (k, v = {}) => (T[k] || k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');

/* ---------- resolver zonas con datos compartidos ---------- */
const session = SESS ? (SESS.sessions.find(s => s.id === P.session) || SESS.sessions[0]) : null;
const guideById = GUIDES ? Object.fromEntries(GUIDES.guides.map(g => [g.activity_id, g])) : {};
const expById = EXP ? Object.fromEntries(EXP.experiences.map(e => [e.id, e])) : {};
const zones = P.zones.map(z0 => {
  const z = { ...z0 };
  if (z.items_from === 'catalog' && CAT) z.items = CAT.items.map(it => ({ id: it.id, title: it.title, art: it.art === 'tuti' ? 'vocales' : it.art }));
  if (z.steps_from === 'session' && session) z.steps = session.steps;
  if (z.boxes_from === 'pending' && SESS) z.boxes = SESS.pending.map(l => ({ label: l, status: 'wip' }));
  if (z.card_from_session !== undefined && session){ const c = session.cards[z.card_from_session];
    z.card = { title: c.title, text: c.text, actions: [{ label: c.link_label, href: c.url, style: 'primary', external: true }] }; }
  if (z.guide && guideById[z.guide]){ const g = guideById[z.guide], e = expById[g.activity_id];
    if (g.review_status === 'BORRADOR' && CFG.family_guides.show_drafts === false) z.hiddenGuide = true;
    z.card = { title: g.title, text: `Qué buscamos: ${g.observable_objective} Después: ${g.after}`, draft: g.review_status === 'BORRADOR',
      actions: [ e && { label: e.cta, href: e.url, style: 'primary', external: true }, { label: 'Ver la guía completa', panel: true, style: 'secondary' },
        { label: 'Abrir con la guía en el Recreo', href: `recreo/?familias=1&exp=${encodeURIComponent(g.activity_id)}`, style: 'link' } ].filter(Boolean) }; }
  return z;
}).filter(z => !z.hiddenGuide).slice(0, 6);

/* ---------- textos fijos de la interfaz ---------- */
document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
for (const id of ['brandLogo', 'gateLogo']){ $(id).src = ROOT + CFG.brand.logo; $(id).alt = CFG.brand.logo_alt; }
$('brand').href = ROOT; $('gateTitle').textContent = P.gate.title; $('gateSub').textContent = P.gate.sub;
$('scrub').setAttribute('aria-label', 'Recorrer ' + P.gate.title);
$('prev').setAttribute('aria-label', 'Anterior'); $('next').setAttribute('aria-label', 'Siguiente'); $('slider').setAttribute('aria-label', 'Recorrer la sala');
$('panelClose').setAttribute('aria-label', t('close')); $('menuClose').setAttribute('aria-label', t('close'));
const NAV = [{ id: 'inicio', label: 'Inicio', href: '' }, ...CFG.nav.surfaces];
$('navList').innerHTML = NAV.map(n => `<li><a href="${esc(ROOT + n.href)}"${n.id === P.id ? ' aria-current="page"' : ''}>${esc(n.label)}</a></li>`).join('');
$('legal').innerHTML = [...CFG.legal.map(l => l.url ? `<a href="${esc(l.url)}">${esc(l.label)}</a>` : `<span>${esc(l.label)}</span>`), ...CFG.social.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`)].join(' · ');
if (P.tone === 'sobrio') document.body.classList.add('sober');

/* ---------- estado ---------- */
const qs = new URLSearchParams(location.search);
let world = null, entered = false, userMoved = false, cur = 0, selectedItem = null, panelOpener = null, menuOpener = null;
const zoneIndex = (id) => zones.findIndex(z => z.id === id || (z.aliases || []).includes(id));
const hash = decodeURIComponent(location.hash.slice(1));
let start = zoneIndex(hash); if (start < 0) start = Math.max(0, zoneIndex(P.start));
cur = start;

/* ---------- escenario 2D ---------- */
function charSrc(id){ const c = CHARS.characters.find(c => c.id === id); return c?.assets?.cutout ? ROOT + c.assets.cutout : null; }
function paint2D(i){
  const z = zones[i], p = z.palette, st = $('stage2d');
  if (!st.firstChild) st.innerHTML = '<div class="lip"></div><div class="wall"></div><div class="floor"></div><div class="hero"></div>';
  Object.entries({ '--w': p.wall, '--l': p.lip, '--f': p.floor, '--s': p.r2, '--s2': p.r1 }).forEach(([k, v]) => st.style.setProperty(k, v));
  const [kind, id] = (z.fallback_art || '').split(':'), h = st.querySelector('.hero');
  h.className = 'hero ' + (kind || '') + ' ' + (id || '');
  h.innerHTML = kind === 'char' && charSrc(id) ? `<img src="${charSrc(id)}" alt="">` : kind === 'illu' ? (ILLU[id] || '') : '';
}

/* ---------- tarjeta ---------- */
$('stops').innerHTML = zones.map((z, i) => `<button class="stop" type="button" data-i="${i}">${esc(z.label)}</button>`).join('');
$('stops').addEventListener('click', e => { const b = e.target.closest('.stop'); if (b) go(+b.dataset.i, true); });
function actionHTML(a, i){
  const cls = a.style === 'primary' ? 'cta' : a.style === 'link' ? 'tlink' : 'cta2';
  const hint = a.hint ? `<span class="hint-s">${esc(a.hint)}</span>` : '';
  if (a.panel) return `<button type="button" class="${cls}" data-act="${i}" aria-controls="panel">${esc(a.label)}</button>`;
  if (a.zone) return `<button type="button" class="${cls}" data-act="${i}">${esc(a.label)} <span aria-hidden="true">→</span></button>`;
  const ext = isExt(a.href);
  return `<a class="${cls}" data-act="${i}" href="${esc(href(a))}"${a.cta_id ? ` data-cta="${esc(a.cta_id)}"` : ''}>${hint}${esc(a.label)}${ext ? ' <span aria-hidden="true">↗</span>' : ''}</a>`;
}
function renderCard(i){
  const z = zones[i]; let c = z.card || { title: z.label, text: '', actions: [] };
  if (selectedItem && z.items_from === 'catalog'){ const it = CAT.items.find(x => x.id === selectedItem);
    if (it) c = { title: it.title, text: it.text + (it.adult_note ? ' ' + it.adult_note : ''), actions: [{ label: 'Abrir', href: it.url, style: 'primary', external: true }, { label: 'Abrir el buscador', panel: true, style: 'secondary' }] }; }
  document.documentElement.style.setProperty('--accent', z.palette.accent);
  $('zNum').textContent = `${P.zone_word} ${i + 1} de ${zones.length} · ${z.label}`;
  $('zTitle').textContent = c.title;
  $('zText').textContent = c.text;
  $('zDraft').hidden = !c.draft;
  $('zActions').innerHTML = (c.actions || []).map(actionHTML).join('');
  $('zActions').onclick = (e) => { const el = e.target.closest('[data-act]'); if (!el) return; const a = c.actions[+el.dataset.act];
    if (a.panel){ openPanel(el); return; }
    if (a.zone){ go(zoneIndex(a.zone), true); return; }
    if (a.cta_id) track('adult_cta_clicked', { surface: P.surface, cta_id: a.cta_id });
    if (!isExt(a.href)) { e.preventDefault(); leave(href(a)); } };
  const touch = z.touch; $('touch').hidden = !touch;
  if (touch){ $('touchLabel').textContent = touch.label; $('touchRow').innerHTML = touch.items.map(it => `<button class="tchip" type="button" data-id="${esc(it.id)}">${esc(it.text)}</button>`).join(''); }
  [...$('stops').children].forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false'));
  if (!$('panel').hidden) renderPanel();
}
$('touchRow').addEventListener('click', e => { const b = e.target.closest('.tchip'); if (!b) return; const it = zones[cur].touch.items.find(x => x.id === b.dataset.id);
  if (world && world.trigger(it.id)) return; audio.speak(it.say); audio.keyNote(72, .2); announce(it.text); });

function setZone(i, fromUser){
  if (i === cur && $('zTitle').textContent) return;
  cur = i; selectedItem = null; renderCard(i); paint2D(i);
  if (fromUser || entered) announce(`${zones[i].label}. ${$('zTitle').textContent}`);
  if (entered) audio.zoneChime(i);
  if (history.replaceState) history.replaceState(null, '', '#' + zones[i].id);
}
function go(i, fromUser){ i = ((i % zones.length) + zones.length) % zones.length; userMoved = userMoved || fromUser;
  if (world){ syncing = i; world.goIsland(i); }   // la tarjeta cambia de inmediato; la cámara la alcanza después
  setZone(i, fromUser); if (fromUser) hideHint(); }
$('prev').addEventListener('click', () => go(cur - 1, true));
$('next').addEventListener('click', () => go(cur + 1, true));
$('slider').addEventListener('input', e => { const v = e.target.value / 1000; if (world) world.setFromSlider(v); else go(Math.round(v * zones.length) % zones.length, true); hideHint(); });
addEventListener('keydown', e => {
  if (e.key === 'Escape'){ if (!$('menu').hidden) closeMenu(); else if (!$('panel').hidden) closePanel(); return; }
  if (!$('gate').hidden || !$('menu').hidden) return;
  if (e.target.closest('input,textarea,select,.panel')) return;
  if (e.key === 'ArrowRight'){ e.preventDefault(); go(cur + 1, true); }
  if (e.key === 'ArrowLeft'){ e.preventDefault(); go(cur - 1, true); }
});
addEventListener('hashchange', () => { const h = decodeURIComponent(location.hash.slice(1)), i = zoneIndex(h); if (i >= 0 && i !== cur) go(i, true); if (CAT && CAT.types.some(x => x.id === h)) openPanel(null, h); });
let hintT = null; function hideHint(){ if (!hintT) hintT = setTimeout(() => $('hint').classList.add('off'), 1500); }
function announce(m){ const l = $('live'); l.textContent = ''; setTimeout(() => l.textContent = m, 60); }

/* ---------- salida suave a otra página ---------- */
function leave(url){
  const u = new URL(url, location.href);
  if (u.origin === location.origin && u.pathname === location.pathname){ if (u.hash) location.hash = u.hash; return; }
  audio.swish(.5, .06, 1800, 400); document.body.classList.add('leaving');
  setTimeout(() => { location.href = url; }, RM ? 0 : 380);
}

/* ---------- paneles (no modales, no detienen la sala) ---------- */
const list = (a) => `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
const PANELS = {
  sections: (p) => p.sections.map(s => `<section class="psec"><h3>${esc(s.title)}</h3><ul class="plist">${s.items.map(it => `<li><b>${esc(it.title)}</b><span>${esc(it.text)}</span></li>`).join('')}</ul></section>`).join('') + (p.note ? `<p class="pnote">${esc(p.note)}</p>` : ''),
  steps: (p) => { const st = p.from === 'family_general' ? GUIDES.general.steps : p.steps; const note = p.from === 'family_general' ? GUIDES.general.note : p.note;
    return `<ol class="psteps">${st.map(s => `<li>${esc(s)}</li>`).join('')}</ol>${note ? `<p class="pnote">${esc(note)}</p>` : ''}`; },
  wall: (_, z) => `<ul class="plist">${z.wall.map(it => `<li><b>${esc(it.title)}</b><span>${esc(it.text)}</span></li>`).join('')}</ul>`,
  status: (p) => `<ul class="plist">${p.items.map(it => `<li><span class="status ${it.status === 'ok' ? 'ok' : 'wip'}">${it.status === 'ok' ? 'Disponible' : 'En definición'}</span><b>${esc(it.title)}</b><span>${esc(it.text)}</span></li>`).join('')}</ul>`,
  pending: () => `<p>${esc('Esta sala reúne recursos abiertos. Aún están por definir:')}</p><ul class="plist">${SESS.pending.map(x => `<li><span class="status wip">En definición</span><b>${esc(x)}</b></li>`).join('')}</ul>`,
  session: () => `<div class="pmeta"><div><b>Objetivo observable</b>${esc(session.observable_objective)}</div><div><b>Habilidad</b>${esc(session.skill)}</div><div><b>Materiales</b>${list(session.materials)}</div></div>
    <ol class="psteps">${session.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <p class="pnote">Sin listas de alumnos ni calificaciones. Si registras algo, que sea a nivel de grupo.</p>`,
  characters: () => `<ul class="pcast">${CHARS.characters.filter(c => c.public_text && c.assets?.cutout).map(c => `<li><img src="${ROOT + c.assets.cutout}" alt="${esc(c.alt)}" loading="lazy"><div><b>${esc(c.name)}</b><span>${esc(c.public_text)}</span></div></li>`).join('')}</ul>`,
  guide: (p) => { const g = guideById[p.activity_id], e = expById[p.activity_id]; if (!g) return '';
    const dl = g.download_url ? `<a class="pbtn dark" data-dl="${esc(g.activity_id)}" href="${esc(g.download_url)}" target="_blank" rel="noopener">Descargar: ${esc(g.download_label)}</a>` : '';
    return `<div class="pchips"><span>${esc(g.skill)}</span><span>${esc(g.duration_minutes)} min aprox.</span>${g.review_status === 'BORRADOR' ? '<span class="draft">Borrador en revisión</span>' : ''}</div>
      <section class="psec"><h3>Qué buscamos</h3><p>${esc(g.observable_objective)}</p></section>
      <section class="psec"><h3>Materiales</h3>${list(g.materials)}</section>
      <div class="pthree"><div><b>Antes</b>${esc(g.before)}</div><div><b>Durante</b>${esc(g.during)}</div><div><b>Después</b>${esc(g.after)}</div></div>
      <section class="psec"><h3>Pueden decir</h3>${list(g.prompts)}</section>
      <section class="psec"><h3>Qué observar</h3>${list(g.observe)}</section>
      <section class="psec"><h3>Niveles de ayuda</h3>${list(g.help_levels)}</section>
      <section class="psec"><h3>Señal de aprendizaje</h3><p>${esc(g.evidence)}</p></section>
      <section class="psec"><h3>Sin pantalla</h3><p>${esc(g.low_tech_alternative)}</p></section>
      <div class="pactions">${e ? `<a class="pbtn" href="${esc(e.url)}">${esc(e.cta)} ↗</a>` : ''}${dl}</div>
      <p class="pnote">${esc(GUIDES.general.note)}</p>`; },
  search: () => `<form class="finder" id="finder" role="search" aria-label="Buscar recursos">
      <label for="q">Buscar</label><input id="q" type="search" placeholder="Por ejemplo: vocales" autocomplete="off">
      <fieldset class="fchips" id="types"><legend>Tipo</legend>${CAT.types.map(x => `<button type="button" class="chip-btn" data-k="type" data-v="${esc(x.id)}">${esc(x.label)}</button>`).join('')}</fieldset>
      <fieldset class="fchips" id="levels"><legend>Nivel</legend>${CAT.levels.map(x => `<button type="button" class="chip-btn" data-k="level" data-v="${esc(x.id)}">${esc(x.label)}</button>`).join('')}</fieldset>
      <button type="reset" class="pbtn ghost">Limpiar filtros</button></form>
    <p class="pcount" id="count" role="status"></p><ul class="presults" id="results"></ul>
    <div class="pempty" id="empty" hidden><p><b>No encontramos nada con esa búsqueda.</b> Prueba con:</p><div class="fchips">${CAT.suggestions.map(s => `<button type="button" class="chip-btn" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>`,
  form: () => `<form class="cform" id="cform" novalidate>
      <label for="c-org">Escuela, institución o nombre</label><input id="c-org" name="org" autocomplete="organization" required>
      <label for="c-mail">Correo</label><input id="c-mail" name="email" type="email" autocomplete="email" required>
      <label for="c-msg">Mensaje</label><textarea id="c-msg" name="message" rows="4" required></textarea>
      <p class="pnote">Usamos tus datos solo para responder tu mensaje. Este formulario es para personas adultas. No incluyas datos de niñas o niños.</p>
      <button class="pbtn dark" type="submit" id="c-send">Enviar mensaje</button><p class="fstatus" id="c-status" role="status"></p></form>`,
};
const search = { q: '', type: 'todo', level: 'todos' };
function renderPanel(){
  const z = zones[cur], p = z.panel; if (!p) return;
  $('panelKicker').textContent = z.adult || P.adult || p.type === 'guide' ? 'Para personas adultas' : z.label;
  $('panelTitle').textContent = p.title || (p.type === 'guide' ? guideById[p.activity_id]?.title : z.label);
  $('panelBody').innerHTML = PANELS[p.type]?.(p, z) || '';
  if (p.type === 'search') wireSearch();
  if (p.type === 'form') wireForm();
  $('panelBody').querySelectorAll('[data-dl]').forEach(a => a.addEventListener('click', () => track('family_download_clicked', { surface: P.surface, activity_id: a.dataset.dl })));
}
function openPanel(opener, typeFilter){
  const z = zones[cur]; if (!z.panel){ const i = zones.findIndex(x => x.panel?.type === 'search'); if (i < 0) return; go(i, true); }
  if (typeFilter){ search.type = typeFilter; const i = zones.findIndex(x => x.panel?.type === 'search'); if (i >= 0 && i !== cur) go(i, true); }
  panelOpener = opener || document.activeElement; renderPanel(); $('panel').hidden = false; $('panelTitle').focus(); audio.paperFlip();
  const p = zones[cur].panel; if (p?.type === 'guide') track('family_guidance_opened', { surface: P.surface, activity_id: p.activity_id });
}
function closePanel(){ $('panel').hidden = true; audio.paperFlip(); (panelOpener && document.contains(panelOpener) ? panelOpener : $('zTitle')).focus?.(); }
$('panelClose').addEventListener('click', closePanel);

function wireSearch(){
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const typeLabel = Object.fromEntries(CAT.types.map(x => [x.id, x.label]));
  const draw = () => {
    document.querySelectorAll('#finder .chip-btn').forEach(b => b.setAttribute('aria-pressed', String(search[b.dataset.k] === b.dataset.v)));
    const q = norm(search.q.trim());
    const items = CAT.items.filter(it => (search.type === 'todo' || it.types.includes(search.type)) && (search.level === 'todos' || it.levels.includes(search.level)) && (!q || norm(`${it.title} ${it.text} ${it.types.join(' ')}`).includes(q)));
    $('results').innerHTML = items.map(it => `<li><div class="rart" aria-hidden="true">${ILLU[it.art === 'tuti' ? 'tarjetas' : it.art] || ''}</div><div><span class="rtags">${it.types.map(x => esc(typeLabel[x])).join(' · ')}${it.file ? ' · ' + esc(it.file) : ''}</span><b>${esc(it.title)}</b><span>${esc(it.text)}</span>${it.adult_note ? `<small>${esc(it.adult_note)}</small>` : ''}<a href="${esc(it.url)}">Abrir <span class="sr-only">${esc(it.title)}</span>↗</a></div></li>`).join('');
    $('count').textContent = items.length === 1 ? '1 recurso' : `${items.length} recursos`; $('empty').hidden = items.length > 0;
  };
  $('q').value = search.q; $('q').addEventListener('input', e => { search.q = e.target.value; draw(); });
  $('finder').addEventListener('submit', e => e.preventDefault());
  $('finder').addEventListener('reset', () => { Object.assign(search, { q: '', type: 'todo', level: 'todos' }); setTimeout(draw); });
  $('finder').addEventListener('click', e => { const b = e.target.closest('.chip-btn'); if (b){ search[b.dataset.k] = b.dataset.v; draw(); } });
  $('empty').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b){ Object.assign(search, { q: b.dataset.s, type: 'todo', level: 'todos' }); $('q').value = search.q; draw(); } });
  draw();
}
function wireForm(){
  const form = $('cform'), status = $('c-status');
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); let bad = null;
    form.querySelectorAll('input,textarea').forEach(f => { const ok = f.checkValidity() && f.value.trim() !== ''; f.setAttribute('aria-invalid', String(!ok)); if (!ok && !bad) bad = f; });
    if (bad){ status.className = 'fstatus err'; status.textContent = 'Revisa los campos marcados: todos son necesarios y el correo debe ser válido.'; bad.focus(); return; }
    track('adult_cta_clicked', { surface: P.surface, cta_id: 'contact_submit' });
    if (!CFG.contact?.endpoint){ status.className = 'fstatus err';
      status.innerHTML = `El envío del formulario todavía no está conectado en esta versión, así que tu mensaje no se envió. Mientras tanto, <a href="${esc(CFG.contact.fallback_url)}" target="_blank" rel="noopener">${esc(CFG.contact.fallback_label)}</a>.`; return; }
    const btn = $('c-send'); btn.disabled = true; status.className = 'fstatus'; status.textContent = 'Enviando…';
    try { const r = await fetch(CFG.contact.endpoint, { method: CFG.contact.method || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ org: form.org.value.trim(), email: form.email.value.trim(), message: form.message.value.trim() }) });
      if (!r.ok) throw new Error(r.status); status.className = 'fstatus ok'; status.textContent = '¡Mensaje enviado! Gracias por contactar a Newtoon.'; form.reset(); }
    catch { status.className = 'fstatus err'; status.textContent = 'No pudimos enviar tu mensaje. Inténtalo de nuevo en unos minutos.'; }
    finally { btn.disabled = false; }
  });
}

/* ---------- menú global y ajustes ---------- */
const LOW_KEY = 'quality_low';
const autoLow = (navigator.deviceMemory && navigator.deviceMemory <= CFG.quality.auto_low_when.device_memory_gb_lte) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= CFG.quality.auto_low_when.cpu_cores_lte);
let lowQuality = store.get(LOW_KEY, localStorage) ?? !!autoLow;
function syncSoundUI(){
  $('musicBtn').setAttribute('aria-pressed', audio.music); $('musicBtn').setAttribute('aria-label', audio.music ? t('music_on') : t('music_off'));
  $('soundBtn').setAttribute('aria-pressed', audio.sound); $('soundBtn').setAttribute('aria-label', audio.sound ? t('sound_on') : t('sound_off'));
  $('optMusic').checked = audio.music; $('optSound').checked = audio.sound; $('optLow').checked = lowQuality;
}
audio.onChange(() => { syncSoundUI(); store.set('sound', { music: audio.music, sound: audio.sound }); });
const toggleMusic = () => { audio.startMusicLoop(); audio.setMusic(!audio.music); };
const toggleSound = () => { audio.setSound(!audio.sound); if (audio.sound) audio.pop(); };
$('musicBtn').addEventListener('click', toggleMusic); $('soundBtn').addEventListener('click', toggleSound);
$('optMusic').addEventListener('change', e => { if (e.target.checked !== audio.music) toggleMusic(); });
$('optSound').addEventListener('change', e => { if (e.target.checked !== audio.sound) toggleSound(); });
$('optLow').addEventListener('change', e => { lowQuality = e.target.checked; store.set(LOW_KEY, lowQuality, localStorage); world?.setQuality(lowQuality); });
function openMenu(){ menuOpener = document.activeElement; syncSoundUI(); $('menu').hidden = false; $('menuClose').focus(); world?.setPaused(true); audio.paperFlip(); }
function closeMenu(){ $('menu').hidden = true; world?.setPaused(false); audio.paperFlip(); (menuOpener || $('menuBtn')).focus(); }
$('menuBtn').addEventListener('click', openMenu); $('menuClose').addEventListener('click', closeMenu);
$('menu').addEventListener('click', e => { if (e.target === $('menu')) closeMenu(); const a = e.target.closest('#navList a'); if (a && !a.hasAttribute('aria-current')){ e.preventDefault(); $('menu').hidden = true; leave(a.href); } });
$('menu').addEventListener('keydown', e => { if (e.key !== 'Tab') return; const f = [...$('menu').querySelectorAll('button,input,a')]; const a = f[0], b = f[f.length - 1];
  if (e.shiftKey && document.activeElement === a){ e.preventDefault(); b.focus(); } else if (!e.shiftKey && document.activeElement === b){ e.preventDefault(); a.focus(); } });

/* ---------- arranque DOM ---------- */
renderCard(cur); paint2D(cur); syncSoundUI();
document.body.classList.remove('is-loading');
if (P.surface === 'instituciones') track('institutions_landing_viewed', { surface: 'instituciones' });

/* entrada: la primera vez se elige sonido; en las páginas siguientes de la misma visita se entra directo */
const prev = store.get('entered');
function enter(withSound, quiet){
  entered = true; $('gate').classList.add('done'); $('gate').inert = true; setTimeout(() => { $('gate').hidden = true; }, quiet || RM ? 0 : 700);
  store.set('entered', { sound: withSound });
  if (quiet){ if (withSound){ const unlock = () => { audio.setSound(true); audio.startMusicLoop(); audio.setMusic(true); syncSoundUI(); }; addEventListener('pointerdown', unlock, { once: true, capture: true }); addEventListener('keydown', unlock, { once: true, capture: true }); } else { audio.enterWorld(false); } }
  else audio.enterWorld(withSound);
  syncSoundUI(); world?.enter();
  if (!quiet) $('main').focus({ preventScroll: true });
}
$('enterBtn').addEventListener('click', () => enter(true));
$('quietBtn').addEventListener('click', () => enter(false));
if (prev) enter(!!prev.sound, true); else $('enterBtn').focus();
if (CAT && CAT.types.some(x => x.id === hash) && hash !== 'todo') setTimeout(() => openPanel(null, hash), 50);

/* ---------- mundo 3D diferido ---------- */
let guide = null, syncing = -1;
function notice(m, ms = 0){ const n = $('notice'); n.textContent = m; n.hidden = false; if (ms) setTimeout(() => n.hidden = true, ms); }
async function loadWorld(){
  const probe = document.createElement('canvas'); if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('webgl');
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), CFG.recreo.world_timeout_ms));
  if (!entered) $('gateStatus').textContent = t('world_loading');
  const [mod, sc] = await Promise.race([Promise.all([import('./world.js'), import('./scenes-site.js')]), timeout]);
  audio.setScenes(zones.map(z => z.ambience || 'calma'));
  const startIdx = cur; syncing = startIdx;   // ignora zonas intermedias mientras la cámara llega
  world = await Promise.race([mod.createWorld({
    scenes: sc.SITE_SCENES, canvas: $('world'), islands: zones, startIndex: startIdx, assetsBase: ROOT, characters: CHARS.characters.filter(c => c.assets?.cutout), text: T,
    audio, bubbleEl: $('bubble'), tipEl: $('tip'), lowQuality, reducedMotion: RM, maxDpr: CFG.quality.max_device_pixel_ratio,
    hooks: {
      onIsland: (i, isEntered) => { if (syncing >= 0){ if (i !== syncing) return; syncing = -1; } setZone(i, isEntered && userMoved); },
      onAngle: (v) => { if (document.activeElement !== $('slider')) $('slider').value = Math.round(v * 1000); },
      onInput: () => { userMoved = true; syncing = -1; hideHint(); },
      onSign: () => { const c = $('zActions').querySelector('.cta,.cta2'); if (!c) return; c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); c.focus({ preventScroll: true }); },
      onPortal: (h) => leave(ROOT + h),
      onItem: (id) => { selectedItem = id; renderCard(cur); announce($('zTitle').textContent); },
      onSay: (txt) => announce(txt),
      registerGuide: (o) => { guide = o; },
    },
  }), timeout]);
  if (entered) world.enter();
  if (cur !== startIdx){ syncing = cur; world.goIsland(cur); }   // la persona ya cambió de zona mientras cargaba el 3D
  document.body.classList.add('world-ready'); $('gateStatus').textContent = '';
  if (/[?&]debug=1/.test(location.search)) window.__world = world;
}
(window.requestIdleCallback || ((f) => setTimeout(f, 60)))(() => loadWorld().catch(err => {
  console.warn('[sala] mundo 3D no disponible:', err.message); world = null; document.body.classList.add('no-webgl'); $('gateStatus').textContent = ''; notice(t('world_failed'), 9000);
}));
