// 03 · Космострел — vertical space shooter.
ARCADE.register({
  id: 'shooter', title: 'Космострел', genre: 'Космическая стрелялка', cat: 'Стрелялки', color: '#1b1640',
  desc: 'Корабль стреляет сам. Уворачивайся от пуль, сбивай пришельцев и лови усилители.',
  keys: 'Стрелки или WASD летать · мышкой можно тянуть корабль · стрельба автоматическая',
  touch: 'Веди пальцем по экрану, корабль летит за ним. Стреляет он сам.',
  w: 360, h: 540, pad: null,

  create(api) {
    const { clamp, rand, overlap } = ARCADE.util;
    const W = 360, H = 540;
    const ship = { x: W / 2 - 13, y: H - 90, w: 26, h: 26 };
    let hp = 3, invul = 0, fireT = 0, power = 0, time = 0, spawnT = 1, wave = 1, points = 0;
    let target = null, dragging = false;
    const shots = [], foes = [], enemyShots = [], items = [], sparks = [];
    const stars = Array.from({ length: 70 }, () => ({ x: rand(0, W), y: rand(0, H), s: rand(20, 90), r: Math.random() < 0.2 ? 2 : 1 }));

    function spawn() {
      const kind = Math.random();
      if (wave % 6 === 0 && !foes.some(f => f.big)) {
        foes.push({ x: W / 2 - 40, y: -60, w: 80, h: 44, hp: 40 + wave * 4, max: 40 + wave * 4, big: true, t: 0, vy: 40, fire: 1 });
        return;
      }
      if (kind < 0.55) {
        const n = 4, x0 = rand(30, W - 150);
        for (let i = 0; i < n; i++) foes.push({ x: x0 + i * 30, y: -30 - i * 26, w: 22, h: 20, hp: 1, t: i * 0.4, vy: 90 + wave * 4, sway: 60, type: 'dart' });
      } else if (kind < 0.85) {
        foes.push({ x: rand(20, W - 50), y: -30, w: 30, h: 26, hp: 3, t: 0, vy: 70, stopY: rand(60, 200), fire: rand(1, 2), type: 'gunner' });
      } else {
        foes.push({ x: rand(20, W - 50), y: -30, w: 34, h: 34, hp: 6, t: 0, vy: 50, sway: 20, type: 'rock' });
      }
    }

    function boom(x, y, color, n = 14) {
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2), s = rand(40, 200);
        sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: rand(0.3, 0.7), color });
      }
    }

    function hitShip() {
      if (invul > 0) return;
      hp--; invul = 1.4;
      boom(ship.x + 13, ship.y + 13, '#ff8a5c', 20);
      api.sfx(140, 0.3, 'sawtooth', 0.07, -60);
      if (hp <= 0) api.over('Корабль подбит');
    }

    function update(dt, input) {
      time += dt;
      wave = 1 + Math.floor(time / 20);
      // movement
      const dx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
      const dy = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
      if (dx || dy) { target = null; ship.x += dx * 260 * dt; ship.y += dy * 260 * dt; }
      if (target) {
        ship.x += (target.x - 13 - ship.x) * Math.min(1, dt * 14);
        ship.y += (target.y - 13 - ship.y) * Math.min(1, dt * 14);
      }
      ship.x = clamp(ship.x, 0, W - ship.w);
      ship.y = clamp(ship.y, 40, H - ship.h - 6);

      // firing
      fireT -= dt; power -= dt;
      if (fireT <= 0) {
        fireT = 0.15;
        const cx = ship.x + 13;
        shots.push({ x: cx - 2, y: ship.y - 8, w: 4, h: 12, vx: 0 });
        if (power > 0) {
          shots.push({ x: cx - 2, y: ship.y, w: 4, h: 12, vx: -110 });
          shots.push({ x: cx - 2, y: ship.y, w: 4, h: 12, vx: 110 });
        }
        api.sfx(880, 0.03, 'square', 0.015, -300);
      }
      for (const s of shots) { s.y -= 560 * dt; s.x += s.vx * dt; }

      // enemies
      spawnT -= dt;
      if (spawnT <= 0) { spawn(); spawnT = Math.max(0.6, 2 - wave * 0.12); }
      for (const f of foes) {
        f.t += dt;
        if (f.big) {
          if (f.y < 50) f.y += f.vy * dt;
          f.x = W / 2 - 40 + Math.sin(f.t * 0.8) * 110;
          f.fire -= dt;
          if (f.fire <= 0) {
            f.fire = 0.9;
            for (let i = -2; i <= 2; i++) enemyShots.push({ x: f.x + 38, y: f.y + 40, w: 6, h: 6, vx: i * 50, vy: 180 });
          }
        } else if (f.type === 'gunner') {
          if (f.y < f.stopY) f.y += f.vy * dt; else f.x += Math.sin(f.t) * 30 * dt;
          f.fire -= dt;
          if (f.fire <= 0 && f.y > 0) {
            f.fire = 1.8;
            const ax = ship.x + 13 - (f.x + 15), ay = ship.y + 13 - (f.y + 13), d = Math.hypot(ax, ay) || 1;
            enemyShots.push({ x: f.x + 12, y: f.y + 20, w: 6, h: 6, vx: ax / d * 190, vy: ay / d * 190 });
          }
          if (f.t > 14) f.y += 90 * dt;
        } else {
          f.y += f.vy * dt;
          f.x += Math.cos(f.t * 3) * (f.sway || 0) * dt;
        }
        for (const s of shots) if (!s.dead && overlap(s, f)) {
          s.dead = true; f.hp--; f.flash = 0.06;
          if (f.hp <= 0) {
            f.dead = true;
            const val = f.big ? 500 : f.type === 'rock' ? 40 : f.type === 'gunner' ? 30 : 10;
            points += val; api.score(points);
            boom(f.x + f.w / 2, f.y + f.h / 2, f.big ? '#ffcc48' : '#7ee0ff', f.big ? 50 : 14);
            api.sfx(f.big ? 90 : 200, f.big ? 0.6 : 0.15, 'sawtooth', 0.05, -100);
            const r = Math.random();
            if (f.big || r < 0.08) items.push({ x: f.x + f.w / 2 - 9, y: f.y, w: 18, h: 18, kind: 'P' });
            else if (r < 0.12) items.push({ x: f.x + f.w / 2 - 9, y: f.y, w: 18, h: 18, kind: '+' });
          }
        }
        if (!f.dead && overlap(f, ship)) { if (!f.big) f.dead = true; hitShip(); }
        f.flash = (f.flash || 0) - dt;
      }
      for (const s of enemyShots) { s.x += s.vx * dt; s.y += s.vy * dt; if (!s.dead && overlap(s, { x: ship.x + 6, y: ship.y + 6, w: 14, h: 14 })) { s.dead = true; hitShip(); } }
      for (const it of items) {
        it.y += 90 * dt;
        if (!it.dead && overlap(it, ship)) {
          it.dead = true;
          if (it.kind === 'P') power = 10; else hp = Math.min(5, hp + 1);
          api.sfx(660, 0.2, 'triangle', 0.06, 600);
        }
      }
      for (const p of sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; }
      for (const s of stars) { s.y += s.s * dt; if (s.y > H) { s.y = 0; s.x = rand(0, W); } }
      invul -= dt;

      const keep = (arr, fn) => { for (let i = arr.length - 1; i >= 0; i--) if (!fn(arr[i])) arr.splice(i, 1); };
      keep(shots, s => !s.dead && s.y > -20);
      keep(foes, f => !f.dead && f.y < H + 60);
      keep(enemyShots, s => !s.dead && s.y < H + 10 && s.y > -20 && s.x > -10 && s.x < W + 10);
      keep(items, i => !i.dead && i.y < H);
      keep(sparks, p => p.t > 0);
    }

    function drawShip(ctx, x, y) {
      ctx.fillStyle = '#e8ecff';
      ctx.beginPath(); ctx.moveTo(x + 13, y); ctx.lineTo(x + 26, y + 24); ctx.lineTo(x + 13, y + 18); ctx.lineTo(x, y + 24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#48c7ff'; ctx.fillRect(x + 11, y + 7, 4, 6);
      ctx.fillStyle = '#ff9a3c'; ctx.fillRect(x + 10, y + 20, 6, 4 + Math.random() * 5);
    }

    function draw(ctx) {
      ctx.fillStyle = '#0d0b24'; ctx.fillRect(0, 0, W, H);
      for (const s of stars) { ctx.fillStyle = s.r > 1 ? '#fff' : '#8b86c2'; ctx.fillRect(s.x, s.y, s.r, s.r * (s.s > 60 ? 3 : 1)); }
      for (const f of foes) {
        const white = f.flash > 0;
        if (f.big) {
          ctx.fillStyle = white ? '#fff' : '#b83fd9';
          ctx.beginPath(); ctx.ellipse(f.x + 40, f.y + 20, 40, 18, 0, 0, 7); ctx.fill();
          ctx.fillStyle = white ? '#fff' : '#ffcc48'; ctx.beginPath(); ctx.ellipse(f.x + 40, f.y + 12, 16, 12, 0, Math.PI, 0); ctx.fill();
          ctx.fillStyle = '#ff5c7a'; for (let i = 0; i < 5; i++) ctx.fillRect(f.x + 10 + i * 14, f.y + 26, 6, 6);
          ctx.fillStyle = '#ffffff33'; ctx.fillRect(f.x, f.y - 10, 80, 4);
          ctx.fillStyle = '#ff5c7a'; ctx.fillRect(f.x, f.y - 10, 80 * f.hp / f.max, 4);
        } else if (f.type === 'gunner') {
          ctx.fillStyle = white ? '#fff' : '#ff5c7a';
          ctx.fillRect(f.x, f.y + 6, 30, 12); ctx.fillRect(f.x + 8, f.y, 14, 26);
          ctx.fillStyle = '#2b0f1c'; ctx.fillRect(f.x + 11, f.y + 8, 8, 6);
        } else if (f.type === 'rock') {
          ctx.fillStyle = white ? '#fff' : '#8a7a6a';
          ctx.beginPath(); ctx.arc(f.x + 17, f.y + 17, 17, 0, 7); ctx.fill();
          ctx.fillStyle = '#6a5b4d'; ctx.beginPath(); ctx.arc(f.x + 11, f.y + 13, 5, 0, 7); ctx.arc(f.x + 23, f.y + 22, 4, 0, 7); ctx.fill();
        } else {
          ctx.fillStyle = white ? '#fff' : '#5cf0b0';
          ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + 22, f.y); ctx.lineTo(f.x + 11, f.y + 20); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#0d0b24'; ctx.fillRect(f.x + 8, f.y + 4, 6, 4);
        }
      }
      ctx.fillStyle = '#ffe36b'; for (const s of shots) ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = '#ff6fae'; for (const s of enemyShots) { ctx.beginPath(); ctx.arc(s.x + 3, s.y + 3, 4, 0, 7); ctx.fill(); }
      for (const it of items) {
        ctx.fillStyle = it.kind === 'P' ? '#ffcc48' : '#5cf07a';
        ARCADE.util.rrect(ctx, it.x, it.y, 18, 18, 5); ctx.fill();
        ARCADE.util.text(ctx, it.kind, it.x + 9, it.y + 10, 12, '#1b1606');
      }
      for (const p of sparks) { ctx.globalAlpha = Math.max(0, p.t * 1.6); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); }
      ctx.globalAlpha = 1;
      if (!(invul > 0 && Math.floor(invul * 14) % 2)) drawShip(ctx, ship.x, ship.y);
      ARCADE.util.text(ctx, '♥'.repeat(Math.max(0, hp)), 10, 18, 14, '#ff6fae', 'left');
      ARCADE.util.text(ctx, 'Волна ' + wave, W - 10, 18, 12, '#8b86c2', 'right');
      if (power > 0) ARCADE.util.text(ctx, 'Тройной залп ' + Math.ceil(power), W / 2, 18, 11, '#ffcc48');
    }

    return {
      update, draw,
      onPointer(type, x, y, e) {
        if (type === 'down') dragging = true;
        if (type === 'up') { dragging = false; return; }
        if (dragging || (type === 'move' && e.pointerType === 'mouse')) target = { x, y: y - (e.pointerType === 'mouse' ? 0 : 50) };
      },
      demo() {
        foes.push({ x: 70, y: 190, w: 22, h: 20, type: 'dart' }, { x: 110, y: 215, w: 22, h: 20, type: 'dart' }, { x: 230, y: 180, w: 30, h: 26, type: 'gunner' });
        ship.y = 330;
        shots.push({ x: 178, y: 290, w: 4, h: 12 }, { x: 178, y: 245, w: 4, h: 12 });
      }
    };
  }
});
