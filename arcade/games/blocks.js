// 02 · Кубоград — 2D block sandbox: dig, collect ore, build.
ARCADE.register({
  id: 'blocks', title: 'Кубоград', genre: 'Песочница из кубиков', cat: 'Приключения', color: '#79c0ff',
  desc: 'Копай землю и камень, ищи уголь, золото и алмазы в пещерах, строй свой дом.',
  keys: 'A D ходить · W или пробел прыжок · клик по блоку копает, клик по пустоте строит · 1–6 выбор блока',
  touch: '◀ ▶ ходить, «Прыжок» прыгать. Тап по блоку копает, тап по пустоте ставит блок. Блок выбирается внизу экрана.',
  w: 480, h: 300, pad: { dpad: 'lr', a: 'Прыжок' },

  create(api) {
    const { clamp } = ARCADE.util;
    const T = 16, WW = 160, WH = 64, G = 1200, REACH = 6 * T;
    const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, LOG = 4, LEAF = 5, COAL = 6, GOLD = 7, DIAMOND = 8, BEDROCK = 9, PLANK = 10, GLASS = 11, BRICK = 12;
    const NAMES = { [DIRT]: 'Земля', [STONE]: 'Камень', [LOG]: 'Бревно', [PLANK]: 'Доски', [GLASS]: 'Стекло', [BRICK]: 'Кирпич' };
    const VALUE = { [GRASS]: 1, [DIRT]: 1, [STONE]: 2, [LOG]: 2, [LEAF]: 1, [COAL]: 10, [GOLD]: 25, [DIAMOND]: 100, [PLANK]: 1, [GLASS]: 1, [BRICK]: 1 };
    const HOTBAR = [DIRT, STONE, LOG, PLANK, GLASS, BRICK];

    // ---- textures: one 16×16 tile per block ----
    const tex = {};
    function makeTex(id, base, speck, draw) {
      const c = document.createElement('canvas'); c.width = c.height = T;
      const x = c.getContext('2d');
      x.fillStyle = base; x.fillRect(0, 0, T, T);
      let s = id * 97 + 13;
      const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      if (speck) for (let i = 0; i < 22; i++) { x.fillStyle = speck[i % speck.length]; x.fillRect(Math.floor(r() * 15), Math.floor(r() * 15), 2, 2); }
      if (draw) draw(x, r);
      tex[id] = c;
    }
    makeTex(DIRT, '#8a5a36', ['#734a2b', '#9c6a43']);
    makeTex(GRASS, '#8a5a36', ['#734a2b', '#9c6a43'], x => { x.fillStyle = '#5fb23f'; x.fillRect(0, 0, T, 4); x.fillStyle = '#4a9530'; for (let i = 0; i < T; i += 3) x.fillRect(i, 4, 2, 2 + (i % 2) * 2); });
    makeTex(STONE, '#8c8f96', ['#777a80', '#a1a4ab']);
    makeTex(LOG, '#6e4c2a', null, x => { x.fillStyle = '#5a3c20'; for (let i = 1; i < T; i += 4) x.fillRect(i, 0, 1, T); x.fillStyle = '#7f5a34'; x.fillRect(3, 5, 2, 4); });
    makeTex(LEAF, '#3e8f2e', ['#2f7a22', '#57a843', '#2f7a22']);
    const ore = (id, color) => makeTex(id, '#8c8f96', ['#777a80', '#a1a4ab'], (x, r) => { x.fillStyle = color; for (let i = 0; i < 5; i++) x.fillRect(2 + Math.floor(r() * 10), 2 + Math.floor(r() * 10), 3, 3); });
    ore(COAL, '#23242a'); ore(GOLD, '#f5c542'); ore(DIAMOND, '#5ce1e6');
    makeTex(BEDROCK, '#3b3c42', ['#222328', '#55565d']);
    makeTex(PLANK, '#b88a52', null, x => { x.fillStyle = '#946c3c'; x.fillRect(0, 3, T, 1); x.fillRect(0, 7, T, 1); x.fillRect(0, 11, T, 1); x.fillRect(0, 15, T, 1); x.fillRect(6, 0, 1, 4); x.fillRect(11, 4, 1, 4); x.fillRect(3, 8, 1, 4); x.fillRect(9, 12, 1, 4); });
    makeTex(GLASS, '#cfefff55', null, x => { x.strokeStyle = '#e8f8ff'; x.lineWidth = 1; x.strokeRect(0.5, 0.5, T - 1, T - 1); x.fillStyle = '#ffffffaa'; x.fillRect(3, 3, 2, 5); x.fillRect(5, 3, 2, 2); });
    makeTex(BRICK, '#a4432f', null, x => { x.fillStyle = '#d9c7b8'; x.fillRect(0, 7, T, 1); x.fillRect(0, 15, T, 1); x.fillRect(7, 0, 1, 7); x.fillRect(3, 8, 1, 7); x.fillRect(12, 8, 1, 7); });

    // ---- world ----
    const world = Array.from({ length: WH }, () => new Uint8Array(WW));
    const top = new Array(WW);
    const p1 = Math.random() * 6, p2 = Math.random() * 6, p3 = Math.random() * 6;
    for (let x = 0; x < WW; x++) top[x] = Math.round(24 + 5 * Math.sin(x * 0.05 + p1) + 3 * Math.sin(x * 0.13 + p2) + 1.5 * Math.sin(x * 0.31 + p3));
    for (let x = 0; x < WW; x++) {
      const h = top[x];
      for (let y = h; y < WH; y++) {
        let b = y === h ? GRASS : y < h + 4 ? DIRT : STONE;
        if (b === STONE) {
          const r = Math.random(), d = y - h;
          if (d > 26 && r < 0.012) b = DIAMOND;
          else if (d > 14 && r < 0.03) b = GOLD;
          else if (r < 0.07) b = COAL;
        }
        world[y][x] = b;
      }
      world[WH - 1][x] = BEDROCK;
    }
    // caves: random worms
    for (let i = 0; i < 14; i++) {
      let cx = Math.random() * WW, cy = top[Math.floor(cx)] + 8 + Math.random() * 30, a = Math.random() * 6;
      for (let s = 0; s < 60; s++) {
        const rad = 1 + Math.random() * 1.4;
        for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++)
          if (x >= 0 && x < WW && y > top[x] + 3 && y < WH - 1 && (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) world[y][x] = AIR;
        a += (Math.random() - 0.5) * 0.8; cx += Math.cos(a); cy += Math.sin(a) * 0.6;
      }
    }
    // trees
    for (let x = 3, lastTree = -10; x < WW - 3; x++) {
      if (x - lastTree > 5 && Math.random() < 0.12 && Math.abs(x - WW / 2) > 3) {
        lastTree = x;
        const h = top[x], th = 4 + Math.floor(Math.random() * 2);
        for (let i = 1; i <= th; i++) world[h - i][x] = LOG;
        const ty = h - th;
        for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > 3) continue;
          const yy = ty + dy, xx = x + dx;
          if (world[yy][xx] === AIR) world[yy][xx] = LEAF;
        }
      }
    }

    const solid = (tx, ty) => tx < 0 || tx >= WW || ty >= WH || (ty >= 0 && world[ty][tx] !== AIR);
    const px = Math.floor(WW / 2);
    const p = { x: px * T + 3, y: (top[px] - 2) * T, w: 10, h: 26, vx: 0, vy: 0, face: 1, ground: false };
    let camX = clamp(p.x - 240, 0, WW * T - 480), camY = clamp(p.y - 150, 0, WH * T - 300), sel = 0, hover = null, mined = 0, points = 0, coyote = 0, jumpBuf = 0;
    const found = { [COAL]: 0, [GOLD]: 0, [DIAMOND]: 0 };
    const bits = [];

    function move(e, dt) {
      e.x += e.vx * dt;
      const y0 = Math.floor(e.y / T), y1 = Math.floor((e.y + e.h - 0.01) / T);
      if (e.vx > 0) { const tx = Math.floor((e.x + e.w - 0.01) / T); for (let ty = y0; ty <= y1; ty++) if (solid(tx, ty)) { e.x = tx * T - e.w; break; } }
      else if (e.vx < 0) { const tx = Math.floor(e.x / T); for (let ty = y0; ty <= y1; ty++) if (solid(tx, ty)) { e.x = (tx + 1) * T; break; } }
      e.vy = Math.min(e.vy + G * dt, 600);
      e.y += e.vy * dt;
      e.ground = false;
      const x0 = Math.floor(e.x / T), x1 = Math.floor((e.x + e.w - 0.01) / T);
      if (e.vy > 0) { const ty = Math.floor((e.y + e.h - 0.01) / T); for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty)) { e.y = ty * T - e.h; e.vy = 0; e.ground = true; break; } }
      else if (e.vy < 0) { const ty = Math.floor(e.y / T); for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty)) { e.y = (ty + 1) * T; e.vy = 0; break; } }
    }

    // hotbar geometry (screen space)
    const SLOT = 30, HB_X = (480 - SLOT * HOTBAR.length) / 2, HB_Y = 300 - SLOT - 6;

    function tileAt(sx, sy) { return [Math.floor((sx + camX) / T), Math.floor((sy + camY) / T)]; }
    function inReach(tx, ty) {
      const dx = tx * T + T / 2 - (p.x + p.w / 2), dy = ty * T + T / 2 - (p.y + p.h / 2);
      return dx * dx + dy * dy <= REACH * REACH;
    }

    function useTile(sx, sy) {
      if (sy >= HB_Y - 2 && sx >= HB_X && sx < HB_X + SLOT * HOTBAR.length) { sel = Math.floor((sx - HB_X) / SLOT); api.sfx(700, 0.04, 'square', 0.03); return; }
      const [tx, ty] = tileAt(sx, sy);
      if (tx < 0 || tx >= WW || ty < 0 || ty >= WH || !inReach(tx, ty)) return;
      const b = world[ty][tx];
      if (b !== AIR) {
        if (b === BEDROCK) { api.sfx(90, 0.08, 'square', 0.04); return; }
        world[ty][tx] = AIR;
        mined++;
        points += VALUE[b] || 1;
        if (found[b] !== undefined) { found[b]++; api.sfx(b === DIAMOND ? 1400 : 1000, 0.18, 'triangle', 0.06, 500); }
        else api.sfx(160 + Math.random() * 60, 0.06, 'square', 0.04);
        api.score(points);
        for (let i = 0; i < 6; i++) bits.push({ x: tx * T + 8, y: ty * T + 8, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 160, t: 0.6, id: b });
      } else {
        const box = { x: tx * T, y: ty * T, w: T, h: T };
        if (ARCADE.util.overlap(box, p)) return;
        world[ty][tx] = HOTBAR[sel];
        api.sfx(300, 0.05, 'square', 0.04);
      }
    }

    function update(dt, input) {
      const dir = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
      if (dir) p.face = dir;
      if (input.hit.a || input.hit.up) jumpBuf = 0.14;
      const steps = Math.ceil(dt / (1 / 120)), h = dt / steps;
      for (let s = 0; s < steps; s++) {
        p.vx += (dir * 110 - p.vx) * Math.min(1, h * 14);
        if (jumpBuf > 0 && coyote > 0) { p.vy = -390; jumpBuf = 0; coyote = 0; }
        move(p, h);
        if (p.ground) coyote = 0.1; else coyote -= h;
        jumpBuf -= h;
      }
      for (const b of bits) { b.vy += 700 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.t -= dt; }
      for (let i = bits.length - 1; i >= 0; i--) if (bits[i].t <= 0) bits.splice(i, 1);
      camX = clamp(p.x + p.w / 2 - 240, 0, WW * T - 480);
      camY = clamp(p.y + p.h / 2 - 150, 0, WH * T - 300);
    }

    function draw(ctx) {
      const depth = clamp((camY + 150) / T - 26, 0, 20) / 20;
      const sky = ctx.createLinearGradient(0, 0, 0, 300);
      sky.addColorStop(0, depth > 0.5 ? '#1c2233' : '#6fb6ff');
      sky.addColorStop(1, depth > 0.5 ? '#2a3147' : '#cfe9ff');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, 480, 300);
      if (depth <= 0.5) {
        ctx.fillStyle = '#fff4b0'; ctx.fillRect(390, 30 - camY * 0.05, 26, 26);
        ctx.fillStyle = '#ffffffcc';
        for (let i = 0; i < 5; i++) { const cx = ((i * 140 - camX * 0.2) % 700 + 700) % 700 - 100; ctx.fillRect(cx, 50 + (i % 2) * 22 - camY * 0.1, 60, 10); ctx.fillRect(cx + 10, 42 + (i % 2) * 22 - camY * 0.1, 34, 8); }
      }
      const cx = Math.round(camX), cy = Math.round(camY);
      const x0 = Math.floor(cx / T), y0 = Math.floor(cy / T);
      for (let ty = y0; ty <= y0 + 19 && ty < WH; ty++) {
        for (let tx = x0; tx <= x0 + 30 && tx < WW; tx++) {
          const b = world[ty][tx], X = tx * T - cx, Y = ty * T - cy;
          if (b === AIR) {
            if (ty > top[tx]) { ctx.fillStyle = '#3a3b40'; ctx.fillRect(X, Y, T, T); }
            continue;
          }
          ctx.drawImage(tex[b], X, Y);
          // darken deep blocks for a sense of depth
          const d = ty - top[tx];
          if (d > 6) { ctx.fillStyle = `rgba(10,12,20,${Math.min(0.45, (d - 6) * 0.025)})`; ctx.fillRect(X, Y, T, T); }
        }
      }
      if (hover) {
        const [tx, ty] = hover;
        if (tx >= 0 && ty >= 0 && tx < WW && ty < WH && inReach(tx, ty)) {
          ctx.strokeStyle = world[ty][tx] === AIR ? '#ffffffaa' : '#ffe066'; ctx.lineWidth = 1.5;
          ctx.strokeRect(tx * T - cx + 0.75, ty * T - cy + 0.75, T - 1.5, T - 1.5);
        }
      }
      for (const b of bits) { ctx.drawImage(tex[b.id], 4, 4, 6, 6, b.x - cx - 2, b.y - cy - 2, 4, 4); }
      // hero: blocky explorer
      const X = Math.round(p.x - cx), Y = Math.round(p.y - cy);
      ctx.fillStyle = '#6b4a2d'; ctx.fillRect(X, Y, 10, 3);
      ctx.fillStyle = '#e0a878'; ctx.fillRect(X, Y + 3, 10, 7);
      ctx.fillStyle = '#fff'; ctx.fillRect(p.face > 0 ? X + 5 : X + 1, Y + 5, 4, 2);
      ctx.fillStyle = '#3957a8'; ctx.fillRect(p.face > 0 ? X + 7 : X + 1, Y + 5, 2, 2);
      ctx.fillStyle = '#2bb3a8'; ctx.fillRect(X, Y + 10, 10, 8);
      ctx.fillStyle = '#e0a878'; ctx.fillRect(p.face > 0 ? X + 8 : X, Y + 11, 2, 6);
      ctx.fillStyle = '#34398f'; ctx.fillRect(X + 1, Y + 18, 8, 8);
      ctx.fillStyle = '#1d1f33'; ctx.fillRect(X + 4, Y + 20, 2, 6);

      // hotbar
      HOTBAR.forEach((b, i) => {
        const sx = HB_X + i * SLOT;
        ctx.fillStyle = i === sel ? '#ffffffdd' : '#00000088';
        ctx.fillRect(sx, HB_Y, SLOT - 2, SLOT - 2);
        ctx.drawImage(tex[b], sx + 6, HB_Y + 6);
        ARCADE.util.text(ctx, String(i + 1), sx + 4, HB_Y + 6, 8, i === sel ? '#222' : '#fff', 'left');
      });
      ARCADE.util.text(ctx, NAMES[HOTBAR[sel]], 240, HB_Y - 9, 10, '#fff');
      // found ores
      ctx.fillStyle = '#00000066'; ARCADE.util.rrect(ctx, 6, 6, 150, 22, 6); ctx.fill();
      [[COAL, 14], [GOLD, 62], [DIAMOND, 110]].forEach(([id, x]) => {
        ctx.drawImage(tex[id], 3, 3, 10, 10, x, 11, 12, 12);
        ARCADE.util.text(ctx, String(found[id]), x + 16, 18, 11, '#fff', 'left');
      });
    }

    return {
      update, draw,
      onPointer(type, x, y) {
        if (type === 'move') hover = tileAt(x, y);
        if (type === 'down') { hover = tileAt(x, y); useTile(x, y); }
      },
      onKey(code) {
        const n = +code.replace('Digit', '');
        if (code.startsWith('Digit') && n >= 1 && n <= HOTBAR.length) sel = n - 1;
      },
      demo() {
        camX = clamp(p.x - 240, 0, WW * T - 480);
        camY = clamp(p.y - 110, 0, WH * T - 300);
      }
    };
  }
});
