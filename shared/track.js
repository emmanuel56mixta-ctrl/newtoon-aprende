/* Adaptador neutral de eventos. Proveedor: PENDIENTE (ninguno conectado).
   - Solo eventos y claves permitidos en data/site-config.json.
   - Sin identificadores persistentes, nombres, correos, perfiles, fingerprinting ni píxeles.
   - Los valores deben ser IDs estables o valores cortos; el texto libre se descarta. */
let cfg = { allowed_events: [], allowed_payload_keys: [], provider: null };
const queue = [];
const ID_RE = /^[a-z0-9][a-z0-9_.:-]{0,63}$/;

export function configureTracking(analyticsCfg = {}) {
  cfg = { ...cfg, ...analyticsCfg };
  while (queue.length) send(queue.shift());
}

export function track(eventName, payload = {}) {
  if (!cfg.allowed_events.length) { queue.push([eventName, payload]); return; }
  send([eventName, payload]);
}

function send([eventName, payload]) {
  if (!cfg.allowed_events.includes(eventName)) return;
  const clean = {};
  for (const [k, v] of Object.entries(payload || {})) {
    if (!cfg.allowed_payload_keys.includes(k)) continue;
    if (typeof v === 'boolean') clean[k] = v;
    else if (typeof v === 'string' && ID_RE.test(v)) clean[k] = v;
  }
  const evt = { event: eventName, ...clean, ts_bucket: Math.floor(Date.now() / 60000) };
  // Punto de conexión del proveedor (PENDIENTE). Se emite un evento DOM para poder enchufarlo sin tocar la app.
  try { window.dispatchEvent(new CustomEvent('newtoon:track', { detail: evt })); } catch {}
  if (cfg.debug || /[?&]debug=1/.test(location.search)) console.info('[track]', evt);
}
