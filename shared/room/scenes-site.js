/* Escenas de papel para las páginas del sitio (Inicio, Hogar, Sala de docentes, Instituciones).
   Cada escena recibe (c, zona, { span }) y toma textos y objetos de data/pages/*.json.
   Interacciones: decorativa (sin efecto educativo), narrativa, educativa y experiencia (lleva a la tarjeta o a otra página). */
import {
  THREE, RoundedBoxGeometry, DEG, R, RM, scene, rand, ticks, polar, place, paperTex, mat, mesh, shapeFrom, scallop, star, ellipse, rrect, heart, leaf,
  ext, flat, wallR, FONT, draw, note, wallNote, cutText, wallColorAt, topOf, midR, sign, wallSign, sunflower, tulip, tuft, bush, rock, bunting, triFlag, heartFlag,
  sticker, bounce, register, A_, say, charAsset, VOWELS, VOWEL_W, HOOKS,
} from './world.js';

/* ---------- utilidades comunes ---------- */
const wrap = (text, n = 22) => { const out = []; let line = ''; for (const w of String(text).split(/\s+/)){ if ((line + ' ' + w).trim().length > n && line){ out.push(line); line = w; } else line = (line + ' ' + w).trim(); } if (line) out.push(line); return out; };
const H = (z) => (HOOKS || {});
function header(c, z, { y = 5.05, off = 0 } = {}){
  if (!z.sign) return;
  const s = wallSign(z.sign.title, z.sign.sub, c + off, y);
  register(null, 'experiencia', s, z.card?.title || z.sign.title, () => H().onSign?.(z.id));
}
function notes(c, z, half){
  (z.notes || []).forEach((lines, i, arr) => {
    const side = arr.length === 1 ? 1 : (i % 2 ? 1 : -1), k = Math.floor(i / 2);
    wallNote(lines, c + side * (half * .72 - k * 2), 3.3 - k * 1.3 + (i % 2) * .15, { lineH: .33, tilt: (rand() - .5) * .07, weight: 500 });
  });
}
function plants(c, half, colors = ['#86a85f', '#94b46c']){
  place(tuft(colors[0], .6), c - half * .9, midR(0), topOf(0));
  place(bush(1.1, colors[1]), c + half * .92, midR(0) + .2, topOf(0));
  place(tuft(colors[0], .5), c + half * .55, midR(2), topOf(2));
}
function plainTable(w = 2.2, d = .9, h = .75, top = '#e2b77f', leg = '#c89a63'){
  const g = new THREE.Group();
  const t = mesh(new RoundedBoxGeometry(w, .09, d, 3, .03), mat(top)); t.position.y = h; g.add(t);
  for (const [x, zz] of [[-w / 2 + .12, -d / 2 + .12], [w / 2 - .12, -d / 2 + .12], [-w / 2 + .12, d / 2 - .12], [w / 2 - .12, d / 2 - .12]]){ const l = mesh(new THREE.CylinderGeometry(.04, .04, h, 8), mat(leg)); l.position.set(x, h / 2, zz); g.add(l); }
  g.userData.top = h + .045; return g;
}
function letterBlock(ch, color, scale = 1){
  const g = new THREE.Group(); if (!VOWELS[ch]) return g;
  const l = ext(VOWELS[ch], .18, color, { bevel: .045, rep: 1.4 }); l.scale.set(scale, scale, 1); l.position.set(-VOWEL_W[ch] * scale / 2, 0, 0); g.add(l); return g;
}
const VCOL = ['#ee8a6e', '#f2c84b', '#94c06d', '#82bde6', '#b597da'];

/* ================= INICIO ================= */
async function bienvenida(c, z, { span }){
  const half = span / 2, aud = A_();
  header(c, z, { y: 5.15, off: -half * .15 });
  const sun = new THREE.Group(); sun.add(ext(star(12, .78, .56), .05, '#f6c445', { bevel: .02 }));
  const sd = ext(ellipse(.48, .48), .07, '#f9d76a', { bevel: .03 }); sd.position.z = .06; sun.add(sd);
  place(sun, c + half * .7, R - .2, 5.2); ticks.push(t => sun.rotation.z = RM ? 0 : t * .08);
  register(null, 'decorativa', sun, 'Toca el sol', () => aud.pop());
  for (const [a, y, s] of [[c - half * .78, 5.3, 1], [c + half * .25, 5.65, .7]]){ const cl = ext(scallop(.5, 5, .22, 1.6, .7), .05, '#fffaf0', { bevel: .02 }); cl.scale.setScalar(s); place(cl, a, R - .2, y); ticks.push(t => { if (!RM) cl.position.y = y + Math.sin(t * .6 + a) * .06; }); }
  notes(c, z, half);
  const url = charAsset('kikino');
  if (url){ const k = await sticker(url, 2.9); place(k, c, midR(1), topOf(1) - .02);
    register(null, 'narrativa', k, 'Saluda a Kikino', () => { bounce(k, .5, .7); aud.tone(523, .14); aud.tone(784, .2, 'triangle', .12, .1); say(k, z.greeting || '¡Hola!', 2.6); });
    ticks.push(t => { if (!RM) k.rotation.z = Math.sin(t * 1.6) * .03; }); H().registerGuide?.(k); }
  [[c - half * .5, 1, 1], [c + half * .45, 1, .9], [c - half * .2, 2, .8], [c + half * .78, 0, 1.1]].forEach(([a, r, h]) => { const f = sunflower(h); place(f, a, midR(r), topOf(r));
    register(null, 'decorativa', f, 'Gira el girasol', () => { f.userData.spin = 1.4; aud.tone(659, .18); });
    ticks.push((t, dt) => { const s = f.userData.spin || 0; f.userData.head.rotation.z += s * dt * 9; f.userData.spin = Math.max(0, s - dt); }); });
  [[c + half * .2, 2, '#ef8a76'], [c - half * .7, 2, '#f2a3b3']].forEach(([a, r, col]) => place(tulip(.7, col), a, midR(r), topOf(r)));
  plants(c, half);
}

const DOOR_ICON = {
  recreo: (g) => { const s = ext(star(5, .28, .13), .04, '#f2c84b', { bevel: .015 }); s.position.set(0, 1.15, .1); g.add(s); },
  casa: (g) => { const b = ext(rrect(.5, .36, .04), .04, '#f6ead4', { bevel: .01 }); b.position.set(0, 1.0, .1); g.add(b); const r = ext(shapeFrom([[-.34, 0], [.34, 0], [0, .28]]), .04, '#c9574a', { bevel: .01 }); r.position.set(0, 1.18, .11); g.add(r); },
  pizarron: (g) => { const b = ext(rrect(.62, .42, .04), .04, '#2f4f41', { bevel: .01 }); b.position.set(0, 1.12, .1); g.add(b); const f = ext(rrect(.7, .5, .05), .02, '#b07d4f', { bevel: 0 }); f.position.set(0, 1.12, .08); g.add(f); },
  edificio: (g) => { const b = ext(rrect(.56, .4, .02), .04, '#f3e9d6', { bevel: .01 }); b.position.set(0, 1.02, .1); g.add(b); const r = ext(shapeFrom([[-.36, 0], [.36, 0], [0, .2]]), .04, '#8f9fb0', { bevel: .01 }); r.position.set(0, 1.22, .11); g.add(r);
    for (const x of [-.18, 0, .18]){ const col = mesh(new THREE.BoxGeometry(.06, .34, .03), mat('#c9bba2')); col.position.set(x, 1.0, .14); g.add(col); } },
};
async function portales(c, z, { span }){
  const half = span / 2, aud = A_();
  header(c, z, { y: 5.25 });
  const ps = z.portals || [], n = ps.length;
  ps.forEach((p, i) => {
    const g = new THREE.Group();
    const arch = new THREE.Shape(); arch.moveTo(-.62, 0); arch.lineTo(-.62, 1.25); arch.absarc(0, 1.25, .62, Math.PI, 0, true); arch.lineTo(.62, 0); arch.lineTo(-.62, 0);
    g.add(ext(arch, .14, p.color, { bevel: .03 }));
    const door = new THREE.Shape(); door.moveTo(-.46, 0); door.lineTo(-.46, 1.22); door.absarc(0, 1.22, .46, Math.PI, 0, true); door.lineTo(.46, 0); door.lineTo(-.46, 0);
    const dm = ext(door, .05, p.door || '#fbf5e8', { bevel: .015 }); dm.position.z = .08; g.add(dm);
    DOOR_ICON[p.icon]?.(g);
    const knob = mesh(new THREE.SphereGeometry(.05, 10, 8), mat('#f2c84b')); knob.position.set(.3, .6, .14); g.add(knob);
    const lab = sign(p.label, '#fbf5e8', 1.7, .42); lab.position.set(0, 2.2, .06); g.add(lab);
    const a = c + (i - (n - 1) / 2) * (span * .78 / Math.max(1, n - 1 || 1)) * (n > 1 ? 1 : 0);
    place(g, a, i % 2 ? midR(1) : midR(0) - .1, i % 2 ? topOf(1) : topOf(0));
    register('portal-' + i, 'experiencia', g, 'Ir a ' + p.label, () => { bounce(g, .12, .3); aud.swish(.5, .07, 400, 2200); H().onPortal?.(p.href); });
  });
  plants(c, half, ['#86a85f', '#b6c98f']);
  bunting(c - half * .9, c + half * .9, 6.0, .3, ['#f2c84b', '#ee8a6e', '#94c06d', '#82bde6', '#b597da'], R - .14, triFlag);
}

const ITEM_ART = {
  libro: (g) => { const l = ext(rrect(.42, .3, .03), .02, '#fffaf0', { bevel: .01 }); l.rotation.y = .3; l.position.set(-.22, .2, 0); g.add(l);
    const r = ext(rrect(.42, .3, .03), .02, '#fff3dc', { bevel: .01 }); r.rotation.y = -.3; r.position.set(.22, .2, 0); g.add(r);
    const cv = ext(rrect(.95, .34, .03), .02, '#e8735a', { bevel: .01 }); cv.position.set(0, .18, -.05); g.add(cv); },
  musica: (g) => { const s = mesh(new THREE.CylinderGeometry(.24, .24, .28, 22), mat('#e9564a')); s.position.y = .14; g.add(s); const k = mesh(new THREE.CylinderGeometry(.25, .25, .03, 22), mat('#fbf5e8', 1)); k.position.y = .29; g.add(k); },
  mar: (g) => { const w = ext(scallop(.4, 5, .12, 1.3, .7), .04, '#4f75c4', { bevel: .015 }); g.add(w); const b = ext(rrect(.1, .26, .04), .08, '#a8d0e6', { bevel: .02 }); b.position.set(.1, .2, .05); b.rotation.z = .5; g.add(b); },
  tarjetas: (g) => { ['A', 'E', 'O'].forEach((ch, i) => { const cd = ext(rrect(.3, .42, .04), .02, '#fffaf0', { bevel: .01 }); cd.position.set((i - 1) * .2, .24, i * .02); cd.rotation.z = (i - 1) * -.2; g.add(cd);
    const l = letterBlock(ch, VCOL[i * 2 % 5], .26); l.position.set((i - 1) * .2, .14, .05 + i * .02); l.rotation.z = (i - 1) * -.2; g.add(l); }); },
  video: (g) => { const tv = ext(rrect(.7, .48, .1), .12, '#e9564a', { bevel: .03 }); tv.position.y = .3; g.add(tv); const pl = ext(shapeFrom([[-.08, -.1], [-.08, .1], [.12, 0]]), .03, '#fbf5e8', { bevel: .01 }); pl.position.set(0, .3, .09); g.add(pl); },
  vocales: (g) => { const l = letterBlock('A', '#ee8a6e', .62); l.position.y = .05; g.add(l); },
};
async function biblioteca(c, z, { span }){
  const half = span / 2, aud = A_();
  header(c, z, { y: 5.3 });
  // librero grande en la pared
  for (const s of [-1, 1]){
    const sh = new THREE.Group(); const fr = mesh(new RoundedBoxGeometry(2.2, 2.6, .45, 2, .04), mat('#c89a63')); fr.position.y = 1.3; sh.add(fr);
    const inner = mesh(new THREE.BoxGeometry(2.0, .7, .38), mat('#8b6644'));
    for (const y of [.5, 1.3, 2.1]){ const ii = inner.clone(); ii.position.set(0, y, .06); sh.add(ii);
      let x = -.92; let k = 0; while (x < .8){ const bw = .09 + rand() * .08, bh = .42 + rand() * .2, bk = mesh(new THREE.BoxGeometry(bw, bh, .28), mat(['#e9564a', '#4b8fd6', '#f2c84b', '#6fbf73', '#b597da', '#ee8a6e'][(k++ + Math.round(y * 3)) % 6]));
        bk.position.set(x + bw / 2, y - .32 + bh / 2, .22); if (rand() < .12) bk.rotation.z = .2; sh.add(bk); x += bw + .02; } }
    place(sh, c + s * half * .62, midR(0) - .1, topOf(0));
  }
  // mesa de descubrimiento con un objeto por recurso
  const items = z.items || [];
  items.forEach((it, i) => {
    const g = new THREE.Group(); (ITEM_ART[it.art] || ITEM_ART.libro)(g);
    const a = c + (i - (items.length - 1) / 2) * (span * .6 / Math.max(1, items.length - 1));
    const r = midR(1) - .15;
    const ped = mesh(new THREE.CylinderGeometry(.42, .48, .32, 24), mat(['#fbf5e8', '#f3e3c3'][i % 2])); ped.position.y = .16;
    const holder = new THREE.Group(); holder.add(ped); g.position.y = .34; holder.add(g);
    place(holder, a, r, topOf(1));
    register('item-' + it.id, 'experiencia', holder, it.title, () => { bounce(holder, .25, .45); aud.pop(); H().onItem?.(it.id); });
    ticks.push(t => { if (!RM) g.rotation.y = Math.sin(t * .7 + i) * .25; });
  });
  plants(c, half);
}

async function escenario(c, z, { span }){
  const half = span / 2, aud = A_();
  header(c, z, { y: 5.35 });
  // telón en la pared
  for (const s of [-1, 1]){ const cu = ext(shapeFrom([[0, 2.6], [1.3 * s, 2.6], [.9 * s, 1.2], [1.2 * s, 0], [0, 0]]), .05, '#c9574a', { bevel: .02 }); place(cu, c + s * half * .78, R - .3, 1.5); }
  const val = ext(scallop(1.4, 12, .08, 3.2, .25), .05, '#a8433a', { bevel: .02 }); place(val, c, R - .25, 4.2);
  const stage = mesh(new RoundedBoxGeometry(7.5, .3, 1.8, 3, .08), mat('#b5884f')); place(stage, c, midR(1) - .2, topOf(1));
  const cast = z.cast || [];
  for (let i = 0; i < cast.length; i++){
    const ch = cast[i], url = charAsset(ch.id) || charAsset(ch.id, 'cutout');
    if (!url) continue;
    const k = await sticker(url, ch.id === 'tuti' ? 1.4 : 2.0);
    const a = c + (i - (cast.length - 1) / 2) * span * .26;
    place(k, a, midR(1) - .2, topOf(1) + .3);
    register('char-' + ch.id, 'narrativa', k, ch.name, () => { bounce(k, .4, .6); aud.tone(523 + i * 120, .16); say(k, `<b>${ch.name}</b>`, ch.id === 'tuti' ? 1.7 : 2.4); H().onChar?.(ch.id); });
    ticks.push(t => { if (!RM) k.rotation.z = Math.sin(t * 1.3 + i) * .03; });
  }
  bunting(c - half * .8, c + half * .8, 5.9, .25, ['#f2c84b', '#82bde6', '#b597da', '#ee8a6e'], R - .14, triFlag);
}

async function buzon(c, z, { span }){
  const half = span / 2, aud = A_();
  header(c, z, { y: 5.25 });
  notes(c, z, half);
  const tb = plainTable(2.4, 1.0, .8, '#d9bf98', '#b5884f'); place(tb, c - half * .18, 6.6, 0, 8);
  const env = (col, rot) => { const g = new THREE.Group(); g.add(ext(rrect(.6, .4, .03), .02, col, { bevel: .01 })); const fl = ext(shapeFrom([[-.3, .2], [.3, .2], [0, -.02]]), .01, '#e8dcc4', { bevel: 0 }); fl.position.z = .02; g.add(fl); g.rotation.set(-Math.PI / 2, 0, rot); return g; };
  [['#fffaf0', .2], ['#fbe3c6', -.3], ['#dfe3f6', .6]].forEach(([col, r], i) => { const e = env(col, r); e.position.set(-.6 + i * .5, tb.userData.top + .02 + i * .01, (i - 1) * .12); tb.add(e); });
  const pen = mesh(new THREE.CylinderGeometry(.025, .025, .5, 8), mat('#4b8fd6')); pen.rotation.z = Math.PI / 2; pen.rotation.y = .4; pen.position.set(.7, tb.userData.top + .03, .1); tb.add(pen);
  // buzón
  const mb = new THREE.Group();
  const post = mesh(new THREE.CylinderGeometry(.06, .06, 1.1, 10), mat('#8c6a4e')); post.position.y = .55; mb.add(post);
  const box = new THREE.Shape(); box.moveTo(-.35, 0); box.lineTo(-.35, .35); box.absarc(0, .35, .35, Math.PI, 0, true); box.lineTo(.35, 0); box.lineTo(-.35, 0);
  const bx = ext(box, .9, '#4b8fd6', { bevel: .03 }); bx.rotation.y = Math.PI / 2; bx.position.set(0, 1.1, 0); mb.add(bx);
  const flagG = new THREE.Group(); const fp = mesh(new THREE.BoxGeometry(.03, .5, .03), mat('#8c6a4e')); fp.position.y = .25; flagG.add(fp);
  const fl = ext(rrect(.26, .16, .02), .02, '#e9564a', { bevel: 0 }); fl.position.set(.13, .44, 0); flagG.add(fl); flagG.position.set(.47, 1.2, .1); mb.add(flagG);
  place(mb, c + half * .4, midR(2), topOf(2), -20);
  register('buzon', 'experiencia', mb, 'Escribir un mensaje', () => { flagG.userData.up = 1; aud.swish(.4, .06, 800, 2600); H().onSign?.(z.id); });
  ticks.push((t, dt) => { const u = flagG.userData.up || 0; flagG.rotation.z = -u * 1.4; flagG.userData.up = Math.max(0, u - dt * .4); });
  plants(c, half, ['#86a85f', '#c2a57f']);
}

/* ================= HOGAR ================= */
async function sala(c, z, { span }){
  const half = span / 2, aud = A_();
  header(c, z, { y: 5.2, off: -half * .1 });
  notes(c, z, half);
  const house = new THREE.Group();
  const body = ext(rrect(1.9, 1.3, .06), .5, '#f6ead4', { bevel: .03 }); body.position.y = .65; house.add(body);
  const roof = ext(shapeFrom([[-1.18, 0], [1.18, 0], [0, .95]]), .62, '#c9574a', { bevel: .04 }); roof.position.y = 1.32; house.add(roof);
  const door = ext(rrect(.42, .72, .1), .04, '#8c6a4e', { bevel: .015 }); door.position.set(-.35, .38, .27); house.add(door);
  const winM = new THREE.MeshStandardMaterial({ color: '#f7d978', emissive: '#f5c04a', emissiveIntensity: 0, roughness: .9 });
  const win = ext(rrect(.48, .42, .05), .04, '#f7d978', { bevel: .015 }); win.material = winM; win.position.set(.42, .82, .27); house.add(win);
  place(house, c - half * .3, midR(0) + .05, topOf(0));
  register(null, 'decorativa', house, 'Encender la casa', () => { const on = winM.emissiveIntensity < .5; winM.emissiveIntensity = on ? 1.1 : 0; aud.tone(on ? 660 : 440, .2); });
  bunting(c - half * .5, c + half * .9, 5.85, .35, ['#f6e3d6', '#f2b2a3', '#fbd77a'], R - .14, heartFlag);
  const sofa = new THREE.Group(); const sc = '#5f9f9a';
  const seat = mesh(new RoundedBoxGeometry(2.3, .42, .9, 4, .12), mat(sc)); seat.position.y = .32; sofa.add(seat);
  const back = mesh(new RoundedBoxGeometry(2.3, .8, .28, 4, .12), mat(sc)); back.position.set(0, .7, -.36); sofa.add(back);
  for (const x of [-1.15, 1.15]){ const arm = mesh(new RoundedBoxGeometry(.3, .62, .92, 4, .12), mat('#56908b')); arm.position.set(x, .45, 0); sofa.add(arm); }
  for (const x of [-.52, .52]){ const cu = mesh(new RoundedBoxGeometry(1, .16, .7, 4, .07), mat('#77b5ae')); cu.position.set(x, .6, .06); sofa.add(cu); }
  place(sofa, c + half * .25, midR(1) - .15, topOf(1));
  const lamp = new THREE.Group();
  const lp = mesh(new THREE.CylinderGeometry(.025, .025, 1.6, 8), mat('#7a5b3e')); lp.position.y = .82; lamp.add(lp);
  const shadeM = new THREE.MeshStandardMaterial({ color: '#f2c84b', map: paperTex(.6), emissive: '#f7c04a', emissiveIntensity: 0, roughness: .9, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(.22, .42, .48, 24, 1, true), shadeM); shade.position.y = 1.7; shade.castShadow = true; lamp.add(shade);
  const bulb = new THREE.PointLight('#ffc477', 0, 6, 1.6); bulb.position.y = 1.55; lamp.add(bulb);
  place(lamp, c + half * .62, midR(1) - .1, topOf(1));
  register(null, 'decorativa', lamp, 'Prender la lámpara', () => { const on = bulb.intensity === 0; bulb.intensity = on ? 9 : 0; shadeM.emissiveIntensity = on ? .9 : 0; aud.tone(on ? 784 : 392, .15, 'square', .05); });
  const rugTex = draw(512, 512, (g, w) => { ['#e9a07a', '#f6e3c8', '#7fb7c8', '#f6e3c8', '#f2c84b', '#f6e3c8'].forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - i * 40, 0, 7); g.fill(); }); });
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, .03, 48), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 })); rug.receiveShadow = true; rug.scale.z = .75; place(rug, c, 4.8, .015);
  place(tuft('#86a85f', .5), c + half * .9, midR(2), topOf(2));
}

async function lectura(c, z, { span }){
  const half = span / 2, aud = A_();
  header(c, z, { y: 5.2 });
  notes(c, z, half);
  const big = new THREE.Group();
  for (const s of [-1, 1]){ const pg = ext(rrect(1.3, 1.0, .08), .05, '#fffaf0', { bevel: .02 }); pg.rotation.order = 'YXZ'; pg.rotation.x = -Math.PI / 2 + .14; pg.rotation.y = -s * .1; pg.position.set(s * .67, .12, 0); big.add(pg); }
  const cv = ext(rrect(2.8, 1.1, .1), .04, '#4b8fd6', { bevel: .02 }); cv.rotation.x = -Math.PI / 2; cv.position.y = .03; big.add(cv);
  const lines = draw(256, 192, (g, w) => { g.fillStyle = '#fffaf0'; g.fillRect(0, 0, w, 192); g.strokeStyle = '#d8c7aa'; g.lineWidth = 6; g.lineCap = 'round'; for (let i = 0; i < 6; i++){ g.beginPath(); g.moveTo(24, 30 + i * 26); g.lineTo(w - 24 - (i % 3) * 30, 30 + i * 26); g.stroke(); } });
  for (const s of [-1, 1]){ const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.15, .86), new THREE.MeshStandardMaterial({ map: lines, roughness: 1 })); pl.rotation.order = 'YXZ'; pl.rotation.x = -Math.PI / 2 + .14; pl.rotation.y = -s * .1; pl.position.set(s * .67, .155, .01); pl.receiveShadow = true; big.add(pl); }
  place(big, c - half * .15, 6.5, 0, 4);
  register(null, 'decorativa', big, 'Hojear el libro', () => { bounce(big, .1, .3); aud.swish(.3, .05, 1200, 3000); });
  for (const [x, col] of [[-1, '#f2a3b3'], [1, '#f2c84b']]){ const cush = mesh(new RoundedBoxGeometry(.9, .3, .9, 4, .14), mat(col)); place(cush, c + x * half * .35, 6.2, .15, x * 20); }
  const shelf = new THREE.Group(); const sf = mesh(new RoundedBoxGeometry(1.6, 1.6, .5, 2, .03), mat('#c89a63')); sf.position.y = .8; shelf.add(sf);
  for (const y of [.15, .88]){ let x = -.62, k = 0; while (x < .55){ const bw = .08 + rand() * .07, bh = .4 + rand() * .18; const bk = mesh(new THREE.BoxGeometry(bw, bh, .3), mat(['#e9564a', '#4b8fd6', '#f2c84b', '#6fbf73', '#b597da'][(k++ + (y > .5 ? 2 : 0)) % 5])); bk.position.set(x + bw / 2, y + bh / 2, .26); shelf.add(bk); x += bw + .015; } }
  place(shelf, c + half * .62, midR(0) - .05, topOf(0));
  const url = charAsset('kikino'); if (url){ const k = await sticker(url, 1.7); place(k, c + half * .2, midR(1), topOf(1) - .02);
    register(null, 'narrativa', k, 'Kikino lee contigo', () => { bounce(k, .4, .6); aud.tone(587, .15); say(k, z.greeting || '¡Leamos juntos!', 2.0); }); }
  plants(c, half);
}

async function vocalesCasa(c, z, { span }){
  const half = span / 2, aud = A_();
  header(c, z, { y: 5.2 });
  notes(c, z, half);
  const tb = plainTable(3.2, 1.1, .72); place(tb, c, midR(2) + .1, topOf(2));
  ['A', 'E', 'I', 'O', 'U'].forEach((ch, i) => {
    const l = letterBlock(ch, VCOL[i], .62); l.position.set(-1.2 + i * .6, tb.userData.top, 0); tb.add(l);
    register('vocal-' + ch.toLowerCase(), 'educativa', l, 'Vocal ' + ch, () => { bounce(l, .3, .5); aud.speak(ch.toLowerCase()); aud.keyNote([72, 74, 76, 77, 79][i], .25); say(l, `<b>${ch}</b>`, 1.0, 1400); });
  });
  // cuadro con Tuti (ruta de vocales)
  const url = charAsset('tuti', 'cutout');
  const fr = new THREE.Group(); fr.add(ext(rrect(1.9, 1.4, .06), .07, '#f2c84b', { bevel: .02 }));
  const bgp = ext(rrect(1.7, 1.2, .05), .02, '#bfe0f2', { bevel: 0 }); bgp.position.z = .05; fr.add(bgp);
  place(fr, c + half * .6, R - .2, 3.3);
  if (url){ const tt = await sticker(url, .95); tt.position.set(-.68, -.45, .08); tt.scale.x = -1; fr.add(tt); }
  register(null, 'narrativa', fr, 'Tuti', () => { aud.tone(587, .14, 'sine', .12); say(fr, z.greeting || '¡Vocales por la casa!', 1.0); });
  for (let i = 0; i < 4; i++){ const cr = mesh(new THREE.CylinderGeometry(.025, .025, .3, 8), mat(['#e9564a', '#4b8fd6', '#f2c84b', '#6fbf73'][i])); cr.rotation.z = Math.PI / 2; cr.rotation.y = i * .3; cr.position.set(1.25, tb.userData.top + .03, -.3 + i * .12); tb.add(cr); }
  const paper = mesh(new THREE.BoxGeometry(.6, .01, .44), mat('#ffffff', 1)); paper.position.set(1.2, tb.userData.top + .005, .1); paper.rotation.y = .2; tb.add(paper);
  plants(c, half);
}

async function musica(c, z, { span }){
  const half = span / 2, aud = A_();
  header(c, z, { y: 5.25 });
  notes(c, z, half);
  const drum = new THREE.Group();
  const shell = mesh(new THREE.CylinderGeometry(.45, .45, .5, 28), mat('#e9564a')); shell.position.y = .25; drum.add(shell);
  const skin = mesh(new THREE.CylinderGeometry(.47, .47, .04, 28), mat('#fbf5e8', 1)); skin.position.y = .52; drum.add(skin);
  place(drum, c - half * .45, midR(1) - .2, topOf(1));
  register(null, 'decorativa', drum, 'Toca el tambor', () => { bounce(drum, .08, .25); aud.tone(110, .35, 'sine', .3); aud.tone(70, .4, 'sine', .25); });
  const xylo = new THREE.Group(); const xb = mesh(new RoundedBoxGeometry(1.6, .12, .7, 2, .03), mat('#b5884f')); xb.position.y = .06; xylo.add(xb);
  ['#e9564a', '#f2a540', '#f2c84b', '#6fbf73', '#4b8fd6', '#9b7ad1'].forEach((col, i) => { const bar = mesh(new RoundedBoxGeometry(.2, .06, .62 - i * .06, 2, .02), mat(col)); bar.position.set(-.6 + i * .24, .16, 0); xylo.add(bar);
    register(null, 'decorativa', bar, 'Toca el xilófono', () => { aud.keyNote([72, 74, 76, 79, 81, 84][i], .3); bar.userData.press = .1; });
    ticks.push((t, dt) => { const p = bar.userData.press || 0; bar.position.y = .16 - p * .3; bar.userData.press = Math.max(0, p - dt * .5); }); });
  place(xylo, c, midR(2), topOf(2), -6);
  const mar = (x, col) => { const g = new THREE.Group(); const hd = mesh(new THREE.SphereGeometry(.16, 18, 14), mat(col)); hd.position.y = .5; g.add(hd); const st = mesh(new THREE.CylinderGeometry(.035, .03, .4, 8), mat('#8c6a4e')); st.position.y = .2; g.add(st); g.rotation.z = x * .3; return g; };
  const m1 = mar(-1, '#f2c84b'), m2 = mar(1, '#94c06d'); place(m1, c + half * .45, midR(2), topOf(2)); place(m2, c + half * .52, midR(2), topOf(2));
  [m1, m2].forEach((m, i) => register(null, 'decorativa', m, 'Agita las maracas', () => { m.userData.shake = 1; aud.swish(.15, .08, 3000, 5000); setTimeout(() => aud.swish(.12, .06, 3500, 5500), 140); }));
  ticks.push((t, dt) => [m1, m2].forEach((m, i) => { const s = m.userData.shake || 0; m.rotation.x = Math.sin(t * 30) * .3 * s; m.userData.shake = Math.max(0, s - dt * 1.5); }));
  bunting(c - half * .9, c + half * .9, 5.95, .3, ['#f2c84b', '#ee8a6e', '#94c06d', '#82bde6'], R - .14, triFlag);
}

async function marLimpio(c, z, { span }){
  const half = span / 2, aud = A_();
  header(c, z, { y: 5.2 });
  notes(c, z, half);
  const pool = flat(ext(scallop(1.5, 6, .1, 1.5, .9), .03, '#4f75c4', { bevel: .015 })); pool.castShadow = false; place(pool, c + half * .3, 6.3, .03);
  const bin = new THREE.Group(); const bb = mesh(new THREE.CylinderGeometry(.32, .26, .7, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#5f9f6a', map: paperTex(.6), side: THREE.DoubleSide, roughness: .9 })); bb.position.y = .35; bb.castShadow = true; bin.add(bb);
  place(bin, c + half * .78, midR(2), topOf(2));
  const trash = [];
  for (let i = 0; i < 4; i++){
    const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
    if (i % 2){ inner.add(ext(rrect(.14, .34, .05), .12, '#a8d0e6', { bevel: .03 })); } else { inner.add(mesh(new THREE.CylinderGeometry(.09, .09, .24, 16), mat('#d9d4cc'))); }
    inner.rotation.z = 1.3; const home = polar(c + half * .3 - 6 + i * 4, 6.0 + (i % 2) * .5, .1); g.position.copy(home); scene.add(g); g.userData.home = home.clone(); g.userData.fly = 0; trash.push(g);
    register(null, 'narrativa', g, 'Recoge la basura', () => { if (g.userData.fly) return; g.userData.fly = .001; aud.swish(.35, .06, 600, 2200); setTimeout(() => aud.pop(), 380);
      if (trash.every(o => o.userData.fly)) setTimeout(() => say(bin, z.greeting || '¡Listo!', 1.2), 500); });
    ticks.push((t, dt) => { if (!g.userData.fly){ g.visible = true; inner.scale.setScalar(1); g.position.copy(g.userData.home); g.position.y = .1 + Math.sin(t * 1.6 + i) * .03; return; }
      g.userData.fly += dt * .9; const k = Math.min(1, g.userData.fly);
      if (k < 1){ const to = bin.position.clone().setY(bin.position.y + .75); g.position.lerpVectors(g.userData.home, to, k); g.position.y += Math.sin(k * Math.PI) * 1.4; inner.scale.setScalar(1 - k * .6); } else g.visible = false;
      if (g.userData.fly > 6) g.userData.fly = 0; });
  }
  for (let i = 0; i < 3; i++){ const f = new THREE.Group(), col = ['#f29a4a', '#f6d257', '#8fc0e8'][i]; f.add(ext(ellipse(.16, .09), .04, col, { bevel: .015 })); scene.add(f);
    ticks.push(t => { const ph = t * (.3 + i * .05) + i * 2, a = c + half * .3 + Math.sin(ph) * 10, r = 5.8 + i * .35; f.position.copy(polar(a, r, .09)); f.rotation.y = -a * DEG + (Math.cos(ph) > 0 ? 0 : Math.PI); }); }
  place(rock(.45), c - half * .7, 6.4, 0); place(rock(.35, '#b6b0a6'), c + half * .2, 6.9, 0);
  plants(c, half, ['#7fa253', '#94b46c']);
}

/* ================= SALA DE DOCENTES ================= */
function chalkboard(lines, w = 4.3, h = 2.5){
  const tex = draw(1024, Math.round(1024 * h / w), (g, W, Hh) => { g.fillStyle = '#2f4f41'; g.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 40; i++){ g.fillStyle = `rgba(255,255,255,${.015 + rand() * .03})`; g.beginPath(); g.ellipse(rand() * W, rand() * Hh, 40 + rand() * 120, 10 + rand() * 30, rand() * 3, 0, 7); g.fill(); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => { g.fillStyle = i ? '#f6d98a' : '#f4f1e6'; g.font = `${i ? 500 : 600} ${i ? 60 : 112}px ${FONT}`; g.fillText(l, W / 2, Hh * (lines.length === 1 ? .5 : i ? .74 : .4)); }); });
  const b = new THREE.Group(); b.add(ext(rrect(w, h, .08), .1, '#b07d4f', { bevel: .03 }));
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w - .3, h - .3), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })); p.position.z = .09; p.receiveShadow = true; b.add(p);
  return b;
}
function smallDesk(){ const g = new THREE.Group(); const t = mesh(new RoundedBoxGeometry(1.1, .07, .7, 2, .02), mat('#e2b77f')); t.position.y = .62; g.add(t);
  for (const [x, zz] of [[-.48, -.28], [.48, -.28], [-.48, .28], [.48, .28]]){ const l = mesh(new THREE.CylinderGeometry(.03, .03, .6, 8), mat('#8b9bd4')); l.position.set(x, .3, zz); g.add(l); }
  const ch = mesh(new RoundedBoxGeometry(.5, .06, .45, 2, .02), mat('#82bde6')); ch.position.set(0, .38, .55); g.add(ch); const bk = mesh(new RoundedBoxGeometry(.5, .4, .06, 2, .02), mat('#82bde6')); bk.position.set(0, .6, .78); g.add(bk); return g; }

async function aula(c, z, { span }){
  const half = span / 2, aud = A_();
  header(c, z, { y: 5.3, off: half * .45 });
  const board = chalkboard(z.chalk || ['a e i o u']); place(board, c - half * .2, wallR(2.3, .14), 3.4);
  register(null, 'decorativa', board, 'Pizarrón', () => aud.tone(1200, .06, 'square', .03));
  bunting(c - half * .95, c + half * .95, 5.95, .3, ['#f2c84b', '#ee8a6e', '#94c06d', '#82bde6', '#b597da'], R - .14, triFlag);
  // reloj con la hora real
  const clock = new THREE.Group(); clock.add(ext(ellipse(.5, .5), .08, '#e8735a', { bevel: .03 }));
  const face = ext(ellipse(.42, .42), .04, '#fbf6ea', { bevel: .01 }); face.position.z = .06; clock.add(face);
  const hand = (len, w) => { const p = new THREE.Group(); const h = mesh(new THREE.BoxGeometry(w, len, .02), mat('#3b2a1f')); h.position.y = len / 2 - .04; p.add(h); p.position.z = .12; clock.add(p); return p; };
  const hh = hand(.22, .045), mh = hand(.32, .03); place(clock, c + half * .7, R - .16, 3.6);
  ticks.push(() => { const d = new Date(), m = d.getMinutes() + d.getSeconds() / 60; mh.rotation.z = -m / 60 * Math.PI * 2; hh.rotation.z = -((d.getHours() % 12) + m / 60) / 12 * Math.PI * 2; });
  [[-.3, 5.6], [.15, 5.0], [.5, 5.8]].forEach(([k, r]) => place(smallDesk(), c + half * k, r, 0, k * 30));
  const url = charAsset('tuti', 'cutout'); if (url){ const t = await sticker(url, 1.2); place(t, c + half * .55, midR(1), topOf(1) - .02); t.userData.flip = -1;
    register(null, 'narrativa', t, 'Tuti', () => { aud.tone(587, .14, 'sine', .12); say(t, z.greeting || 'a, e, i, o, u', 1.5); }); }
  plants(c, half, ['#86a85f', '#b6c0e8']);
}

async function calendario(c, z, { span }){
  const half = span / 2, aud = A_();
  header(c, z, { y: 5.25 });
  const sess = z.sessions || ['Sesión 1', 'Sesión 2', 'Sesión 3'];
  sess.forEach((s, i) => {
    const pg = new THREE.Group(); pg.add(ext(rrect(1.6, 1.9, .08), .03, '#fffaf0', { bevel: .015 }));
    const top = ext(rrect(1.6, .4, .06), .04, ['#e8735a', '#4b8fd6', '#6fbf73'][i % 3], { bevel: .01 }); top.position.set(0, .75, .02); pg.add(top);
    const n = cutText(s.split(' · '), { lineH: .3, color: '#3b2a1f' }); n.position.set(0, -.12, -.02); pg.add(n);
    for (const x of [-.45, .45]){ const ring = mesh(new THREE.TorusGeometry(.07, .02, 8, 16), mat('#8b8b8b')); ring.position.set(x, .95, .05); pg.add(ring); }
    place(pg, c + (i - (sess.length - 1) / 2) * span * .22, wallR(.85, .14), 3.3);
    pg.rotation.order = 'YXZ'; pg.rotation.z = (i - 1) * .04;
    register(null, 'decorativa', pg, s, () => { bounce(pg, .12, .35); aud.keyNote(72 + i * 4, .22); });
  });
  const tb = plainTable(2.6, 1.0, .72); place(tb, c, midR(2) + .1, topOf(2));
  ['A', 'E', 'I'].forEach((ch, i) => { const cd = ext(rrect(.5, .7, .04), .02, '#fffaf0', { bevel: .01 }); cd.rotation.x = -Math.PI / 2; cd.rotation.z = (i - 1) * .2; cd.position.set(-.6 + i * .6, tb.userData.top + .015, 0); tb.add(cd);
    const l = letterBlock(ch, VCOL[i], .35); l.rotation.x = -Math.PI / 2; l.position.set(-.6 + i * .6, tb.userData.top + .05, .18); tb.add(l); });
  plants(c, half);
}

async function tarjetas(c, z, { span }){
  const half = span / 2, aud = A_();
  header(c, z, { y: 5.25 });
  notes(c, z, half);
  const tb = plainTable(3.6, 1.2, .72, '#d9bf98', '#b5884f'); place(tb, c, midR(2) + .1, topOf(2));
  ['A', 'E', 'I', 'O', 'U'].forEach((ch, i) => {
    const card = new THREE.Group(); card.add(ext(rrect(.55, .78, .05), .03, '#fffaf0', { bevel: .012 }));
    const l = letterBlock(ch, VCOL[i], .42); l.position.set(0, -.2, .03); card.add(l);
    card.position.set(-1.3 + i * .65, tb.userData.top + .45, 0); card.rotation.x = -.25; tb.add(card);
    register('tarjeta-' + ch.toLowerCase(), 'educativa', card, 'Tarjeta ' + ch, () => { card.userData.turn = 1; aud.speak(ch.toLowerCase()); aud.keyNote([72, 74, 76, 77, 79][i], .22); });
    ticks.push((t, dt) => { const f = card.userData.turn || 0; card.rotation.y = Math.sin(f * Math.PI) * Math.PI; card.userData.turn = Math.max(0, f - dt * 1.4); });
  });
  const cup = mesh(new THREE.CylinderGeometry(.14, .12, .3, 16), mat('#82bde6')); cup.position.set(1.55, tb.userData.top + .15, -.35); tb.add(cup);
  ['#e9564a', '#f2c84b', '#6fbf73'].forEach((col, i) => { const p = mesh(new THREE.CylinderGeometry(.02, .02, .42, 6), mat(col)); p.position.set(1.5 + i * .04, tb.userData.top + .4, -.35); p.rotation.z = (i - 1) * .2; tb.add(p); });
  plants(c, half);
}

async function pizarraPasos(c, z, { span }){
  const half = span / 2, aud = A_();
  header(c, z, { y: 5.35 });
  const steps = z.steps || [];
  const cork = new THREE.Group(); cork.add(ext(rrect(6.6, 2.9, .1), .1, '#b07d4f', { bevel: .03 }));
  const tex = draw(1600, 680, (g, W, Hh) => { g.fillStyle = '#2f4f41'; g.fillRect(0, 0, W, Hh);
    for (let k = 0; k < 40; k++){ g.fillStyle = `rgba(255,255,255,${.015 + rand() * .03})`; g.beginPath(); g.ellipse(rand() * W, rand() * Hh, 60 + rand() * 160, 14 + rand() * 40, rand() * 3, 0, 7); g.fill(); }
    g.textBaseline = 'middle'; const colW = W / steps.length;
    steps.forEach((st, k) => { const x = k * colW + 36; g.fillStyle = '#f6d98a'; g.font = `700 92px ${FONT}`; g.fillText(String(k + 1), x, 110);
      g.fillStyle = '#f4f1e6'; g.font = `500 44px ${FONT}`; wrap(st, 15).slice(0, 7).forEach((l, m) => g.fillText(l, x, 210 + m * 58)); }); });
  const bp = new THREE.Mesh(new THREE.PlaneGeometry(6.3, 2.6), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })); bp.position.z = .1; bp.receiveShadow = true; cork.add(bp);
  place(cork, c, wallR(3.4, .16), 3.25);
  register(null, 'experiencia', cork, 'Ver la ficha de sesión', () => { aud.pop(); H().onSign?.(z.id); });
  const desk = plainTable(2.2, .9, .8, '#c89a63', '#b5884f'); place(desk, c + half * .45, midR(2) + .1, topOf(2), -10);
  const apple = new THREE.Group(); const ab = mesh(new THREE.SphereGeometry(.17, 24, 16), mat('#e14b3b', 1)); ab.scale.y = .9; apple.add(ab);
  const lf = ext(leaf(.08, .16, .03), .01, '#7fa253', { bevel: .004 }); lf.position.set(.02, .2, 0); lf.rotation.z = -1; apple.add(lf);
  apple.position.set(.6, desk.userData.top + .16, .1); desk.add(apple);
  [['#4b8fd6', .1], ['#f2c84b', .1], ['#e9564a', .08]].forEach(([col, h], i) => { const b = mesh(new RoundedBoxGeometry(.55, h, .4, 2, .015), mat(col)); b.position.set(-.5, desk.userData.top + .05 + i * .1, 0); b.rotation.y = (i - 1) * .15; desk.add(b); });
  plants(c, half);
}

/* ================= COMUNES (Sala de docentes e Instituciones) ================= */
async function cajas(c, z, { span }){
  const half = span / 2, aud = A_();
  header(c, z, { y: 5.35 });
  const items = z.boxes || [];
  const per = Math.ceil(items.length / 2);
  items.forEach((it, i) => {
    const ok = it.status === 'ok', row = Math.floor(i / per), col = i % per;
    const g = new THREE.Group();
    const box = mesh(new RoundedBoxGeometry(1.5, 1.0, .9, 3, .06), mat(ok ? '#d9bf98' : '#efe4cf')); box.position.y = .5; g.add(box);
    if (!ok){ const lid = mesh(new RoundedBoxGeometry(1.55, .1, .95, 2, .03), mat('#e2d5bc')); lid.position.set(0, 1.07, -.18); lid.rotation.x = -.5; g.add(lid); }
    const ln = [ok ? '✓ Disponible' : '◔ En definición', ...wrap(it.label, 13).slice(0, 2)];
    const face = draw(512, 340, (gx, w, h) => { gx.fillStyle = ok ? '#d9bf98' : '#efe4cf'; gx.fillRect(0, 0, w, h); gx.textAlign = 'center'; gx.textBaseline = 'middle';
      gx.fillStyle = ok ? '#3e5a22' : '#7a4a0a'; gx.font = `800 46px ${FONT}`; gx.fillText(ln[0], w / 2, 70); gx.fillStyle = '#3b2a1f'; gx.font = `600 58px ${FONT}`; ln.slice(1).forEach((l, k) => gx.fillText(l, w / 2, 160 + k * 74)); });
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.36, .9), new THREE.MeshStandardMaterial({ map: face, roughness: 1 })); lab.position.set(0, .5, .456); g.add(lab);
    const a = c + (col - (per - 1) / 2) * (span * .8 / Math.max(1, per)), ring = row ? 1 : 0;
    place(g, a, row ? midR(1) - .1 : midR(0) - .2, topOf(ring));
    register(null, 'decorativa', g, it.label, () => { bounce(g, .18, .35); aud.tone(ok ? 660 : 440, .18); say(g, `${ok ? '✓' : '◔'} ${it.label}`, 1.4, 1800); });
  });
}

async function muroNotas(c, z, { span }){
  const half = span / 2, aud = A_();
  header(c, z, { y: 5.35 });
  const items = z.wall || [], n = items.length;
  const cols = ['#fffaf0', '#fbe3c6', '#dfe3f6', '#e1ebd2', '#f7d9d2'];
  items.forEach((it, i) => {
    const row = n > 3 ? i % 2 : 0;
    const a = c + (i - (n - 1) / 2) * (span * .82 / Math.max(1, n));
    const nt = wallNote(wrap(it.title, 12), a, row ? 2.35 : 3.75, { lineH: .3, tilt: (rand() - .5) * .05 });
    register(null, 'decorativa', nt, it.title, () => { bounce(nt, .08, .3); aud.swish(.2, .05, 1800, 3600); });
  });
  if (z.icon === 'candado'){
    const lock = new THREE.Group(); const body = mesh(new RoundedBoxGeometry(1.0, .8, .35, 3, .08), mat('#f2c84b')); body.position.y = .5; lock.add(body);
    const sh = mesh(new THREE.TorusGeometry(.32, .07, 10, 24, Math.PI), mat('#a7a39b')); sh.position.y = .9; lock.add(sh);
    const kh = mesh(new THREE.CylinderGeometry(.08, .08, .05, 12), mat('#3b2a1f')); kh.rotation.x = Math.PI / 2; kh.position.set(0, .5, .19); lock.add(kh);
    place(lock, c - half * .1, midR(2), topOf(2)); register(null, 'decorativa', lock, 'Privacidad', () => { bounce(lock, .2, .4); aud.tone(523, .12); });
  }
  plants(c, half, ['#9aa985', '#b9c4a6']);
}

async function camino(c, z, { span }){
  const half = span / 2, aud = A_();
  header(c, z, { y: 5.4 });
  if (z.thesis) wallNote(wrap(z.thesis, 34), c, 3.6, { lineH: .3, tape: true, weight: 600, bg: '#fffaf0' });
  const steps = z.path || [], n = steps.length;
  steps.forEach((s, i) => {
    const t = n > 1 ? i / (n - 1) : .5, a = c - half * .8 + t * half * 1.6, r = 6.2 + Math.sin(t * Math.PI * 2) * .45;
    const stone = flat(ext(scallop(.48, 6, .08), .1, ['#f2c84b', '#ee8a6e', '#94c06d', '#82bde6', '#b597da', '#e8735a'][i % 6], { bevel: .03 })); stone.rotation.x = -Math.PI / 2; place(stone, a, r, .05);
    const num = draw(128, 128, (g, w) => { g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, w, w); g.fillStyle = '#3b2a1f'; g.font = `700 80px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), w / 2, w / 2 + 4); });
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(.5, .5), new THREE.MeshStandardMaterial({ map: num, transparent: true, roughness: 1 })); nm.rotation.x = -Math.PI / 2; nm.position.copy(polar(a, r, .17)); nm.rotation.z = a * DEG; scene.add(nm);
    const lab = sign(s, '#fbf5e8', 1.8, .46); const post = mesh(new THREE.CylinderGeometry(.03, .03, 1.2, 8), mat('#8c6a4e')); post.position.y = .6; const g = new THREE.Group(); g.add(post); lab.position.y = 1.3; g.add(lab);
    place(g, a, r + .7, 0);
    register('paso-' + (i + 1), 'decorativa', g, s, () => { bounce(g, .15, .35); aud.keyNote(60 + [0, 2, 4, 5, 7, 9][i % 6], .25); });
  });
  plants(c, half, ['#9aa985', '#b9c4a6']);
}

async function propuesta(c, z, { span }){
  const half = span / 2, aud = A_();
  header(c, z, { y: 5.35, off: -half * .3 });
  const stack = new THREE.Group();
  ['#e08a2c', '#7f9a5c', '#8e9bd4'].forEach((col, i) => { const s = ext(rrect(2.6, 2.0, .14), .05, col, { bevel: .02 }); s.position.set(i * .18, i * .16, i * .08); s.rotation.z = (i - 1) * .06; stack.add(s); });
  (z.words || []).forEach((w, i) => { const n = cutText([w], { lineH: .36, color: '#fffaf0' }); n.position.set(-.7 + i * .7, .7 - i * .6, .2); n.rotation.z = (i - 1) * .06; stack.add(n); });
  place(stack, c + half * .35, wallR(1.6, .4), 3.1);
  register(null, 'decorativa', stack, 'Descubrir, practicar, repetir', () => { aud.pop(); });
  const url = charAsset('kikino', 'cutout'); if (url){ const k = await sticker(url, 2.1); place(k, c - half * .1, midR(1), topOf(1) - .02); }
  notes(c, z, half);
  plants(c, half, ['#9aa985', '#b9c4a6']);
}

export const SITE_SCENES = { bienvenida, portales, biblioteca, escenario, buzon, sala, lectura, vocalesCasa, musica, marLimpio, aula, calendario, tarjetas, pizarraPasos, cajas, muroNotas, camino, propuesta };
