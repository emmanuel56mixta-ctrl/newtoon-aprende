/* Recreo Newtoon · mundo 3D de papel (mejora progresiva sobre la interfaz DOM)
   - Sala cilíndrica dividida en hasta 3 islas (sectores de 360/N grados).
   - Escenas construidas a partir de data/experiences.json; personajes desde data/characters.json.
   - Carga diferida: primero la isla activa, el resto cuando el navegador está libre.
   - Tipos de interacción: decorativa, narrativa, educativa, experiencia. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export { THREE, RoundedBoxGeometry };

const DEG = Math.PI / 180;
const R = 12;
const RINGS = [[10.6, 12.05, 1.45], [8.8, 10.6, 0.92], [7.3, 8.8, 0.44]];
const FLOOR_R = 7.3;
const WALL_H = 6.0;
let RM = false;
let scene;
const rand = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const ticks = [];
const clickables = [];

/* ---------- utilidades ---------- */
const polar = (aDeg, r, y = 0) => new THREE.Vector3(Math.sin(aDeg * DEG) * r, y, -Math.cos(aDeg * DEG) * r);
function place(obj, aDeg, r, y = 0, extraYaw = 0){
  obj.position.copy(polar(aDeg, r, y));
  obj.rotation.y = -aDeg * DEG + extraYaw * DEG;
  scene.add(obj); return obj;
}


/* textura de papel/fieltro procedural (una sola fuente, muchas repeticiones) */
function makePaperCanvas(){
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#efefef'; g.fillRect(0, 0, S, S);
  const wrap = (fn) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) fn(dx, dy); };
  for (let i = 0; i < 160; i++){
    const x = rand() * S, y = rand() * S, r = 18 + rand() * 80, v = rand() < .5 ? 255 : 196;
    wrap((dx, dy) => { const gr = g.createRadialGradient(x+dx, y+dy, 0, x+dx, y+dy, r);
      gr.addColorStop(0, `rgba(${v},${v},${v},.10)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr; g.fillRect(x+dx-r, y+dy-r, r*2, r*2); });
  }
  for (let i = 0; i < 1400; i++){
    const x = rand() * S, y = rand() * S, a = rand() * Math.PI, l = 4 + rand() * 16, light = rand() < .55;
    g.strokeStyle = light ? 'rgba(255,255,255,.22)' : 'rgba(110,100,90,.12)'; g.lineWidth = .6 + rand() * .9;
    wrap((dx, dy) => { g.beginPath(); g.moveTo(x+dx, y+dy);
      g.quadraticCurveTo(x+dx+Math.cos(a+.6)*l*.5, y+dy+Math.sin(a+.6)*l*.5, x+dx+Math.cos(a)*l, y+dy+Math.sin(a)*l); g.stroke(); });
  }
  const id = g.getImageData(0, 0, S, S), d = id.data;
  for (let i = 0; i < d.length; i += 4){ const n = (rand() - .5) * 16; d[i] += n; d[i+1] += n; d[i+2] += n; }
  g.putImageData(id, 0, 0);
  return c;
}
const paperBase = new THREE.CanvasTexture(makePaperCanvas());
paperBase.wrapS = paperBase.wrapT = THREE.RepeatWrapping;
paperBase.colorSpace = THREE.SRGBColorSpace;
paperBase.anisotropy = 4;
const texCache = new Map();
function paperTex(rx, ry = rx){
  const k = rx + 'x' + ry; if (texCache.has(k)) return texCache.get(k);
  const t = paperBase.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; texCache.set(k, t); return t;
}
const matCache = new Map();
function mat(color, rep = 0.6, extra = {}){
  const k = color + rep + JSON.stringify(extra); if (matCache.has(k)) return matCache.get(k);
  const t = paperTex(rep);
  const m = new THREE.MeshStandardMaterial({ color, map: t, bumpMap: t, bumpScale: 1.2, roughness: .93, metalness: 0, ...extra });
  matCache.set(k, m); return m;
}
function mesh(geo, material){ const m = new THREE.Mesh(geo, material); m.castShadow = m.receiveShadow = true; return m; }

/* formas 2D */
function shapeFrom(pts){ const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); return s; }
function scallop(r, lobes = 7, amp = .16, rx = 1, ry = 1, seed = 0, n = 160){
  const pts = [];
  for (let i = 0; i < n; i++){ const t = i / n * Math.PI * 2;
    const rr = r * (0.86 + amp * Math.abs(Math.sin(lobes * t / 2 + seed)));
    pts.push([Math.cos(t) * rr * rx, Math.sin(t) * rr * ry]); }
  return shapeFrom(pts);
}
function star(n, r1, r2){ const p = []; for (let i = 0; i < n * 2; i++){ const r = i % 2 ? r2 : r1, a = i / (n * 2) * Math.PI * 2 + Math.PI / 2; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return shapeFrom(p); }
function ellipse(rx, ry){ const s = new THREE.Shape(); s.absellipse(0, 0, rx, ry, 0, Math.PI * 2); return s; }
function rrect(w, h, r){ const s = new THREE.Shape(), x = -w/2, y = -h/2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
function heart(sz){ const p = []; for (let i = 0; i < 80; i++){ const t = i / 80 * Math.PI * 2;
  p.push([16 * Math.pow(Math.sin(t), 3) * sz / 17, (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) * sz / 17]); } return shapeFrom(p); }
function leaf(w, h, bend = .2){ const p = []; const n = 24;
  for (let i = 0; i <= n; i++){ const t = i / n; p.push([Math.sin(Math.PI * t) * w * .5 + bend * t * t, t * h]); }
  for (let i = n; i >= 0; i--){ const t = i / n; p.push([-Math.sin(Math.PI * t) * w * .5 + bend * t * t, t * h]); }
  return shapeFrom(p); }

function ext(shape, depth, color, { bevel = .025, rep = .6, curve = 28 } = {}){
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * .85, bevelSegments: 3, curveSegments: curve });
  g.translate(0, 0, -depth / 2);
  return mesh(g, mat(color, rep));
}
const flat = (o) => { o.rotation.order = 'YXZ'; o.rotation.x = -Math.PI / 2; return o; };
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const wallR = (halfW, gap = .1) => Math.sqrt(R * R - halfW * halfW) - gap;   // una pieza plana de ancho 2·halfW no atraviesa la pared

/* texto en canvas */
const FONT = '"Fredoka", "Nunito", system-ui, sans-serif';
function textCanvas(lines, { size = 120, color = '#3b2a1f', align = 'center', gap = 1.2, pad = 18, weight = 600 } = {}){
  const f = `${weight} ${size}px ${FONT}`;
  const m = document.createElement('canvas').getContext('2d'); m.font = f;
  const w = Math.ceil(Math.max(...lines.map(l => m.measureText(l).width)) + pad * 2);
  const h = Math.ceil(lines.length * size * gap + pad * 2);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.font = f; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
  const x = align === 'center' ? w / 2 : align === 'left' ? pad : w - pad;
  lines.forEach((l, i) => g.fillText(l, x, pad + size * gap * (i + .5)));
  c.userData = { lineH: size * gap / h };
  return c;
}
function canvasTex(c){ const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function draw(w, h, fn){ const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return canvasTex(c); }

/* superficie curva sobre la pared (para textos y calcomanías) */
function curvedPlane(r, aC, width, height, yC, tex, opts = {}){
  const segs = 24, half = width / r / 2, pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++){
    const a = aC * DEG - half + (i / segs) * half * 2;
    for (const [v, y] of [[0, yC - height / 2], [1, yC + height / 2]]){
      pos.push(Math.sin(a) * r, y, -Math.cos(a) * r); uv.push(i / segs, v);
    }
  }
  for (let i = 0; i < segs; i++){ const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 1, side: THREE.DoubleSide, depthWrite: false, ...opts }));
  m.receiveShadow = true; scene.add(m); return m;
}
// nota de papel con texto (tinta oscura sobre papel claro: siempre legible)
function note(lines, { lineH = .34, bg = '#fbf5e8', ink = '#3b2a1f', tilt = 0, tape = true, weight = 600 } = {}){
  const c = textCanvas(lines, { color: ink, weight });
  const th = lineH * lines.length * c.height / (lines.length * 120 * 1.2), tw = th * c.width / c.height;
  const padX = lineH * .55, padY = lineH * .42;
  const g = new THREE.Group();
  g.add(ext(rrect(tw + padX * 2, th + padY * 2, .05), .025, bg, { bevel: .012, rep: 1.2 }));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(tw, th), new THREE.MeshStandardMaterial({ map: canvasTex(c), transparent: true, roughness: 1 }));
  face.position.z = .03; face.receiveShadow = true; g.add(face);
  if (tape){ const tp = new THREE.Mesh(new THREE.PlaneGeometry(.5, .16), new THREE.MeshStandardMaterial({ color: '#f1e2b0', transparent: true, opacity: .8, roughness: .6 }));
    tp.position.set(0, th / 2 + padY - .02, .035); tp.rotation.z = (rand() - .5) * .25; g.add(tp); }
  g.rotation.z = tilt; g.userData.halfW = tw / 2 + padX + .05; return g;
}
/* letras recortadas de papel directo sobre la pared (sin caja): proyectan su propia sombra */
let PAL = [], SPAN_G = 360;
const lum = (hex) => { const c = new THREE.Color(hex); const f = (v) => v; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
const wallColorAt = (a) => PAL.length ? PAL[((Math.round(a / SPAN_G) % PAL.length) + PAL.length) % PAL.length] : '#7f9a5c';
function cutText(lines, { lineH = .36, color = null, wallColor = '#7f9a5c', weight = 700 } = {}){
  const L = lum(wallColor), cr = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  const ink = color || (cr(L, .955) >= cr(L, .025) ? '#fffaf0' : '#3b2a1f');   // el que más contraste tenga con la pared
  const edge = ink === '#3b2a1f' ? 'rgba(255,250,240,.32)' : 'rgba(60,38,18,.32)';
  const size = 120, gap = 1.18, pad = 22, f = `${weight} ${size}px ${FONT}`;
  const m = document.createElement('canvas').getContext('2d'); m.font = f;
  const W = Math.ceil(Math.max(...lines.map(l => m.measureText(l).width)) + pad * 2), Hh = Math.ceil(lines.length * size * gap + pad * 2);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const g = cv.getContext('2d');
  g.font = f; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  lines.forEach((l, i) => { const y = pad + size * gap * (i + .5); g.strokeStyle = edge; g.lineWidth = 7; g.strokeText(l, W / 2, y); g.fillStyle = ink; g.fillText(l, W / 2, y); });
  const th = lineH * lines.length;
  const tex = canvasTex(cv);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(th * W / Hh * (Hh / (lines.length * size * gap)), th * (Hh / (lines.length * size * gap))), new THREE.MeshStandardMaterial({ map: tex, alphaTest: .45, roughness: .95 }));
  plane.castShadow = true; plane.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: .45 });
  plane.position.z = .07;
  const grp = new THREE.Group(); grp.add(plane); grp.userData.halfW = plane.geometry.parameters.width / 2 + .05; return grp;
}
function wallNote(lines, aC, y, opts = {}){
  const n = cutText(lines, { lineH: (opts.lineH || .33) * 1.6, weight: 700, color: opts.color, wallColor: wallColorAt(aC) });
  place(n, aC, wallR(n.userData.halfW, .06), y); n.rotation.order = 'YXZ'; n.rotation.z = (opts.tilt || 0) * .5; return n;
}

/* ---------- arquitectura: pared, labio superior, gradas, piso ---------- */
function sector(r0, r1, a0, a1, h, color, rep, bevel = .07){
  const N = 64, p = [];
  for (let i = 0; i <= N; i++){ const a = (a0 + (a1 - a0) * i / N) * DEG; p.push([Math.sin(a) * r1, Math.cos(a) * r1]); }
  for (let i = N; i >= 0; i--){ const a = (a0 + (a1 - a0) * i / N) * DEG; p.push([Math.sin(a) * r0, Math.cos(a) * r0]); }
  const g = new THREE.ExtrudeGeometry(shapeFrom(p), { depth: h, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
  g.rotateX(-Math.PI / 2);
  const m = mesh(g, mat(color, rep)); m.castShadow = false; scene.add(m); return m;
}
function wallSector(a0, a1, wall, lip){
  const prof = [new THREE.Vector2(R, -0.3), new THREE.Vector2(R, WALL_H)];
  for (let i = 1; i <= 18; i++){ const t = i / 18 * Math.PI / 2; prof.push(new THREE.Vector2(R - 4.6 * (1 - Math.cos(t)), WALL_H + 2.6 * Math.sin(t))); }
  prof.push(new THREE.Vector2(R - 6.2, WALL_H + 2.75), new THREE.Vector2(.01, WALL_H + 2.75));   // techo cerrado
  const g = new THREE.LatheGeometry(prof, 72, Math.PI - a1 * DEG, (a1 - a0) * DEG);
  const cw = new THREE.Color(wall), cl = new THREE.Color(lip), col = [], pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++){
    const y = pos.getY(i), t = THREE.MathUtils.smoothstep(y, WALL_H - .3, WALL_H + 1.6);
    const c = cw.clone().lerp(cl, t); col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const t = paperTex(14, 5);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: t, bumpMap: t, bumpScale: 1.5, roughness: .96, side: THREE.DoubleSide }));
  m.receiveShadow = true; scene.add(m);
}

const topOf = (ring) => RINGS[ring][2] + .07;     // superficie de cada grada
const midR = (ring) => (RINGS[ring][0] + RINGS[ring][1]) / 2;

/* ---------- piezas reutilizables ---------- */
function sign(text, color = '#f2a990', w = 3.9, h = 1.1){
  const g = new THREE.Group();
  const board = ext(rrect(w, h, .08), .06, color, { bevel: .02 }); g.add(board);
  const c = textCanvas([text], { size: 120, pad: 8, weight: 600 });
  let fh = h * .62, fw = fh * c.width / c.height; if (fw > w * .9){ fw = w * .9; fh = fw * c.height / c.width; }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshStandardMaterial({ map: canvasTex(c), transparent: true, roughness: 1 }));
  face.position.z = .06; g.add(face);
  const pin = mesh(new THREE.SphereGeometry(.09, 16, 12), mat('#f1a3ad')); pin.position.set(0, h / 2 - .02, .1); g.add(pin);
  g.rotation.z = (rand() - .5) * .05;
  return g;
}
function wallSign(title, sub, aC, y){
  const s = sign(title, '#f3ad95'); place(s, aC, wallR(2.05, .12), y);
  if (sub) wallNote([sub], aC, y - .95, { lineH: .3 });
  return s;
}
function sunflower(h = 1){
  const g = new THREE.Group();
  const stem = mesh(new THREE.CylinderGeometry(.025, .03, h, 8), mat('#6f8f45')); stem.position.y = h / 2; g.add(stem);
  const l1 = ext(leaf(.22, .4, .05), .02, '#7fa253', { bevel: .01 }); l1.position.set(0, h * .35, 0); l1.rotation.z = -.9; g.add(l1);
  const l2 = l1.clone(); l2.rotation.z = .9; l2.position.y = h * .5; g.add(l2);
  const head = new THREE.Group(); head.position.y = h;
  const p = ext(star(13, .34, .2), .03, '#f4c430', { bevel: .015 }); head.add(p);
  const p2 = ext(star(13, .28, .17), .03, '#f7d65c', { bevel: .015 }); p2.position.z = .03; p2.rotation.z = .12; head.add(p2);
  const ctr = ext(ellipse(.13, .13), .05, '#8a5a2b', { bevel: .02 }); ctr.position.z = .06; head.add(ctr);
  g.add(head); g.userData.head = head; return g;
}
function tulip(h = .8, color = '#ef8a76'){
  const g = new THREE.Group();
  const stem = mesh(new THREE.CylinderGeometry(.022, .025, h, 8), mat('#6f8f45')); stem.position.y = h / 2; g.add(stem);
  const cup = shapeFrom([[-.17, .05], [-.2, .3], [-.1, .22], [0, .34], [.1, .22], [.2, .3], [.17, .05], [0, -.06]]);
  const c = ext(cup, .08, color, { bevel: .03 }); c.position.y = h - .05; g.add(c);
  const l = ext(leaf(.16, .5, .12), .02, '#7fa253', { bevel: .01 }); l.rotation.z = .4; g.add(l);
  return g;
}
function tuft(color = '#7da055', h = .7, n = 5){
  const g = new THREE.Group();
  for (let i = 0; i < n; i++){ const b = ext(leaf(.13, h * (.6 + rand() * .5), (rand() - .5) * .3), .02, color, { bevel: .008 });
    b.rotation.z = (i - (n - 1) / 2) * .22; b.position.x = (i - (n - 1) / 2) * .06; b.position.z = (rand() - .5) * .05; g.add(b); }
  return g;
}
function bush(w = 1.2, color = '#86a85f'){
  const s = new THREE.Shape(); const pts = [];
  for (let i = 0; i <= 40; i++){ const t = i / 40 * Math.PI; const rr = 1 + .12 * Math.abs(Math.sin(t * 4));
    pts.push([Math.cos(t) * w / 2 * rr, Math.sin(t) * w * .42 * rr]); }
  const m = ext(shapeFrom(pts), .2, color, { bevel: .04 }); return m;
}
function rock(r = .5, color = '#a7a39b'){
  const m = mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, .7)); m.scale.set(1, .55, .6); return m;
}
function coral(color, h = 1.1, seed = 1){
  const g = new THREE.Group(); const M = mat(color, .6);
  const branch = (p0, dir, len, depth) => {
    const p1 = p0.clone().addScaledVector(dir, len);
    const mid = p0.clone().lerp(p1, .5).add(new THREE.Vector3((rand() - .5) * .1, 0, 0));
    const tube = mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, mid, p1), 8, .055 * (1 - depth * .22), 7), M); g.add(tube);
    const cap = mesh(new THREE.SphereGeometry(.055 * (1 - depth * .22), 8, 6), M); cap.position.copy(p1); g.add(cap);
    if (depth < 3){ const n = depth === 0 ? 3 : 2;
      for (let i = 0; i < n; i++){ const ang = (i - (n - 1) / 2) * .75 + (rand() - .5) * .3;
        const d = new THREE.Vector3(Math.sin(ang) + dir.x * .5, Math.cos(ang) * .9 + .3, 0).normalize();
        branch(p1, d, len * .72, depth + 1); } }
  };
  branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), h * .38, 0);
  g.scale.z = .35; return g;
}
async function sticker(url, height){
  const tex = await new THREE.TextureLoader().loadAsync(url);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const asp = tex.image.width / tex.image.height;
  const g = new THREE.PlaneGeometry(height * asp, height); g.translate(0, height / 2, 0);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, alphaTest: .5, side: THREE.DoubleSide, roughness: .85 }));
  m.castShadow = true; m.receiveShadow = false;
  m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: .5 });
  // grosor de cartón detrás del sticker
  const back = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#cbbb9c', alphaMap: tex, alphaTest: .5, side: THREE.BackSide, roughness: 1 }));
  back.position.z = -.025; m.add(back);
  return m;
}
function bunting(a0, a1, y, sag, colors, r = R - .14, makeFlag){
  const pts = [], N = 28;
  for (let i = 0; i <= N; i++){ const t = i / N; pts.push(polar(a0 + (a1 - a0) * t, r, y - sag * Math.sin(Math.PI * t))); }
  const curve = new THREE.CatmullRomCurve3(pts);
  scene.add(mesh(new THREE.TubeGeometry(curve, 60, .012, 5), mat('#7a5b3e')));
  const n = Math.round((a1 - a0) / 4.2);
  for (let i = 0; i < n; i++){
    const t = (i + .5) / n, a = a0 + (a1 - a0) * t;
    const f = makeFlag(colors[i % colors.length], i);
    place(f, a, r - .04, y - sag * Math.sin(Math.PI * t) - .02);
    f.rotation.z = (rand() - .5) * .15;
  }
}
const triFlag = (c) => { const m = ext(shapeFrom([[-.2, 0], [.2, 0], [0, -.42]]), .015, c, { bevel: .006 }); return m; };
const heartFlag = (c) => { const g = new THREE.Group(); const h = ext(heart(.2), .03, c, { bevel: .015 }); h.position.y = -.22; g.add(h); return g; };

function interactive(obj, label, onClick){
  obj.userData.click = onClick; obj.userData.label = label; obj.userData.h = 0;
  obj.userData.baseScale = obj.scale.clone(); clickables.push(obj);
}
function bounce(obj, amp = .35, dur = .6){
  const y0 = obj.userData.y0 ?? (obj.userData.y0 = obj.position.y);
  obj.userData.jump = { t: 0, dur, amp, y0 };
}
ticks.push((t, dt) => {
  for (const o of clickables){ const j = o.userData.jump; if (!j) continue;
    j.t += dt; const k = Math.min(j.t / j.dur, 1);
    o.position.y = j.y0 + Math.sin(k * Math.PI) * j.amp * (1 - k * .3);
    if (k >= 1){ o.position.y = j.y0; o.userData.jump = null; } }
});


/* ================= contexto compartido por las escenas ================= */
let AUD = null, HOOKS = null, ASSETS = '../';
const interactions = new Map();      // id → fn (para los botones DOM equivalentes)
function register(id, kind, obj, label, fn){
  interactive(obj, label, fn); obj.userData.kind = kind; if (id) interactions.set(id, fn);
}
const A_ = () => AUD || { tone(){}, pop(){}, keyNote(){}, speak(){ return false; }, swish(){} };
function say(obj, html, offsetY = 1.6, ms = 2400){ HOOKS?.say?.(obj, html, offsetY, ms); }
function charAsset(id, kind = 'sticker'){ const c = (HOOKS?.characters || []).find(c => c.id === id); return c && c.assets?.[kind] ? ASSETS + c.assets[kind] : null; }

/* letras vocales extruidas (compartidas por varias escenas) */
const VOWELS = {
  A: (() => { const s = shapeFrom([[0, 0], [.24, 0], [.31, .24], [.59, .24], [.66, 0], [.9, 0], [.56, 1], [.34, 1]]);
    const h = new THREE.Path(); h.moveTo(.37, .43); h.lineTo(.53, .43); h.lineTo(.45, .7); h.closePath(); s.holes.push(h); return s; })(),
  E: shapeFrom([[0, 0], [.68, 0], [.68, .21], [.25, .21], [.25, .4], [.6, .4], [.6, .6], [.25, .6], [.25, .79], [.68, .79], [.68, 1], [0, 1]]),
  I: shapeFrom([[0, 0], [.27, 0], [.27, 1], [0, 1]]),
  O: (() => { const s = new THREE.Shape(); s.absellipse(.43, .5, .43, .5, 0, Math.PI * 2);
    const h = new THREE.Path(); h.absellipse(.43, .5, .2, .29, 0, Math.PI * 2, true); s.holes.push(h); return s; })(),
  U: (() => { const p = [[0, 1], [0, .42]]; for (let i = 0; i <= 16; i++){ const t = Math.PI + i / 16 * Math.PI; p.push([.4 + Math.cos(t) * .4, .42 + Math.sin(t) * .42]); }
    p.push([.8, 1], [.55, 1], [.55, .42]); for (let i = 0; i <= 16; i++){ const t = 2 * Math.PI - i / 16 * Math.PI; p.push([.4 + Math.cos(t) * .15, .42 + Math.sin(t) * .17]); }
    p.push([.25, 1]); return shapeFrom(p); })(),
};
const VOWEL_W = { A: .9, E: .68, I: .27, O: .86, U: .8 };

/* ================= ISLA: laguna (Isla Mayúsculas · ruta de vocales con Tuti) ================= */
async function sceneLaguna(c, island){
  const aud = A_();
  const sg = wallSign(island.label, island.kid_text, c - 3, 5.0);
  register(null, 'experiencia', sg, 'Abrir ' + island.label, () => HOOKS?.onSign?.(island.id));
  if (island.touch?.note) wallNote(island.touch.note, c - 27, 2.85, { lineH: .3, tilt: .04, weight: 500 });

  // camino punteado con estrella y avión de papel (decorativo)
  const path = [];
  for (let i = 0; i <= 60; i++){ const t = i / 60; path.push([c - 34 + t * 68, 3.35 + Math.sin(t * Math.PI * 2.2 + .4) * .4 + t * 1.5]); }
  for (let i = 0; i < 60; i += 2){
    const [a0, y0] = path[i], [a1, y1] = path[i + 1];
    const dx = (a1 - a0) * DEG * (R - .1), dy = y1 - y0, len = Math.hypot(dx, dy);
    const d = ext(rrect(len * .95, .07, .03), .01, '#f0b062', { bevel: .005 }); place(d, (a0 + a1) / 2, R - .1, (y0 + y1) / 2);
    d.rotation.order = 'YXZ'; d.rotation.z = Math.atan2(dy, dx);
  }
  const st = ext(star(5, .38, .17), .06, '#e8735a', { bevel: .02 }); place(st, c - 37, R - .15, 3.4); st.rotation.order = 'YXZ'; st.rotation.z = .3;
  register(null, 'decorativa', st, 'Gira la estrella', () => { st.userData.spin = 1; aud.tone(1046, .25, 'sine', .1); });
  ticks.push((t, dt) => { const s = st.userData.spin || 0; st.rotation.z += s * dt * 10; st.userData.spin = Math.max(0, s - dt * .8); });
  const plane = new THREE.Group();
  plane.add(ext(shapeFrom([[0, 0], [-.7, .22], [-.5, 0]]), .01, '#a7cfb0', { bevel: .004 }));
  const w2 = ext(shapeFrom([[0, 0], [-.7, -.18], [-.45, 0]]), .01, '#8dbb99', { bevel: .004 }); w2.position.z = .02; plane.add(w2);
  place(plane, c + 37, R - .2, 5.2); plane.rotation.order = 'YXZ'; plane.rotation.z = .25;
  ticks.push(t => { if (!RM) plane.position.y = 5.2 + Math.sin(t * 1.3) * .08; });

  // estante de playa: pelota y castillo
  const ballTex = draw(512, 256, (g, w, h) => { ['#e9564a', '#f6f1e2', '#f2c12e', '#f6f1e2', '#4b8fd6', '#f6f1e2', '#6fbf73', '#f6f1e2'].forEach((col, i) => { g.fillStyle = col; g.fillRect(i * w / 8, 0, w / 8 + 1, h); }); });
  const ball = mesh(new THREE.SphereGeometry(.42, 32, 20), new THREE.MeshStandardMaterial({ map: ballTex, roughness: .7 }));
  place(ball, c + 25, midR(0) - .1, topOf(0) + .42);
  register(null, 'decorativa', ball, 'Rebota la pelota', () => { bounce(ball, .8, .8); aud.tone(330, .15, 'sine', .18); });
  ticks.push((t, dt) => ball.rotation.y += dt * .3);
  const castle = new THREE.Group();
  const cren = (pts, x0, x1, y, n) => { const w = (x1 - x0) / (n * 2 - 1); for (let i = 0; i < n * 2 - 1; i++){ const xa = x0 + i * w, xb = xa + w, yy = i % 2 === 0 ? y : y - .13; pts.push([xa, yy], [xb, yy]); } };
  const P = [[-1.25, 0], [1.25, 0], [1.25, 1.25]];
  const t1 = []; cren(t1, 1.25, .78, 1.25, 3); P.push(...t1, [.78, .85]);
  const m1 = []; cren(m1, .78, .38, .85, 2); P.push(...m1, [.38, 1.55], [0, 2.1], [-.38, 1.55], [-.38, .85]);
  const m2 = []; cren(m2, -.38, -.78, .85, 2); P.push(...m2, [-.78, 1.25]);
  const t2 = []; cren(t2, -.78, -1.25, 1.25, 3); P.push(...t2);
  castle.add(ext(shapeFrom(P), .45, '#d7b98b', { bevel: .03, rep: .9 }));
  const door = ext(shapeFrom([[-.25, 0], [.25, 0], [.25, .4], [0, .62], [-.25, .4]]), .04, '#a98559', { bevel: .015 }); door.position.z = .25; castle.add(door);
  for (const [x, y] of [[-1, .85], [1, .85], [0, 1.25], [-.58, .55], [.58, .55]]){ const wd = ext(rrect(.12, .2, .05), .03, '#a98559', { bevel: .01 }); wd.position.set(x, y, .25); castle.add(wd); }
  const pole = mesh(new THREE.CylinderGeometry(.015, .015, .5, 6), mat('#8c6a4e')); pole.position.set(0, 2.32, 0); castle.add(pole);
  const flag = ext(shapeFrom([[0, 0], [.35, -.1], [0, -.2]]), .01, '#e8735a', { bevel: .004 }); flag.position.set(.01, 2.55, 0); castle.add(flag);
  ticks.push(t => flag.scale.x = .85 + Math.sin(t * 5) * .15);
  castle.scale.setScalar(.9); place(castle, c + 40, midR(0) + .1, topOf(0));
  register(null, 'decorativa', castle, 'Castillo de arena', () => { bounce(castle, .15, .4); aud.tone(220, .3, 'triangle', .1); });
  [[c + 28, 0], [c - 24, 0], [c + 8, 0]].forEach(([a, r]) => place(tuft('#7fa253', .65), a, midR(r) - .2, topOf(r)));

  // vocales (educativa): letras, palabras y voz vienen de los datos

  const cols = ['#ee8a6e', '#f2c84b', '#94c06d', '#82bde6', '#b597da'];
  const items = island.touch?.items || [];
  items.forEach((it, i) => {
    const ch = it.text.toUpperCase(); if (!VOWELS[ch]) return;
    const g = new THREE.Group();
    g.add(ext(shapeFrom([[-.5, 0], [.5, 0], [.32, .26], [-.32, .26]]), .45, '#d9bf98', { bevel: .02 }));
    const letter = ext(VOWELS[ch], .2, cols[i % cols.length], { bevel: .05, rep: 1.4 });
    letter.scale.set(1.05, 1.05, 1); letter.position.set(-VOWEL_W[ch] * 1.05 / 2, .3, 0); g.add(letter);
    place(g, c - 17 + i * 8.5, midR(1) - .15, topOf(1), (i - 2) * -3);
    register(it.id, 'educativa', g, `${ch} de ${it.word}`, () => {
      bounce(g, .55, .65); g.userData.spinT = 1;
      const spoken = aud.speak(it.say);
      aud.keyNote([72, 74, 76, 77, 79][i % 5], spoken ? .14 : .3);
      say(g, `<b>${ch}</b> de ${it.word}`, 1.9);
    });
    ticks.push((t, dt) => { const s = g.userData.spinT || 0; if (s > 0){ g.userData.spinT = Math.max(0, s - dt * 1.5); letter.rotation.y = (1 - g.userData.spinT) * Math.PI * 2; } });
  });

  // agua: olas, nenúfares, corales, rocas, peces (decorativo)
  for (let i = 0; i < 6; i++){
    const p = []; const w = 1.1 + rand() * .7;
    for (let k = 0; k <= 30; k++){ const t = k / 30; p.push([t * w - w / 2, Math.sin(t * Math.PI * 2) * .07]); }
    for (let k = 30; k >= 0; k--){ const t = k / 30; p.push([t * w - w / 2, Math.sin(t * Math.PI * 2) * .07 - .045]); }
    const wv = flat(ext(shapeFrom(p), .01, '#9fb6e8', { bevel: 0 })); const a0 = c - 28 + rand() * 56, r0 = 2.6 + rand() * 4;
    wv.castShadow = false; place(wv, a0, r0, .02); wv.rotation.x = -Math.PI / 2;
    ticks.push(t => { if (RM) return; wv.position.copy(polar(a0 + Math.sin(t * .3 + i) * 2.5, r0, .02)); });
  }
  [[c + 9, 3.6, .55], [c + 15, 4.4, .38], [c - 33, 4.7, .45]].forEach(([a, r, s], i) => {
    const p = new THREE.Shape(); p.moveTo(0, 0); p.lineTo(Math.cos(.2) * s, Math.sin(.2) * s); p.absarc(0, 0, s, .2, Math.PI * 2 - .2, false); p.lineTo(0, 0);
    const pad = flat(ext(p, .02, '#8fb267', { bevel: .01 })); pad.castShadow = false; place(pad, a, r, .03); pad.rotation.x = -Math.PI / 2; pad.rotation.z = i * 2;
  });
  [[c - 30, 6.0, '#ee7f9a', 1.2], [c - 37, 6.6, '#f2a97f', .8], [c + 32, 6.3, '#8fb9de', 1.25], [c + 39, 6.7, '#ee7f9a', .8]].forEach(([a, r, col, h], i) => {
    place(rock(.45), a, r, 0); place(coral(col, h, i), a, r, .12); });
  [[c - 20, 6.6], [c + 24, 5.9]].forEach(([a, r]) => place(tuft('#86a85f', .9, 6), a, r, 0));
  for (let i = 0; i < 3; i++){
    const fsh = new THREE.Group(), col = ['#f29a4a', '#f6d257', '#8fc0e8'][i];
    fsh.add(ext(ellipse(.16, .09), .04, col, { bevel: .015 }));
    const tl = ext(shapeFrom([[0, 0], [.12, .08], [.12, -.08]]), .03, col, { bevel: .01 }); tl.position.x = -.25; tl.rotation.z = Math.PI; fsh.add(tl);
    scene.add(fsh);
    ticks.push(t => { const ph = t * (.25 + i * .05) + i * 2, a = c - 6 + Math.sin(ph) * 24, r = 3.2 + i * .9;
      fsh.position.copy(polar(a, r, .08 + Math.sin(t * 2 + i) * .02)); fsh.rotation.y = -a * DEG + (Math.cos(ph) > 0 ? 0 : Math.PI); });
  }

  // Tuti (canónica, solo en esta isla): nada en la laguna. Narrativa: saluda con texto, sin voz de personaje.
  const url = charAsset('tuti');
  if (url){
    const tuti = await sticker(url, 1.85); scene.add(tuti);
    const ripples = [];
    for (let i = 0; i < 3; i++){
      const rg = new THREE.Mesh(new THREE.RingGeometry(.9, .96, 48), new THREE.MeshBasicMaterial({ color: '#c9d6f5', transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      rg.rotation.x = -Math.PI / 2; scene.add(rg); ripples.push(rg);
    }
    let flip = -1;   // la referencia mira a la izquierda
    ticks.push((t, dt) => {
      const sp = RM ? 0 : 1;
      const a = c - 2 + Math.sin(t * .22 * sp) * 14, r = 6.0 + Math.sin(t * .37 * sp) * .3, da = Math.cos(t * .22 * sp);
      tuti.position.copy(polar(a, r, -.38 + Math.sin(t * 2.2) * .05 * sp));
      flip += ((da >= 0 ? -1 : 1) - flip) * Math.min(1, dt * 3);
      tuti.rotation.set(0, -a * DEG, Math.sin(t * 2.2) * .04 * sp);
      tuti.userData.flip = Math.abs(flip) < .05 ? .05 * Math.sign(flip || 1) : flip;
      ripples.forEach((rg, i) => { const k = ((t * .45 + i / 3) % 1); rg.position.set(tuti.position.x, .025, tuti.position.z);
        rg.scale.set(.5 + k * 1.1, (.5 + k * 1.1) * .55, 1); rg.material.opacity = (1 - k) * .7; });
    });
    register(null, 'narrativa', tuti, 'Saluda a Tuti', () => { aud.tone(587, .14, 'sine', .12); aud.tone(880, .2, 'sine', .1, .1); say(tuti, HOOKS?.text?.tuti_hello || '¡Hola!', 1.6); });
  }
}

/* ================= ISLA: bosque (Cuentos · Lectoaventuras) ================= */
async function sceneBosque(c, island){
  const aud = A_();
  const sg = wallSign(island.label, island.kid_text, c - 5, 5.3);
  register(null, 'experiencia', sg, 'Abrir ' + island.label, () => HOOKS?.onSign?.(island.id));

  const sunG = new THREE.Group();
  sunG.add(ext(star(12, .78, .56), .05, '#f6c445', { bevel: .02 }));
  const sd = ext(ellipse(.48, .48), .07, '#f9d76a', { bevel: .03 }); sd.position.z = .06; sunG.add(sd);
  place(sunG, c + 35, R - .2, 5.2); sunG.scale.setScalar(1.15); ticks.push(t => sunG.rotation.z = RM ? 0 : t * .08);
  register(null, 'decorativa', sunG, 'Toca el sol', () => aud.pop());

  // árbol con corazón
  const tree = new THREE.Group();
  tree.add(ext(shapeFrom([[-.32, 0], [.32, 0], [.22, .9], [.62, 1.45], [.5, 1.55], [.12, 1.12], [0, 1.6], [-.12, 1.12], [-.5, 1.5], [-.62, 1.4], [-.22, .9]]), .22, '#8c6a4e', { bevel: .04 }));
  const can1 = ext(scallop(1.25, 9, .22, 1.25, .9, .3), .2, '#8aab64', { bevel: .05 }); can1.position.set(0, 2.25, -.15); tree.add(can1);
  const can2 = ext(scallop(.9, 7, .22, 1.2, .8, 1.1), .14, '#9ebd78', { bevel: .04 }); can2.position.set(-.25, 2.45, .05); tree.add(can2);
  for (let i = 0; i < 6; i++){ const lf = ext(leaf(.12, .22, .02), .02, '#6f9149', { bevel: .006 }); lf.position.set(-1 + rand() * 2, 1.8 + rand() * .9, .16); lf.rotation.z = rand() * 6; tree.add(lf); }
  const hrt = ext(heart(.26), .05, '#d9b48c', { bevel: .02 }); hrt.position.set(0, .7, .14); tree.add(hrt);
  place(tree, c - 36, midR(0) + .1, topOf(0));
  register(null, 'decorativa', tree, 'Sacude el árbol', () => { tree.userData.shake = 1; aud.tone(392, .2); aud.tone(523, .25, 'triangle', .1, .08); });
  ticks.push((t, dt) => { const s = tree.userData.shake || 0; tree.rotation.z = Math.sin(t * 28) * .04 * s; tree.userData.shake = Math.max(0, s - dt * 1.4); });

  // teatrino de cuentos (sin títeres: no se agregan personajes)
  const th = new THREE.Group();
  const frame = ext(rrect(2.1, 2.2, .08), .3, '#f3e3c3', { bevel: .03 }); frame.position.y = 1.1; th.add(frame);
  const stage = ext(rrect(1.6, 1.25, .04), .05, '#5c3a2e', { bevel: .01 }); stage.position.set(0, 1.25, .17); th.add(stage);
  for (const s of [-1, 1]){ const cu = ext(shapeFrom([[0, .63], [.46 * s, .63], [.36 * s, .3], [.16 * s, .02], [.26 * s, -.6], [0, -.6]]), .04, '#d4574a', { bevel: .015 }); cu.position.set(-.8 * s, 1.25, .21); th.add(cu);
    const tie = mesh(new THREE.SphereGeometry(.05, 10, 8), mat('#f2c84b')); tie.position.set(-.8 * s + .17 * s, 1.27, .26); th.add(tie); }
  const valance = ext(scallop(.9, 9, .1, 1.1, .22), .05, '#fbf5e8', { bevel: .015 }); valance.position.set(0, 1.95, .2); th.add(valance);
  const book = new THREE.Group();
  const pageL = ext(rrect(.5, .36, .03), .02, '#fffaf0', { bevel: .01 }); pageL.position.x = -.26; pageL.rotation.y = .25; book.add(pageL);
  const pageR = ext(rrect(.5, .36, .03), .02, '#fffaf0', { bevel: .01 }); pageR.position.x = .26; pageR.rotation.y = -.25; book.add(pageR);
  const cover = ext(rrect(1.1, .42, .04), .02, '#4b8fd6', { bevel: .01 }); cover.position.z = -.05; book.add(cover);
  book.position.set(0, 1.05, .25); th.add(book);
  const tsign = sign(island.label, '#f2c84b', 1.4, .42); tsign.position.set(0, 2.42, .12); th.add(tsign);
  for (let i = 0; i < 5; i++){ const f = triFlag(['#f2c84b', '#ee8a6e', '#94c06d', '#82bde6', '#b597da'][i]); f.scale.setScalar(.6); f.position.set(-.8 + i * .4, .18, .18); th.add(f); }
  place(th, c - 13, midR(0) + .05, topOf(0));
  register(null, 'experiencia', th, 'Abrir los cuentos', () => { aud.pop(); book.userData.flip = 1; HOOKS?.onSign?.(island.id); });
  ticks.push((t, dt) => { const f = book.userData.flip || 0; pageR.rotation.y = -.25 - Math.sin(f * Math.PI) * 1.2; book.userData.flip = Math.max(0, f - dt * 1.2); });

  // librero
  const shelf = new THREE.Group();
  const sf = mesh(new RoundedBoxGeometry(1.6, 1.6, .5, 2, .03), mat('#c89a63')); sf.position.y = .8; shelf.add(sf);
  const inner = mesh(new THREE.BoxGeometry(1.42, .66, .42), mat('#8b6644'));
  for (const y of [.45, 1.18]){ const ii = inner.clone(); ii.position.set(0, y, .06); shelf.add(ii); }
  const bc = ['#e9564a', '#4b8fd6', '#f2c84b', '#6fbf73', '#b597da', '#ee8a6e', '#82bde6'];
  for (const y of [.15, .88]){ let x = -.62, k = 0;
    while (x < .55){ const bw = .08 + rand() * .07, bh = .4 + rand() * .18; const bk = mesh(new THREE.BoxGeometry(bw, bh, .3), mat(bc[(k++ + (y > .5 ? 3 : 0)) % bc.length]));
      bk.position.set(x + bw / 2, y + bh / 2, .1); if (rand() < .15) bk.rotation.z = .2; shelf.add(bk); x += bw + .015; } }
  place(shelf, c + 22, midR(0) - .05, topOf(0));
  register(null, 'decorativa', shelf, 'Muchos libros', () => aud.pop());

  // libro gigante abierto en el piso
  const big = new THREE.Group();
  const bl = ext(rrect(1.2, .9, .08), .04, '#fffaf0', { bevel: .02 }); bl.rotation.x = -Math.PI / 2 + .12; bl.rotation.y = .1; bl.position.set(-.62, .1, 0); big.add(bl);
  const br = ext(rrect(1.2, .9, .08), .04, '#fffaf0', { bevel: .02 }); br.rotation.x = -Math.PI / 2 + .12; br.rotation.y = -.1; br.position.set(.62, .1, 0); big.add(br);
  const bcv = ext(rrect(2.6, 1.0, .1), .04, '#e8735a', { bevel: .02 }); bcv.rotation.x = -Math.PI / 2; bcv.position.y = .03; big.add(bcv);
  const lines = draw(256, 192, (g, w, h) => { g.fillStyle = '#fffaf0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8c7aa'; g.lineWidth = 6; g.lineCap = 'round';
    for (let i = 0; i < 6; i++){ g.beginPath(); g.moveTo(24, 30 + i * 26); g.lineTo(w - 24 - (i % 3) * 30, 30 + i * 26); g.stroke(); } });
  for (const [x, ry] of [[-.62, .1], [.62, -.1]]){ const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.05, .78), new THREE.MeshStandardMaterial({ map: lines, roughness: 1 }));
    pl.rotation.order = 'YXZ'; pl.rotation.x = -Math.PI / 2 + .12; pl.rotation.y = ry; pl.position.set(x, .135, .01); pl.receiveShadow = true; big.add(pl); }
  place(big, c + 9, 4.9, 0, 6);

  // flores, matas, mariposas (decorativo)
  [[c - 42, 1, 1.05], [c + 30, 1, .9], [c + 2, 2, .85], [c - 26, 2, .75], [c + 44, 0, 1.15]].forEach(([a, ring, h], i) => {
    const f = sunflower(h); place(f, a, midR(ring) + (ring === 0 ? -.3 : 0), topOf(ring));
    register(null, 'decorativa', f, 'Gira el girasol', () => { f.userData.spin = 1.4; aud.tone(659, .18); });
    ticks.push((t, dt) => { const s = f.userData.spin || 0; f.userData.head.rotation.z += s * dt * 9; f.userData.spin = Math.max(0, s - dt); if (!RM) f.rotation.z = Math.sin(t * 1.1 + i) * .03; });
  });
  [[c + 17, 1, '#ef8a76'], [c + 37, 2, '#f2a3b3'], [c - 17, 2, '#ef8a76']].forEach(([a, r, col]) => place(tulip(.75, col), a, midR(r), topOf(r)));
  [[c - 3, 1], [c + 40, 1], [c - 46, 2]].forEach(([a, r]) => place(tuft('#86a85f', .5), a, midR(r) + .2, topOf(r)));
  place(bush(1.5), c + 48, midR(0) + .2, topOf(0)); place(bush(1.1, '#94b46c'), c - 34, midR(2) + .2, topOf(2));
  for (let i = 0; i < 3; i++){
    const b = new THREE.Group(), col = ['#f29fb2', '#f4c430', '#8fc0e8'][i]; b.scale.setScalar(1.6);
    const wl = ext(heart(.18), .01, col, { bevel: .004 }), wr = wl.clone();
    const Lg = new THREE.Group(), Rg = new THREE.Group(); wl.position.x = -.14; wl.rotation.z = .5; wr.position.x = .14; wr.rotation.z = -.5;
    Lg.add(wl); Rg.add(wr); b.add(Lg, Rg); scene.add(b);
    ticks.push(t => { const ph = t * (.35 + i * .07) + i * 2, a = c + Math.sin(ph) * 38;
      b.position.copy(polar(a, 9.4 - i * .6, 3 + Math.sin(ph * 2.3) * .6 + i * .3)); b.rotation.y = -a * DEG + (Math.cos(ph) > 0 ? -.6 : .6);
      const f = RM ? .3 : Math.sin(t * 14 + i) * .9; Lg.rotation.y = f; Rg.rotation.y = -f; });
  }

  // Kikino (canónico): guía. Narrativa con texto, sin voz de personaje.
  const url = charAsset('kikino');
  if (url){
    const kik = await sticker(url, 2.1); place(kik, c + 3, midR(1), topOf(1) - .02);
    register(null, 'narrativa', kik, 'Saluda a Kikino', () => { bounce(kik, .5, .7); aud.tone(523, .14); aud.tone(784, .2, 'triangle', .12, .1); say(kik, HOOKS?.text?.kikino_hello || '¡Hola!', 2.4); });
    ticks.push(t => { if (!RM) kik.rotation.z = Math.sin(t * 1.6) * .03; });
    HOOKS?.registerGuide?.(kik);
  }
}

/* ================= ISLA: patio (Juegos · La Banda Imaginantes y Pecesita al Rescate del Mar) ================= */
async function scenePatio(c, island){
  const aud = A_();
  const sg = wallSign(island.label, island.kid_text, c - 2, 5.25);
  register(null, 'experiencia', sg, 'Abrir ' + island.label, () => HOOKS?.onSign?.(island.id));
  bunting(c - 46, c + 46, 5.95, .35, ['#f2c84b', '#ee8a6e', '#94c06d', '#82bde6', '#b597da'], R - .14, triFlag);

  // rincón de la banda: piano, tambor y xilófono (decorativo-musical)
  const piano = new THREE.Group();
  const base = mesh(new RoundedBoxGeometry(3.0, .2, 1.05, 3, .06), mat('#4a3a33')); base.position.y = .1; piano.add(base);
  [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83].forEach((midi, i) => {
    const k = mesh(new RoundedBoxGeometry(.19, .1, .78, 2, .025), mat('#f7f2e6', 1)); k.position.set(-1.3 + i * .2, .25, .08); piano.add(k);
    register(null, 'decorativa', k, 'Toca el piano', () => { aud.keyNote(midi, .4); k.userData.press = .12; });
    ticks.push((t, dt) => { const p = k.userData.press || 0; k.position.y = .25 - p * .4; k.userData.press = Math.max(0, p - dt * .6); });
  });
  [0, 1, 3, 4, 5, 7, 8, 10, 11, 12].forEach(i => { const b = mesh(new RoundedBoxGeometry(.12, .1, .45, 2, .02), mat('#2a2220')); b.position.set(-1.2 + i * .2, .33, -.08); piano.add(b); });
  place(piano, c - 22, 5.0, 0, 22);
  const drum = new THREE.Group();
  const shell = mesh(new THREE.CylinderGeometry(.45, .45, .5, 28), mat('#e9564a')); shell.position.y = .25; drum.add(shell);
  const skin = mesh(new THREE.CylinderGeometry(.47, .47, .04, 28), mat('#fbf5e8', 1)); skin.position.y = .52; drum.add(skin);
  for (let i = 0; i < 8; i++){ const z = mesh(new THREE.BoxGeometry(.03, .5, .03), mat('#f2c84b')); const a = i / 8 * Math.PI * 2; z.position.set(Math.sin(a) * .46, .25, Math.cos(a) * .46); z.rotation.z = (i % 2 ? .5 : -.5); drum.add(z); }
  place(drum, c - 30, midR(1) - .2, topOf(1));
  register(null, 'decorativa', drum, 'Toca el tambor', () => { bounce(drum, .08, .25); aud.tone(110, .35, 'sine', .3); aud.tone(70, .4, 'sine', .25); });
  const xylo = new THREE.Group();
  const xb = mesh(new RoundedBoxGeometry(1.6, .12, .7, 2, .03), mat('#b5884f')); xb.position.y = .06; xylo.add(xb);
  ['#e9564a', '#f2a540', '#f2c84b', '#6fbf73', '#4b8fd6', '#9b7ad1'].forEach((col, i) => {
    const bar = mesh(new RoundedBoxGeometry(.2, .06, .62 - i * .06, 2, .02), mat(col)); bar.position.set(-.6 + i * .24, .16, 0); xylo.add(bar);
    register(null, 'decorativa', bar, 'Toca el xilófono', () => { aud.keyNote([72, 74, 76, 79, 81, 84][i], .3); bar.userData.press = .1; });
    ticks.push((t, dt) => { const p = bar.userData.press || 0; bar.position.y = .16 - p * .3; bar.userData.press = Math.max(0, p - dt * .5); });
  });
  place(xylo, c - 12, midR(2), topOf(2), -6);

  // rincón del mar: charco con basura de papel para recoger (narrativa)
  const pool = flat(ext(scallop(1.3, 6, .1, 1.4, .85), .03, '#4f75c4', { bevel: .015 })); pool.castShadow = false; place(pool, c + 22, 5.5, .03);
  const bin = new THREE.Group();
  const bb = mesh(new THREE.CylinderGeometry(.32, .26, .7, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#5f9f6a', map: paperTex(.6), side: THREE.DoubleSide, roughness: .9 })); bb.position.y = .35; bb.castShadow = true; bin.add(bb);
  const arrows = ext(star(3, .14, .08), .02, '#fbf5e8', { bevel: .005 }); arrows.position.set(0, .4, .33); bin.add(arrows);
  place(bin, c + 34, 6.1, 0);
  const trash = [];
  const makeTrash = (i) => {
    const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner); g.userData.inner = inner;
    if (i % 2){ inner.add(ext(rrect(.14, .34, .05), .12, '#a8d0e6', { bevel: .03 })); const cap = mesh(new THREE.CylinderGeometry(.04, .04, .06, 10), mat('#4b8fd6')); cap.position.y = .2; inner.add(cap); }
    else { inner.add(mesh(new THREE.CylinderGeometry(.09, .09, .24, 16), mat('#d9d4cc'))); inner.add(mesh(new THREE.CylinderGeometry(.092, .092, .1, 16), mat('#e9564a'))); }
    inner.rotation.z = 1.3; return g;
  };
  for (let i = 0; i < 4; i++){
    const g = makeTrash(i), home = polar(c + 17 + i * 3.4, 5.2 + (i % 2) * .5, .1); g.position.copy(home); scene.add(g);
    g.userData.home = home.clone(); g.userData.fly = 0; trash.push(g);
    register(null, 'narrativa', g, 'Recoge la basura', () => {
      if (g.userData.fly) return; g.userData.fly = .001; aud.swish(.35, .06, 600, 2200); setTimeout(() => aud.pop(), 380);
      if (trash.every(o => o.userData.fly)) setTimeout(() => say(bin, HOOKS?.text?.sea_clean || '¡Listo!', 1.2), 500);
    });
    ticks.push((t, dt) => {
      const inner = g.userData.inner;
      if (!g.userData.fly){ g.visible = true; inner.scale.setScalar(1); g.position.copy(g.userData.home); g.position.y = .1 + Math.sin(t * 1.6 + i) * .03; return; }
      g.userData.fly += dt * .9; const k = Math.min(1, g.userData.fly);
      if (k < 1){ const to = bin.position.clone().setY(.75); g.position.lerpVectors(g.userData.home, to, k); g.position.y += Math.sin(k * Math.PI) * 1.4; inner.scale.setScalar(1 - k * .6); }
      else g.visible = false;
      if (g.userData.fly > 6) g.userData.fly = 0;   // vuelve a aparecer para jugar otra vez
    });
  }
  for (let i = 0; i < 2; i++){
    const wv = new THREE.Mesh(new THREE.RingGeometry(.5, .54, 40), new THREE.MeshBasicMaterial({ color: '#c9d6f5', transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    wv.rotation.x = -Math.PI / 2; scene.add(wv);
    ticks.push(t => { const k = (t * .3 + i * .5) % 1; wv.position.copy(polar(c + 22, 5.5, .045)); wv.scale.set(.6 + k * 1.6, (.6 + k * 1.6) * .6, 1); wv.material.opacity = (1 - k) * .6; });
  }

  // rayuela (educativa): las casillas y su voz vienen de los datos
  const items = island.touch?.items || [];
  const layout = [[0, 0], [-.5, 1], [.5, 1], [0, 2], [-.5, 3], [.5, 3]];
  const hopCols = ['#f6e7c8', '#fbefd6'];
  const hopG = new THREE.Group();
  items.slice(0, layout.length).forEach((it, i) => {
    const [x, row] = layout[i];
    const tx = draw(128, 128, (g, w) => { g.fillStyle = hopCols[i % 2]; g.fillRect(0, 0, w, w); g.strokeStyle = '#e8735a'; g.lineWidth = 7; g.strokeRect(6, 6, w - 12, w - 12);
      g.fillStyle = '#e8735a'; g.font = `700 74px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(it.text, w / 2, w / 2 + 4); });
    const side = mat(hopCols[i % 2]);
    const tile = new THREE.Mesh(new THREE.BoxGeometry(.92, .03, .92), [side, side, new THREE.MeshStandardMaterial({ map: tx, roughness: 1 }), side, side, side]);
    tile.receiveShadow = true; tile.position.set(x, .015, -row * .98); hopG.add(tile);
    register(it.id, 'educativa', tile, `Salta al ${it.text}`, () => { tile.userData.press = 1; aud.keyNote(60 + [0, 2, 4, 5, 7, 9][i], .25); aud.speak(it.say); say(tile, `<b>${it.text}</b> · ${it.say}`, .3, 1500); });
    ticks.push((t, dt) => { const p = tile.userData.press || 0; tile.position.y = .015 + Math.sin(p * Math.PI) * .12; tile.userData.press = Math.max(0, p - dt * 3); });
  });
  place(hopG, c + 3, 3.9, 0);

  // pelota, matas
  const ballTex = draw(512, 256, (g, w, h) => { ['#4b8fd6', '#fbf5e8', '#e9564a', '#fbf5e8'].forEach((col, i) => { g.fillStyle = col; g.fillRect(i * w / 4, 0, w / 4 + 1, h); }); });
  const ball = mesh(new THREE.SphereGeometry(.38, 32, 20), new THREE.MeshStandardMaterial({ map: ballTex, roughness: .7 })); place(ball, c + 40, midR(0), topOf(0) + .38);
  register(null, 'decorativa', ball, 'Rebota la pelota', () => { bounce(ball, .8, .8); aud.tone(330, .15, 'sine', .18); });
  place(bush(1.3, '#94b46c'), c - 44, midR(0) + .2, topOf(0)); place(tuft('#86a85f', .55), c + 30, midR(1), topOf(1)); place(tuft('#86a85f', .5), c - 40, midR(2), topOf(2));
  const stars = [[c - 30, 5.3], [c + 30, 5.0], [c + 14, 4.3]];
  stars.forEach(([a, y], i) => { const s = ext(star(5, .22, .1), .03, i % 2 ? '#ffffff' : '#f2c84b', { bevel: .01 }); place(s, a, R - .12, y); s.rotation.order = 'YXZ'; s.rotation.z = i; });
}

const SCENES = { laguna: sceneLaguna, bosque: sceneBosque, patio: scenePatio };

/* ================= motor ================= */
export async function createWorld({ scenes = {}, canvas, islands, startIndex = 0, assetsBase = '../', characters = [], text = {}, audio = null, bubbleEl, tipEl, lowQuality = false, reducedMotion = false, maxDpr = 1.75, hooks = {} }){
  RM = reducedMotion; AUD = audio; ASSETS = assetsBase;
  const N = Math.min(islands.length, 6), SPAN = 360 / N;
  const SC = { ...SCENES, ...scenes };
  PAL = islands.slice(0, N).map(i => i.palette.wall); SPAN_G = SPAN;
  HOOKS = { ...hooks, characters, text, say: (o, h, y, ms) => sayBubble(o, h, y, ms) };

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowQuality, powerPreference: 'high-performance' }); }
  catch (e) { throw new Error('webgl'); }
  if (!renderer.getContext()) throw new Error('webgl');
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#e9dcc6');
  const camera = new THREE.PerspectiveCamera(60, 1, .1, 100);
  scene.add(new THREE.HemisphereLight('#fff6e6', '#b7a283', 1.55));
  const sunL = new THREE.DirectionalLight('#fff1dc', 2.35);
  Object.assign(sunL.shadow.camera, { left: -15, right: 15, top: 13, bottom: -13, near: 1, far: 45 });
  sunL.shadow.bias = -.0004; sunL.shadow.normalBias = .03;
  scene.add(sunL, sunL.target);
  renderer.toneMapping = THREE.NeutralToneMapping;
  function applyQuality(low){
    renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : maxDpr));
    renderer.shadowMap.enabled = !low; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sunL.castShadow = !low; sunL.shadow.mapSize.set(low ? 512 : 2048, low ? 512 : 2048);
    if (sunL.shadow.map){ sunL.shadow.map.dispose(); sunL.shadow.map = null; }
    scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    resize();
  }

  // arquitectura de cada isla (barata): pared, borde, gradas, piso
  islands.slice(0, N).forEach((isl, k) => {
    const a0 = k * SPAN - SPAN / 2, a1 = k * SPAN + SPAN / 2, p = isl.palette;
    wallSector(a0, a1, p.wall, p.lip);
    sector(RINGS[0][0], RINGS[0][1], a0, a1, RINGS[0][2], p.r0, .5);
    sector(RINGS[1][0], RINGS[1][1], a0, a1, RINGS[1][2], p.r1, .5);
    sector(RINGS[2][0], RINGS[2][1], a0, a1, RINGS[2][2], p.r2, .5);
    sector(0.01, FLOOR_R, a0, a1, .05, p.floor, .4, 0).position.y = -.05;
  });
  ticks.push((t, dt) => {
    for (const o of clickables){ const j = o.userData.jump; if (!j) continue;
      j.t += dt; const k = Math.min(j.t / j.dur, 1);
      o.position.y = j.y0 + Math.sin(k * Math.PI) * j.amp * (1 - k * .3);
      if (k >= 1){ o.position.y = j.y0; o.userData.jump = null; } }
  });

  // escenas: primero la activa, luego las demás en tiempo libre
  const built = new Set();
  async function buildScene(i){ if (built.has(i)) return; built.add(i); const isl = islands[i], fn = SC[isl.scene]; if (fn) await fn(i * SPAN, isl, { span: SPAN, index: i, count: N }); }
  await buildScene(startIndex);
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 120));
  const rest = [...Array(N).keys()].filter(i => i !== startIndex);
  const buildRest = () => { const i = rest.shift(); if (i === undefined) return; buildScene(i).then(() => idle(buildRest)); };
  idle(buildRest);

  /* ---- navegación ---- */
  const mod = (a, n) => ((a % n) + n) % n;
  let cur = startIndex * SPAN - 40, target = cur, lastInput = 0, entered = false, enterT = 0, dragging = null, paused = false;
  const mouse = { x: 0, y: 0, sx: -999, sy: -999, has: false, type: '', lastMove: 0 };
  const nudge = () => { lastInput = performance.now(); hooks.onInput?.(); };
  function goIsland(i){ const curZ = Math.round(target / SPAN); const d = mod(i - curZ, N); target = (curZ + (d > N / 2 ? d - N : d)) * SPAN; buildScene(mod(i, N)); lastInput = performance.now(); }
  canvas.addEventListener('wheel', e => { if (paused) return; e.preventDefault(); target += (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * .09; nudge(); }, { passive: false });
  canvas.addEventListener('pointerdown', e => { dragging = { x: e.clientX, t0: target, moved: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = -(e.clientY / innerHeight) * 2 + 1; mouse.has = true; mouse.type = e.pointerType;
    if (Math.hypot(e.clientX - mouse.sx, e.clientY - mouse.sy) > 3) mouse.lastMove = performance.now();
    mouse.sx = e.clientX; mouse.sy = e.clientY;
    if (tipEl){ tipEl.style.left = e.clientX + 'px'; tipEl.style.top = e.clientY + 'px'; }
    if (dragging){ const dx = e.clientX - dragging.x; if (Math.abs(dx) > 6) dragging.moved = true;
      if (dragging.moved){ target = dragging.t0 - dx / innerWidth * (innerWidth < 700 ? 80 : 120); nudge(); canvas.classList.add('grabbing'); } }
  });
  canvas.addEventListener('pointerup', e => { if (dragging && !dragging.moved) clickAt(e.clientX, e.clientY); dragging = null; canvas.classList.remove('grabbing'); });
  canvas.addEventListener('pointercancel', () => dragging = null);
  canvas.addEventListener('pointerleave', () => { mouse.has = false; setHover(null); });

  /* ---- picking ---- */
  const ray = new THREE.Raycaster();
  let hovered = null;
  function pick(x, y){ ray.setFromCamera({ x, y }, camera); for (const h of ray.intersectObjects(clickables, true)){ let o = h.object; while (o && !o.userData.click) o = o.parent; if (o) return o; } return null; }
  function clickAt(cx, cy){ const o = pick(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); if (o){ o.userData.click(); nudge(); } }
  function setHover(o){ if (o === hovered) return; if (o) audio?.hoverTick(); hovered = o; canvas.classList.toggle('point', !!o);
    if (tipEl){ tipEl.textContent = o ? o.userData.label : ''; tipEl.classList.toggle('on', !!o); } }

  /* ---- globo de texto ---- */
  let bubble = null;
  function sayBubble(obj, html, offsetY = 1.6, ms = 2400){
    if (!bubbleEl) return; bubbleEl.innerHTML = html; bubble = { obj, offsetY, until: performance.now() + ms }; bubbleEl.classList.add('on');
    hooks.onSay?.(bubbleEl.textContent);
  }
  function updateBubble(){
    if (!bubble) return;
    if (performance.now() > bubble.until){ bubbleEl.classList.remove('on'); bubble = null; return; }
    const p = new THREE.Vector3(); bubble.obj.getWorldPosition(p); p.y += bubble.offsetY; p.project(camera);
    if (p.z > 1){ bubbleEl.classList.remove('on'); return; }
    bubbleEl.style.left = ((p.x + 1) / 2 * innerWidth) + 'px'; bubbleEl.style.top = ((1 - p.y) / 2 * innerHeight) + 'px';
  }

  /* ---- zoom suave donde se detiene el cursor ---- */
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const zoom = { z: 0, v: 0, target: 0, engaged: false, ax: 0, ay: 0, avx: 0, avy: 0, tx: 0, ty: 0, focus: new THREE.Vector3() };
  const spring = (x, v, to, k, dt) => { v += (k * (to - x) - 2 * Math.sqrt(k) * v) * dt; return [x + v * dt, v]; };
  function updateZoom(dt, rotating){
    const can = entered && !paused && FINE && !RM && mouse.has && mouse.type === 'mouse' && !dragging && !rotating;
    if (!can){ zoom.engaged = false; zoom.target = 0; }
    else if (!zoom.engaged && performance.now() - mouse.lastMove > 480){
      zoom.engaged = true; zoom.target = 1; zoom.tx = mouse.sx; zoom.ty = mouse.sy; audio?.zoomSwell(true);
      if (zoom.z < .03){ zoom.ax = zoom.tx; zoom.ay = zoom.ty; zoom.avx = zoom.avy = 0; }
      ray.setFromCamera({ x: mouse.x, y: mouse.y }, camera); const h = ray.intersectObjects(scene.children, true)[0]; zoom.focus.copy(h ? h.point : polar(cur, R, 2.5));
    } else if (zoom.engaged && Math.hypot(mouse.sx - zoom.tx, mouse.sy - zoom.ty) > 26){ zoom.engaged = false; zoom.target = 0; if (zoom.z > .3) audio?.zoomSwell(false); }
    [zoom.z, zoom.v] = spring(zoom.z, zoom.v, zoom.target, zoom.target > zoom.z ? 4.5 : 6.5, dt);
    [zoom.ax, zoom.avx] = spring(zoom.ax, zoom.avx, zoom.tx, 9, dt);
    [zoom.ay, zoom.avy] = spring(zoom.ay, zoom.avy, zoom.ty, 9, dt);
    return Math.min(1, Math.max(0, zoom.z));
  }

  function resize(){
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
    const hfov = w / h < 1 ? 66 : 86; const v = 2 * Math.atan(Math.tan(hfov * DEG / 2) / camera.aspect) / DEG;
    camera.fov = Math.min(Math.max(v, 48), 82); camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  applyQuality(lowQuality);

  const clock = new THREE.Clock();
  const par = { x: 0, y: 0 };
  let islandIdx = -1, running = true;
  function frame(){
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
    if (document.hidden) return;
    if (!entered) target = startIndex * SPAN - 40 + Math.sin(t * .25) * 6;
    if (entered && performance.now() - lastInput > 1100 && !dragging) target += (Math.round(target / SPAN) * SPAN - target) * Math.min(1, dt * 2.2);
    const prev = cur;
    cur += (target - cur) * Math.min(1, dt * (RM ? 12 : entered && enterT < 2.8 ? 1.6 : 4.2));
    audio?.rotationAir((cur - prev) / Math.max(dt, 1e-3));
    if (entered) enterT += dt;
    const intro = entered ? 1 - Math.min(1, enterT / 2.8) : 1, io = RM ? 0 : intro * intro * (3 - 2 * intro);
    const a = cur, portrait = camera.aspect < 1;
    audio?.setZoneWeights(islands.slice(0, N).map((_, i) => Math.pow(Math.max(0, 1 - Math.abs(mod(a - i * SPAN + 180, 360) - 180) / (SPAN * .8)), 1.4)));
    const zz = updateZoom(dt, Math.abs(target - cur) > 1.2);
    par.x += ((mouse.has && !dragging ? mouse.x : 0) * (1 - zz) - par.x) * Math.min(1, dt * 2);
    par.y += ((mouse.has && !dragging ? mouse.y : 0) * (1 - zz) - par.y) * Math.min(1, dt * 2);
    const back = portrait ? 2.6 : 1.6;
    camera.position.copy(polar(a, -back - io * 4.5, (portrait ? 2.75 : 2.6) + io * 1.4));
    if (zz > .001) camera.position.lerp(zoom.focus, .07 * zz);
    camera.lookAt(polar(a + par.x * (RM ? 0 : 3.5), R, (portrait ? 2.2 : 2.45) + par.y * (RM ? 0 : .35)));
    if (zz > .001){ const s = 1 + .3 * zz, W = innerWidth, H = innerHeight; camera.setViewOffset(W, H, zoom.ax * (1 - 1 / s), zoom.ay * (1 - 1 / s), W / s, H / s); }
    else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    sunL.position.copy(polar(a - 28, -6, 12.5)); sunL.target.position.copy(polar(a, 8, 1.2));

    const idx = mod(Math.round(a / SPAN), N);
    if (idx !== islandIdx){ islandIdx = idx; buildScene(idx); hooks.onIsland?.(idx, entered); }
    hooks.onAngle?.(mod(a, 360) / 360);

    for (const f of ticks) f(t, dt);
    if (mouse.has && !dragging && !paused) setHover(pick(mouse.x, mouse.y));
    for (const o of clickables){ const tg = o === hovered ? 1 : 0; o.userData.h += (tg - o.userData.h) * Math.min(1, dt * 10);
      const s = 1 + o.userData.h * .06, fx = o.userData.flip ?? 1; o.scale.set(o.userData.baseScale.x * s * fx, o.userData.baseScale.y * s, o.userData.baseScale.z * s); }
    updateBubble();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return {
    SPAN, count: N,
    enter(){ entered = true; enterT = 0; target = startIndex * SPAN; },
    goIsland, next(){ goIsland(mod(Math.round(target / SPAN), N) + 1); }, prev(){ goIsland(mod(Math.round(target / SPAN), N) - 1); },
    setFromSlider(v){ target = Math.floor(cur / 360) * 360 + v * 360; nudge(); },
    trigger(id){ const fn = interactions.get(id); if (fn){ fn(); return true; } return false; },
    setQuality(low){ applyQuality(low); },
    setPaused(p){ paused = p; if (p) setHover(null); },
    get islandIndex(){ return islandIdx; },
    say: (obj, html, y, ms) => sayBubble(obj, html, y, ms),
    get _debug(){ return { scene, camera, clickables }; },
  };
}

/* piezas de papel para escenas externas (shared/room/scenes-site.js) */
export { DEG, R, RINGS, FLOOR_R, WALL_H, RM, scene, rand, ticks, clickables, polar, place, paperTex, mat, mesh, shapeFrom, scallop, star, ellipse, rrect, heart, leaf,
  ext, flat, at, wallR, FONT, textCanvas, canvasTex, draw, curvedPlane, note, wallNote, cutText, wallColorAt, topOf, midR, sign, wallSign, sunflower, tulip, tuft, bush, rock, coral,
  sticker, bunting, triFlag, heartFlag, interactive, bounce, register, A_, say, charAsset, VOWELS, VOWEL_W, HOOKS };
