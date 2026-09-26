// 01 · Прыг-Скок — side-scrolling platformer.
ARCADE.register({
  id: 'jumper', title: 'Прыг-Скок', genre: 'Платформер', cat: 'Приключения', color: '#6ec3f5',
  desc: 'Беги вправо, прыгай жукам на голову, выбивай монеты из блоков и доберись до флага.',
  keys: '← → бег · ↑ или пробел прыжок · держи прыжок, чтобы прыгнуть выше',
  touch: 'Кнопки ◀ ▶ для бега, «Прыжок» чтобы прыгать. Прыгай жукам на голову.',
  w: 480, h: 270, pad: { dpad: 'lr', a: 'Прыжок' },

  create(api) {
    const { clamp, seeded } = ARCADE.util;
    const T = 18, ROWS = 15, COLS = 190, GROUND = 13, G = 1300;
    const rnd = seeded(11);
    const map = Array.from({ length: ROWS }, () => new Array(COLS).fill(' '));
    const set = (x, y, c) => { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) map[y][x] = c; };
    const hasGround = new Array(COLS).fill(true);
    const enemies = [], coins = [];
    const enemy = tx => enemies.push({ x: tx * T, y: GROUND * T - 14, w: 16, h: 14, vx: -38, dead: 0 });

    // ---- level generation (same level every time) ----
    let x = 16;
    while (x < COLS - 26) {
      const r = rnd();
      if (r < 0.18) {
        const w = 2 + Math.floor(rnd() * 2);
        for (let i = 0; i < w; i++) hasGround[x + i] = false;
        for (let i = 0; i < w; i++) coins.push({ x: (x + i) * T + T / 2, y: (GROUND - 4) * T, got: false });
        x += w + 3;
      } else if (r < 0.36) {
        const h = 2 + Math.floor(rnd() * 2);
        for (let i = 0; i < h; i++) { set(x, GROUND - 1 - i, 'P'); set(x + 1, GROUND - 1 - i, 'P'); }
        if (rnd() < 0.6) enemy(x + 4);
        x += 7;
      } else if (r < 0.68) {
        const w = 3 + Math.floor(rnd() * 3), py = GROUND - 4;
        for (let i = 0; i < w; i++) set(x + i, py, i === Math.floor(w / 2) || rnd() < 0.2 ? '?' : 'B');
        if (rnd() < 0.5) {
          const hy = py - 4;
          for (let i = 1; i < w - 1; i++) { set(x + i, hy, 'B'); coins.push({ x: (x + i) * T + T / 2, y: (hy - 1) * T + T / 2, got: false }); }
        }
        if (rnd() < 0.7) enemy(x + w - 1);
        x += w + 3;
      } else if (r < 0.82) {
        for (let i = 0; i < 4; i++) for (let j = 0; j <= i; j++) set(x + i, GROUND - 1 - j, '#');
        x += 7;
      } else {
        enemy(x); enemy(x + 2);
        for (let i = 0; i < 4; i++) coins.push({ x: (x + i) * T + T / 2, y: (GROUND - 3) * T, got: false });
        x += 6;
      }
    }
    const stairX = COLS - 22;
    for (let i = 0; i < 6; i++) for (let j = 0; j <= i; j++) set(stairX + i, GROUND - 1 - j, '#');
    const flagX = (COLS - 10) * T + T / 2;
    const castleX = (COLS - 6) * T;
    for (let tx = 0; tx < COLS; tx++) if (hasGround[tx]) for (let ty = GROUND; ty < ROWS; ty++) set(tx, ty, '#');

    const solid = (tx, ty) => {
      if (tx < 0 || tx >= COLS) return true;
      if (ty < 0 || ty >= ROWS) return false;
      return map[ty][tx] !== ' ';
    };

    function move(e, dt) {
      const res = { wall: false, head: null };
      e.x += e.vx * dt;
      const y0 = Math.floor(e.y / T), y1 = Math.floor((e.y + e.h - 0.01) / T);
      if (e.vx > 0) {
        const tx = Math.floor((e.x + e.w - 0.01) / T);
        for (let ty = y0; ty <= y1; ty++) if (solid(tx, ty)) { e.x = tx * T - e.w; res.wall = true; break; }
      } else if (e.vx < 0) {
        const tx = Math.floor(e.x / T);
        for (let ty = y0; ty <= y1; ty++) if (solid(tx, ty)) { e.x = (tx + 1) * T; res.wall = true; break; }
      }
      e.vy = Math.min(e.vy + G * dt, 700);
      e.y += e.vy * dt;
      e.ground = false;
      const x0 = Math.floor(e.x / T), x1 = Math.floor((e.x + e.w - 0.01) / T);
      if (e.vy > 0) {
        const ty = Math.floor((e.y + e.h - 0.01) / T);
        for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty) && ty >= 0) { e.y = ty * T - e.h; e.vy = 0; e.ground = true; break; }
      } else if (e.vy < 0) {
        const ty = Math.floor(e.y / T);
        for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty)) {
          e.y = (ty + 1) * T; e.vy = 0;
          const cx = Math.floor((e.x + e.w / 2) / T);
          res.head = { tx: solid(cx, ty) ? cx : tx, ty };
          break;
        }
      }
      return res;
    }

    const p = { x: 40, y: GROUND * T - 18, w: 12, h: 18, vx: 0, vy: 0, face: 1, ground: false };
    let lives = 3, coinCount = 0, camX = 0, coyote = 0, jumpBuf = 0, invul = 0, safeX = 40, won = false;
    const pops = [];
    let points = 0;
    const addPts = n => { points += n; api.score(points); };

    function hurt(fell) {
      if (invul > 0 && !fell) return;
      lives--;
      api.sfx(160, 0.3, 'sawtooth', 0.06, -80);
      if (lives <= 0) { api.over('Жуки победили'); return; }
      p.x = safeX; p.y = 0; p.vx = 0; p.vy = 0;
      invul = 2;
    }

    function update(dt, input) {
      if (won) return;
      const dir = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
      if (dir) p.face = dir;
      if (input.hit.a || input.hit.up) jumpBuf = 0.14;
      const steps = Math.ceil(dt / (1 / 120));
      const h = dt / steps;
      for (let s = 0; s < steps; s++) {
        p.vx += (dir * 150 - p.vx) * Math.min(1, h * (p.ground ? 12 : 6));
        if (jumpBuf > 0 && coyote > 0) {
          p.vy = -440; jumpBuf = 0; coyote = 0;
          api.sfx(420, 0.12, 'square', 0.04, 300);
        }
        if (p.vy < 0 && !(input.held.a || input.held.up)) p.vy += G * h * 1.4;
        const r = move(p, h);
        if (r.head) {
          const c = map[r.head.ty][r.head.tx];
          if (c === '?') {
            map[r.head.ty][r.head.tx] = 'U';
            coinCount++; addPts(100);
            pops.push({ x: r.head.tx * T + T / 2, y: r.head.ty * T, t: 0.5 });
            api.sfx(990, 0.15, 'square', 0.05, 400);
          } else api.sfx(120, 0.06, 'square', 0.04);
        }
        if (p.ground) {
          coyote = 0.1;
          const under = Math.floor((p.x + p.w / 2) / T);
          if (hasGround[under] && p.y >= (GROUND - 1) * T - p.h) safeX = p.x;
        } else coyote -= h;
        jumpBuf -= h;
      }
      invul -= dt;
      if (p.y > ROWS * T + 40) hurt(true);

      for (const c of coins) {
        if (!c.got && Math.abs(c.x - (p.x + p.w / 2)) < 12 && Math.abs(c.y - (p.y + p.h / 2)) < 16) {
          c.got = true; coinCount++; addPts(50);
          api.sfx(1320, 0.08, 'square', 0.04, 200);
        }
      }
      for (const e of enemies) {
        if (e.dead) { e.dead -= dt; continue; }
        if (e.x > camX + 520 || e.gone) continue;
        const r = move(e, dt);
        if (r.wall) e.vx = -e.vx;
        if (e.y > ROWS * T) { e.gone = true; continue; }
        if (ARCADE.util.overlap(p, e)) {
          if (p.vy > 0 && p.y + p.h - e.y < 12) {
            e.dead = 0.4; e.gone = true;
            p.vy = -300; addPts(200);
            api.sfx(240, 0.12, 'square', 0.05, -120);
          } else hurt();
        }
      }
      for (const q of pops) q.t -= dt;
      camX = clamp(p.x - 480 * 0.4, 0, COLS * T - 480);

      if (p.x + p.w >= flagX) {
        won = true;
        addPts(1000 + lives * 300);
        api.over('Флаг взят!', true);
      }
    }

    function draw(ctx, time) {
      const sky = ctx.createLinearGradient(0, 0, 0, 270);
      sky.addColorStop(0, '#5bb4f0'); sky.addColorStop(1, '#c4e9ff');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, 480, 270);
      // distant hills and clouds
      ctx.fillStyle = '#8fd07a';
      for (let i = -1; i < 8; i++) {
        const hx = i * 170 - (camX * 0.3) % 170;
        ctx.beginPath(); ctx.ellipse(hx + 60, 240, 90, 60 + (i & 1) * 20, 0, Math.PI, 0); ctx.fill();
      }
      ctx.fillStyle = '#ffffffd9';
      for (let i = -1; i < 6; i++) {
        const cx = i * 130 - (camX * 0.15) % 130, cy = 40 + (i % 3) * 18;
        ctx.beginPath(); ctx.arc(cx, cy, 12, 0, 7); ctx.arc(cx + 14, cy - 6, 15, 0, 7); ctx.arc(cx + 30, cy, 12, 0, 7); ctx.fill();
      }

      ctx.save();
      ctx.translate(-Math.round(camX), 0);
      const t0 = Math.max(0, Math.floor(camX / T)), t1 = Math.min(COLS - 1, t0 + 28);
      for (let ty = 0; ty < ROWS; ty++) for (let tx = t0; tx <= t1; tx++) {
        const c = map[ty][tx]; if (c === ' ') continue;
        const X = tx * T, Y = ty * T;
        if (c === '#') {
          ctx.fillStyle = '#b86b35'; ctx.fillRect(X, Y, T, T);
          ctx.fillStyle = '#95522a'; ctx.fillRect(X + 3, Y + 7, 4, 3); ctx.fillRect(X + 11, Y + 12, 4, 3);
          if (ty === 0 || map[ty - 1][tx] === ' ') { ctx.fillStyle = '#4fbf3a'; ctx.fillRect(X, Y, T, 5); ctx.fillStyle = '#3a9a2a'; ctx.fillRect(X, Y + 5, T, 2); }
        } else if (c === 'B') {
          ctx.fillStyle = '#c4582e'; ctx.fillRect(X, Y, T, T);
          ctx.fillStyle = '#7a2f14';
          ctx.fillRect(X, Y + 8, T, 1); ctx.fillRect(X, Y + 17, T, 1);
          ctx.fillRect(X + 8, Y, 1, 8); ctx.fillRect(X + 3, Y + 9, 1, 8); ctx.fillRect(X + 13, Y + 9, 1, 8);
        } else if (c === '?' || c === 'U') {
          ctx.fillStyle = c === '?' ? '#f7b52c' : '#9b6b3b'; ctx.fillRect(X, Y, T, T);
          ctx.fillStyle = c === '?' ? '#b86b10' : '#6e4a28';
          ctx.fillRect(X, Y + T - 2, T, 2); ctx.fillRect(X + T - 2, Y, 2, T);
          if (c === '?') ARCADE.util.text(ctx, '?', X + T / 2, Y + T / 2 + 1, 13, '#fff7d6');
        } else if (c === 'P') {
          const top = ty === 0 || map[ty - 1][tx] !== 'P';
          const left = tx > 0 && map[ty][tx - 1] !== 'P';
          ctx.fillStyle = '#2fa84f'; ctx.fillRect(X + (left ? 2 : 0), Y, left ? T - 2 : T - 2, T);
          ctx.fillStyle = '#7de08d'; if (left) ctx.fillRect(X + 5, Y, 3, T);
          if (top) { ctx.fillStyle = '#2fa84f'; ctx.fillRect(X - (left ? 0 : 2), Y, T + 2, 8); ctx.fillStyle = '#1d7a36'; ctx.fillRect(X - (left ? 0 : 2), Y + 7, T + 2, 1); }
        }
      }
      // castle and flag
      ctx.fillStyle = '#a3553a'; ctx.fillRect(castleX, GROUND * T - 72, 90, 72);
      for (let i = 0; i < 5; i++) ctx.fillRect(castleX + i * 20, GROUND * T - 82, 12, 10);
      ctx.fillStyle = '#2b1a14'; ctx.fillRect(castleX + 36, GROUND * T - 34, 18, 34);
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(flagX - 1, GROUND * T - 150, 3, 150);
      ctx.fillStyle = '#ffcc48'; ctx.beginPath(); ctx.arc(flagX + 0.5, GROUND * T - 152, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#e5533d'; ctx.beginPath();
      ctx.moveTo(flagX + 2, GROUND * T - 146); ctx.lineTo(flagX + 30, GROUND * T - 136); ctx.lineTo(flagX + 2, GROUND * T - 126); ctx.fill();

      for (const c of coins) if (!c.got) {
        const s = Math.abs(Math.sin(time * 4 + c.x));
        ctx.fillStyle = '#ffcc48'; ctx.fillRect(c.x - 1 - 4 * s, c.y - 6, 2 + 8 * s, 12);
        ctx.fillStyle = '#fff1a6'; ctx.fillRect(c.x - 1, c.y - 4, 2, 8);
      }
      for (const q of pops) if (q.t > 0) {
        ctx.fillStyle = '#ffcc48'; ctx.fillRect(q.x - 4, q.y - 10 - (0.5 - q.t) * 60, 8, 12);
      }
      for (const e of enemies) {
        if (e.gone && !(e.dead > 0)) continue;
        if (e.dead > 0) { ctx.fillStyle = '#6b3f9e'; ctx.fillRect(e.x, e.y + 10, e.w, 4); continue; }
        ctx.fillStyle = '#7b4bb3'; ctx.beginPath(); ctx.ellipse(e.x + 8, e.y + 8, 8, 7, 0, Math.PI, 0); ctx.fill();
        ctx.fillRect(e.x, e.y + 8, 16, 3);
        ctx.fillStyle = '#3b2358'; const leg = Math.floor(time * 8) % 2;
        ctx.fillRect(e.x + 1 + leg * 2, e.y + 11, 4, 3); ctx.fillRect(e.x + 11 - leg * 2, e.y + 11, 4, 3);
        ctx.fillStyle = '#fff'; ctx.fillRect(e.x + 3, e.y + 4, 4, 4); ctx.fillRect(e.x + 9, e.y + 4, 4, 4);
        ctx.fillStyle = '#111'; ctx.fillRect(e.x + (e.vx < 0 ? 3 : 5), e.y + 5, 2, 2); ctx.fillRect(e.x + (e.vx < 0 ? 9 : 11), e.y + 5, 2, 2);
      }
      // hero
      if (!(invul > 0 && Math.floor(time * 12) % 2)) {
        const X = Math.round(p.x), Y = Math.round(p.y), f = p.face;
        ctx.fillStyle = '#e5533d'; ctx.fillRect(X, Y, 12, 5); ctx.fillRect(f > 0 ? X + 6 : X - 2, Y + 3, 8, 2);
        ctx.fillStyle = '#ffd3a8'; ctx.fillRect(X + 1, Y + 5, 10, 5);
        ctx.fillStyle = '#222'; ctx.fillRect(f > 0 ? X + 7 : X + 3, Y + 6, 2, 2);
        ctx.fillStyle = '#2d5fd1'; ctx.fillRect(X + 1, Y + 10, 10, 6);
        ctx.fillStyle = '#e5533d'; ctx.fillRect(X + 1, Y + 10, 2, 3); ctx.fillRect(X + 9, Y + 10, 2, 3);
        const run = p.ground && Math.abs(p.vx) > 20 ? Math.floor(time * 12) % 2 : 0;
        ctx.fillStyle = '#5a3418'; ctx.fillRect(X + 1 + run, Y + 16, 4, 2); ctx.fillRect(X + 7 - run, Y + 16, 4, 2);
      }
      ctx.restore();

      // HUD
      ctx.fillStyle = '#00000055'; ARCADE.util.rrect(ctx, 8, 8, 150, 24, 8); ctx.fill();
      ARCADE.util.text(ctx, '♥'.repeat(Math.max(0, lives)), 18, 21, 14, '#ff6b6b', 'left');
      ARCADE.util.text(ctx, '● ' + coinCount, 150, 21, 13, '#ffcc48', 'right');
    }

    return { update, draw };
  }
});
