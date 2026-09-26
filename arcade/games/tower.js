// 10 · Ночная башня — drop sliding blocks onto a growing tower.
ARCADE.register({
  id: 'tower', title: 'Ночная башня', genre: 'Аркада на точность', cat: 'Аркады', color: '#1d1842',
  desc: 'Роняй блоки точно друг на друга. Что свисает, отрезается. Три точных попадания расширяют блок.',
  keys: 'Пробел или клик: уронить блок',
  touch: 'Тапни по экрану, чтобы уронить блок.',
  w: 360, h: 600, tap: true, pad: null,

  create(api) {
    const W = 360, VH = 600, H = 28, BASE = 200, PERFECT = 5;
    const hue = i => (250 + i * 9) % 360;
    let stack = [{ x: (W - BASE) / 2, w: BASE }], cur, falling = [], combo = 0, speed = 150, camY = 0, msg = null;
    const stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * 1800, r: Math.random() * 1.4 + 0.3 }));

    function spawn() {
      const top = stack[stack.length - 1], left = stack.length % 2 === 0;
      cur = { x: left ? -top.w * 0.5 : W - top.w * 0.5, w: top.w, dir: left ? 1 : -1 };
    }
    spawn();
    const screenY = i => VH - 80 - (i + 1) * H + camY;
    const targetCam = () => Math.max(0, stack.length * H - VH * 0.45);

    function drop() {
      const top = stack[stack.length - 1], diff = cur.x - top.x, lvl = stack.length;
      if (Math.abs(diff) <= PERFECT) {
        combo++;
        let x = top.x, w = top.w;
        if (combo >= 3 && w < BASE) { const g = Math.min(8, BASE - w); w += g; x -= g / 2; }
        stack.push({ x, w });
        msg = { text: `Точно ×${combo}`, t: 0.8 };
        api.sfx(330 * Math.pow(2, Math.min(combo, 12) / 12), 0.18, 'sine', 0.1);
      } else {
        const L = Math.max(cur.x, top.x), R = Math.min(cur.x + cur.w, top.x + top.w);
        if (R - L <= 0) {
          falling.push({ x: cur.x, w: cur.w, lvl, vy: 0, vx: cur.dir * 60 });
          cur = null;
          return api.over(`Высота: ${stack.length - 1}`);
        }
        combo = 0;
        falling.push({ x: diff > 0 ? R : cur.x, w: cur.w - (R - L), lvl, vy: 0, vx: diff > 0 ? 60 : -60 });
        stack.push({ x: L, w: R - L });
        api.sfx(240, 0.08, 'triangle', 0.06);
      }
      api.score(stack.length - 1);
      speed = Math.min(150 + stack.length * 5, 420);
      spawn();
    }

    function update(dt, input) {
      if (input.hit.a || input.hit.up) drop();
      if (cur) {
        cur.x += cur.dir * speed * dt;
        if (cur.x < -cur.w * 0.5) { cur.x = -cur.w * 0.5; cur.dir = 1; }
        if (cur.x > W - cur.w * 0.5) { cur.x = W - cur.w * 0.5; cur.dir = -1; }
      }
      for (const f of falling) { f.v = (f.v || 0) + 1200 * dt; f.vy += f.v * dt; f.x += f.vx * dt; }
      falling = falling.filter(f => screenY(f.lvl) + f.vy < VH + 100);
      camY += (targetCam() - camY) * Math.min(1, dt * 7);
      if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
    }

    function block(ctx, x, y, w, i) {
      const g = ctx.createLinearGradient(0, y, 0, y + H);
      g.addColorStop(0, `hsl(${hue(i)} 80% 72%)`); g.addColorStop(1, `hsl(${hue(i)} 65% 52%)`);
      ctx.fillStyle = g; ctx.fillRect(x, y, w, H - 2);
      ctx.fillStyle = 'hsl(45 100% 80% / .85)';
      for (let k = 0; k < Math.floor(w / 18); k++) if ((k * 7 + i * 3) % 5 < 2) ctx.fillRect(x + 7 + k * 18, y + 10, 6, 8);
    }

    function draw(ctx) {
      const h = Math.min(stack.length / 60, 1);
      const sky = ctx.createLinearGradient(0, 0, 0, VH);
      sky.addColorStop(0, `hsl(${248 - h * 20} 50% ${10 + h * 6}%)`);
      sky.addColorStop(1, `hsl(${262 - h * 240} ${45 + h * 20}% ${18 + h * 22}%)`);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, VH);
      for (const s of stars) { ctx.fillStyle = `rgba(244,236,220,${0.7 * (1 - h * 0.7)})`; ctx.fillRect(s.x, ((s.y + camY * 0.3) % (VH + 40)) - 20, s.r, s.r); }
      const gy = screenY(-1) + H;
      if (gy < VH + H) { ctx.fillStyle = '#0b0920'; ctx.fillRect(0, gy - H + 2, W, VH); }
      stack.forEach((b, i) => { const y = screenY(i); if (y > -H && y < VH) block(ctx, b.x, y, b.w, i); });
      for (const f of falling) block(ctx, f.x, screenY(f.lvl) + f.vy, f.w, f.lvl);
      if (cur) {
        const top = stack[stack.length - 1], y = screenY(stack.length);
        ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(top.x, y, top.w, H - 2);
        block(ctx, cur.x, y, cur.w, stack.length);
      }
      if (msg) ARCADE.util.text(ctx, msg.text, W / 2, 110, 22, '#ffb65c');
    }

    return {
      update, draw,
      demo() {
        let x = stack[0].x, w = BASE;
        [8, -12, 0, 10, -6, 4].forEach(s => { const nx = x + s, L = Math.max(x, nx), R = Math.min(x + w, nx + w); x = L; w = R - L; stack.push({ x, w }); });
        spawn(); camY = 0;
      }
    };
  }
});
