// 07 · Птичка — tap to flap between pipes.
ARCADE.register({
  id: 'flappy', title: 'Птичка', genre: 'Аркада в одно касание', cat: 'Аркады', color: '#7fd4f0',
  desc: 'Одно нажатие, один взмах крыльями. Пролетай между трубами и не падай.',
  keys: 'Пробел, ↑ или клик: взмах',
  touch: 'Тапай по экрану, чтобы птичка взлетала.',
  w: 360, h: 540, tap: true, pad: null,

  create(api) {
    const W = 360, H = 540, GROUND = 480, GAP = 150, SPEED = 140;
    const bird = { x: 90, y: 240, vy: -250, r: 12 };
    const pipes = [];
    let dist = 0, points = 0, nextPipe = 180, dead = false;
    const clouds = Array.from({ length: 5 }, (_, i) => ({ x: i * 90, y: 60 + (i % 3) * 50 }));

    function addPipe(x) { pipes.push({ x, gapY: 110 + Math.random() * (GROUND - 220 - GAP / 2), scored: false }); }

    function update(dt, input) {
      if (input.hit.a || input.hit.up) { bird.vy = -360; api.sfx(700, 0.07, 'triangle', 0.04, 300); }
      bird.vy = Math.min(bird.vy + 1250 * dt, 520);
      bird.y += bird.vy * dt;
      const dx = SPEED * dt;
      dist += dx;
      nextPipe -= dx;
      if (nextPipe <= 0) { addPipe(W + 30); nextPipe = 200; }
      for (const p of pipes) {
        p.x -= dx;
        if (!p.scored && p.x + 30 < bird.x) { p.scored = true; points++; api.score(points); api.sfx(900, 0.09, 'square', 0.035, 200); }
        const inX = bird.x + bird.r > p.x && bird.x - bird.r < p.x + 60;
        if (inX && (bird.y - bird.r < p.gapY - GAP / 2 || bird.y + bird.r > p.gapY + GAP / 2)) return api.over(`Пролетел труб: ${points}`);
      }
      while (pipes.length && pipes[0].x < -70) pipes.shift();
      for (const c of clouds) { c.x -= dx * 0.3; if (c.x < -80) c.x += 460; }
      if (bird.y + bird.r > GROUND || bird.y < -40) api.over(`Пролетел труб: ${points}`);
    }

    function draw(ctx, time) {
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, '#5ec2ec'); sky.addColorStop(1, '#c9f0ff');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffffffd0';
      for (const c of clouds) { ctx.beginPath(); ctx.arc(c.x, c.y, 16, 0, 7); ctx.arc(c.x + 20, c.y - 8, 20, 0, 7); ctx.arc(c.x + 42, c.y, 15, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#9fd9a0';
      for (let i = 0; i < 6; i++) { const x = ((i * 80 - dist * 0.2) % 480 + 480) % 480 - 60; ctx.fillRect(x, GROUND - 60 - (i % 3) * 20, 50, 80); }
      for (const p of pipes) {
        const top = p.gapY - GAP / 2, bot = p.gapY + GAP / 2;
        ctx.fillStyle = '#3cb44b'; ctx.fillRect(p.x, 0, 60, top); ctx.fillRect(p.x, bot, 60, GROUND - bot);
        ctx.fillStyle = '#7ee08a'; ctx.fillRect(p.x + 6, 0, 6, top); ctx.fillRect(p.x + 6, bot, 6, GROUND - bot);
        ctx.fillStyle = '#2d8a39'; ctx.fillRect(p.x - 4, top - 20, 68, 20); ctx.fillRect(p.x - 4, bot, 68, 20);
      }
      ctx.fillStyle = '#dcc07a'; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = '#5fbf3a'; ctx.fillRect(0, GROUND, W, 10);
      ctx.fillStyle = '#c9ab62';
      for (let i = 0; i < 20; i++) ctx.fillRect(((i * 24 - dist) % 480 + 480) % 480 - 20, GROUND + 18, 12, 4);
      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.rotate(Math.max(-0.5, Math.min(1.2, bird.vy / 500)));
      ctx.fillStyle = '#ffcc48'; ctx.beginPath(); ctx.ellipse(0, 0, 15, 12, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#f5a623'; ctx.beginPath(); ctx.ellipse(-4, 2 + Math.sin(time * 20) * 3, 8, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(7, -4, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(8, -5, 2, 3);
      ctx.fillStyle = '#f05a3c'; ctx.fillRect(10, 1, 9, 4);
      ctx.restore();
      ARCADE.util.text(ctx, String(points), W / 2, 60, 40, '#fff');
    }

    return { update, draw, demo() { addPipe(200); addPipe(400); bird.y = 250; } };
  }
});
