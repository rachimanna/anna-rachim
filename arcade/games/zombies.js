// 04 · Зомби-осада — top-down arena shooter with waves.
ARCADE.register({
  id: 'zombies', title: 'Зомби-осада', genre: 'Стрелялка с видом сверху', cat: 'Стрелялки', color: '#3d5a2a',
  desc: 'Зомби лезут со всех сторон. Отстреливайся, собирай аптечки и продержись как можно больше волн.',
  keys: 'WASD или стрелки бегать · мышка целиться · клик или пробел стрелять',
  touch: 'Крестик двигает героя. Держи «Огонь», прицел наводится на ближайшего зомби сам.',
  w: 480, h: 360, pad: { dpad: true, a: 'Огонь' },

  create(api) {
    const { clamp, rand } = ARCADE.util;
    const W = 480, H = 360;
    const me = { x: W / 2, y: H / 2, r: 9, hp: 5, invul: 0 };
    const bullets = [], zeds = [], meds = [], splats = [];
    let aim = null, mouseDown = false, fireT = 0, wave = 0, toSpawn = 0, spawnT = 0, pause = 1.5, points = 0, angle = -Math.PI / 2;
    const crates = [{ x: 90, y: 80, w: 34, h: 34 }, { x: 350, y: 240, w: 34, h: 34 }, { x: 330, y: 70, w: 50, h: 22 }, { x: 80, y: 250, w: 22, h: 50 }];

    // pre-rendered ground
    const ground = document.createElement('canvas'); ground.width = W; ground.height = H;
    const g = ground.getContext('2d');
    g.fillStyle = '#4d6b35'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 500; i++) { g.fillStyle = Math.random() < 0.5 ? '#587a3d' : '#43602e'; g.fillRect(rand(0, W), rand(0, H), rand(2, 5), rand(2, 5)); }
    g.fillStyle = '#8a7a58'; g.fillRect(0, H / 2 - 14, W, 28); g.fillRect(W / 2 - 14, 0, 28, H);
    g.fillStyle = '#7a6b4c'; for (let i = 0; i < 80; i++) g.fillRect(rand(0, W), H / 2 - 14 + rand(0, 26), 3, 2);

    function nextWave() {
      wave++;
      toSpawn = 4 + wave * 3;
      spawnT = 0;
      api.sfx(330, 0.3, 'triangle', 0.06, 200);
    }

    function spawnZed() {
      const side = Math.floor(rand(0, 4));
      const x = side === 0 ? -15 : side === 1 ? W + 15 : rand(0, W);
      const y = side === 2 ? -15 : side === 3 ? H + 15 : rand(0, H);
      const big = wave >= 3 && Math.random() < 0.15;
      const fast = !big && wave >= 2 && Math.random() < 0.25;
      zeds.push({ x, y, r: big ? 14 : 9, hp: big ? 8 : fast ? 1 : 2, speed: (big ? 30 : fast ? 85 : 45) + wave * 2, big, fast, wob: rand(0, 6), flash: 0 });
    }

    function blocked(x, y, r) {
      for (const c of crates) {
        const nx = clamp(x, c.x, c.x + c.w), ny = clamp(y, c.y, c.y + c.h);
        if ((x - nx) ** 2 + (y - ny) ** 2 < r * r) return true;
      }
      return false;
    }

    function nearest() {
      let best = null, bd = 1e9;
      for (const z of zeds) { const d = (z.x - me.x) ** 2 + (z.y - me.y) ** 2; if (d < bd) { bd = d; best = z; } }
      return best;
    }

    function update(dt, input) {
      let dx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
      let dy = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
      const len = Math.hypot(dx, dy) || 1;
      const nx = clamp(me.x + dx / len * 140 * dt, me.r, W - me.r), ny = clamp(me.y + dy / len * 140 * dt, me.r, H - me.r);
      if (!blocked(nx, me.y, me.r)) me.x = nx;
      if (!blocked(me.x, ny, me.r)) me.y = ny;

      const auto = !aim;
      const tgt = aim || nearest();
      if (tgt) angle = Math.atan2(tgt.y - me.y, tgt.x - me.x);
      fireT -= dt;
      const wantFire = input.held.a || mouseDown;
      if (wantFire && fireT <= 0 && (tgt || !auto)) {
        fireT = 0.13;
        const a = angle + rand(-0.05, 0.05);
        bullets.push({ x: me.x + Math.cos(a) * 12, y: me.y + Math.sin(a) * 12, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, t: 0.8 });
        api.sfx(520, 0.05, 'square', 0.025, -380);
      }

      if (pause > 0) { pause -= dt; if (pause <= 0) nextWave(); }
      else if (toSpawn > 0) {
        spawnT -= dt;
        if (spawnT <= 0) { spawnZed(); toSpawn--; spawnT = Math.max(0.25, 1.1 - wave * 0.07); }
      } else if (!zeds.length) pause = 2.5;

      for (const b of bullets) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.t -= dt;
        if (blocked(b.x, b.y, 1)) b.t = 0;
        for (const z of zeds) if (b.t > 0 && (z.x - b.x) ** 2 + (z.y - b.y) ** 2 < z.r * z.r) {
          b.t = 0; z.hp--; z.flash = 0.08;
          z.x -= Math.cos(angle) * -4; z.y -= Math.sin(angle) * -4;
          if (z.hp <= 0) {
            z.dead = true;
            points += z.big ? 50 : z.fast ? 20 : 10; api.score(points);
            splats.push({ x: z.x, y: z.y, r: z.r + 4, t: 6 });
            api.sfx(110, 0.12, 'sawtooth', 0.05, -40);
            if (Math.random() < 0.07) meds.push({ x: z.x, y: z.y, t: 10 });
          }
          break;
        }
      }
      for (const z of zeds) {
        z.wob += dt * 6; z.flash -= dt;
        const a = Math.atan2(me.y - z.y, me.x - z.x);
        const zx = z.x + Math.cos(a) * z.speed * dt, zy = z.y + Math.sin(a) * z.speed * dt;
        if (!blocked(zx, z.y, z.r)) z.x = zx; else z.y += Math.sign(me.y - z.y || 1) * z.speed * dt;
        if (!blocked(z.x, zy, z.r)) z.y = zy; else z.x += Math.sign(me.x - z.x || 1) * z.speed * dt;
        // keep zombies from stacking on one spot
        for (const o of zeds) if (o !== z) {
          const ddx = z.x - o.x, ddy = z.y - o.y, d = Math.hypot(ddx, ddy), m = z.r + o.r - 2;
          if (d > 0 && d < m) { z.x += ddx / d * (m - d) * 0.5; z.y += ddy / d * (m - d) * 0.5; }
        }
        if ((z.x - me.x) ** 2 + (z.y - me.y) ** 2 < (z.r + me.r) ** 2 && me.invul <= 0) {
          me.hp--; me.invul = 1;
          api.sfx(90, 0.25, 'sawtooth', 0.07);
          if (me.hp <= 0) api.over(`Продержался ${wave - 1} волн`);
        }
      }
      for (const m of meds) {
        m.t -= dt;
        if ((m.x - me.x) ** 2 + (m.y - me.y) ** 2 < 300) { m.t = 0; me.hp = Math.min(5, me.hp + 2); api.sfx(700, 0.2, 'triangle', 0.06, 500); }
      }
      for (const s of splats) s.t -= dt;
      me.invul -= dt;
      const keep = (arr, fn) => { for (let i = arr.length - 1; i >= 0; i--) if (!fn(arr[i])) arr.splice(i, 1); };
      keep(bullets, b => b.t > 0 && b.x > -10 && b.x < W + 10 && b.y > -10 && b.y < H + 10);
      keep(zeds, z => !z.dead);
      keep(meds, m => m.t > 0);
      keep(splats, s => s.t > 0);
    }

    function draw(ctx) {
      ctx.drawImage(ground, 0, 0);
      for (const s of splats) { ctx.globalAlpha = Math.min(1, s.t / 2) * 0.6; ctx.fillStyle = '#2c4a17'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      for (const c of crates) {
        ctx.fillStyle = '#9a6b3a'; ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.strokeStyle = '#6b4520'; ctx.lineWidth = 3; ctx.strokeRect(c.x + 1.5, c.y + 1.5, c.w - 3, c.h - 3);
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + c.w, c.y + c.h); ctx.stroke();
      }
      for (const m of meds) {
        if (m.t < 3 && Math.floor(m.t * 8) % 2) continue;
        ctx.fillStyle = '#fff'; ctx.fillRect(m.x - 8, m.y - 8, 16, 16);
        ctx.fillStyle = '#e5433d'; ctx.fillRect(m.x - 2, m.y - 6, 4, 12); ctx.fillRect(m.x - 6, m.y - 2, 12, 4);
      }
      for (const z of zeds) {
        const a = Math.atan2(me.y - z.y, me.x - z.x);
        ctx.save(); ctx.translate(z.x, z.y); ctx.rotate(a);
        ctx.fillStyle = z.flash > 0 ? '#fff' : z.big ? '#5f8a3a' : z.fast ? '#a3c95a' : '#7cae4a';
        ctx.fillRect(z.r * 0.3, -z.r * 0.9 + Math.sin(z.wob) * 2, z.r * 1.1, 4);
        ctx.fillRect(z.r * 0.3, z.r * 0.9 - 4 - Math.sin(z.wob) * 2, z.r * 1.1, 4);
        ctx.beginPath(); ctx.arc(0, 0, z.r, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffec5c'; ctx.fillRect(z.r * 0.35, -z.r * 0.45, 3, 3); ctx.fillRect(z.r * 0.35, z.r * 0.45 - 3, 3, 3);
        ctx.restore();
      }
      ctx.fillStyle = '#ffe9a3';
      for (const b of bullets) ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
      if (!(me.invul > 0 && Math.floor(me.invul * 12) % 2)) {
        ctx.save(); ctx.translate(me.x, me.y); ctx.rotate(angle);
        ctx.fillStyle = '#2b2b2b'; ctx.fillRect(4, -2, 14, 4);
        ctx.fillStyle = '#3a6fd8'; ctx.beginPath(); ctx.arc(0, 0, me.r, 0, 7); ctx.fill();
        ctx.fillStyle = '#e8b98a'; ctx.beginPath(); ctx.arc(1, 0, 5, 0, 7); ctx.fill();
        ctx.fillStyle = '#5a3a1e'; ctx.beginPath(); ctx.arc(-1, 0, 5, Math.PI / 2, Math.PI * 1.5); ctx.fill();
        ctx.restore();
      }
      if (aim) { ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(aim.x, aim.y, 7, 0, 7); ctx.moveTo(aim.x - 11, aim.y); ctx.lineTo(aim.x + 11, aim.y); ctx.moveTo(aim.x, aim.y - 11); ctx.lineTo(aim.x, aim.y + 11); ctx.stroke(); }
      ARCADE.util.text(ctx, '♥'.repeat(Math.max(0, me.hp)), 10, 16, 14, '#ff5c5c', 'left');
      ARCADE.util.text(ctx, 'Волна ' + Math.max(1, wave), W - 10, 16, 13, '#fff', 'right');
      if (pause > 0 && wave >= 0) ARCADE.util.text(ctx, wave === 0 ? 'Приготовься!' : `Волна ${wave} отбита`, W / 2, 60, 20, '#ffe9a3');
    }

    return {
      update, draw,
      onPointer(type, x, y, e) {
        if (e.pointerType !== 'mouse') return;
        aim = { x, y };
        if (type === 'down') mouseDown = true;
        if (type === 'up') mouseDown = false;
      },
      demo() {
        pause = 0; wave = 2;
        zeds.push({ x: 60, y: 170, r: 9, wob: 0 }, { x: 420, y: 120, r: 14, big: true, wob: 1 }, { x: 250, y: 320, r: 9, fast: true, wob: 2 });
        angle = Math.PI;
        bullets.push({ x: 180, y: 180 }, { x: 140, y: 178 });
      }
    };
  }
});
