// 08 · Арканоид — paddle, ball and a wall of bricks.
ARCADE.register({
  id: 'breakout', title: 'Арканоид', genre: 'Классика', cat: 'Аркады', color: '#281a3d',
  desc: 'Отбивай мяч платформой и разбивай стену. Каждый новый уровень выше и быстрее.',
  keys: 'Мышка или ← → двигать платформу · пробел или клик запустить мяч',
  touch: 'Води пальцем по экрану, чтобы двигать платформу. Тап запускает мяч.',
  w: 360, h: 480, tap: true, pad: null, thumbY: 0,

  create(api) {
    const { clamp } = ARCADE.util;
    const W = 360, H = 480;
    const paddle = { x: W / 2 - 34, y: 448, w: 68, h: 10 };
    const ball = { x: 0, y: 0, vx: 0, vy: 0, r: 6, stuck: true };
    let bricks = [], lives = 3, level = 1, points = 0, speed = 280;
    const COLORS = ['#f0566a', '#f59a3c', '#ffcc48', '#5cd67a', '#4fd1e8', '#8a7cf0', '#d46ef0'];

    function build() {
      bricks = [];
      const rows = Math.min(4 + level, 8), cols = 8, bw = 40, bh = 16, x0 = (W - cols * (bw + 3)) / 2;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (level > 1 && (r + c + level) % 7 === 0) continue;
        const hard = r < level - 1;
        bricks.push({ x: x0 + c * (bw + 3), y: 50 + r * (bh + 3), w: bw, h: bh, hp: hard ? 2 : 1, color: COLORS[r % COLORS.length] });
      }
    }
    build();

    function reset() { ball.stuck = true; ball.vx = 0; ball.vy = 0; }
    function launch() {
      if (!ball.stuck) return;
      ball.stuck = false;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
      ball.vx = Math.cos(a) * speed; ball.vy = Math.sin(a) * speed;
      api.sfx(500, 0.06, 'square', 0.04);
    }

    function update(dt, input) {
      const dir = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
      paddle.x = clamp(paddle.x + dir * 360 * dt, 0, W - paddle.w);
      if (input.hit.a || input.hit.up) launch();
      if (ball.stuck) { ball.x = paddle.x + paddle.w / 2; ball.y = paddle.y - ball.r - 1; return; }

      const steps = Math.ceil(dt / (1 / 240)), h = dt / steps;
      for (let s = 0; s < steps; s++) {
        const px = ball.x, py = ball.y;
        ball.x += ball.vx * h; ball.y += ball.vy * h;
        if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
        if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
        if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
        if (ball.vy > 0 && ball.y + ball.r >= paddle.y && ball.y + ball.r <= paddle.y + paddle.h + 6 && ball.x > paddle.x - ball.r && ball.x < paddle.x + paddle.w + ball.r) {
          const off = clamp((ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2), -1, 1);
          const a = -Math.PI / 2 + off * 1.05;
          ball.vx = Math.cos(a) * speed; ball.vy = Math.sin(a) * speed;
          ball.y = paddle.y - ball.r;
          api.sfx(320, 0.04, 'square', 0.035);
        }
        for (const b of bricks) {
          if (b.hp <= 0) continue;
          if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w && ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
            const fromSide = px + ball.r <= b.x || px - ball.r >= b.x + b.w;
            if (fromSide) ball.vx = -ball.vx; else ball.vy = -ball.vy;
            ball.x = px; ball.y = py;
            b.hp--;
            points += b.hp > 0 ? 5 : 10; api.score(points);
            api.sfx(b.hp > 0 ? 400 : 660, 0.05, 'square', 0.04);
            break;
          }
        }
        if (ball.y > H + 20) {
          lives--;
          api.sfx(150, 0.3, 'sawtooth', 0.06, -60);
          if (lives <= 0) return api.over(`Уровень ${level}`);
          reset();
          return;
        }
      }
      if (!bricks.some(b => b.hp > 0)) {
        level++; speed += 30; points += 100; api.score(points);
        api.sfx(880, 0.3, 'triangle', 0.06, 440);
        build(); reset();
      }
    }

    function draw(ctx) {
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#1c1233'); bg.addColorStop(1, '#2d1b4a');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      for (const b of bricks) {
        if (b.hp <= 0) continue;
        ctx.fillStyle = b.color; ARCADE.util.rrect(ctx, b.x, b.y, b.w, b.h, 3); ctx.fill();
        ctx.fillStyle = '#ffffff44'; ctx.fillRect(b.x + 3, b.y + 2, b.w - 6, 3);
        if (b.hp > 1) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ARCADE.util.rrect(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2, 3); ctx.stroke(); }
      }
      ctx.fillStyle = '#f3efe4'; ARCADE.util.rrect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 5); ctx.fill();
      ctx.fillStyle = '#ffcc48'; ctx.fillRect(paddle.x + 6, paddle.y + 3, paddle.w - 12, 3);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, 7); ctx.fill();
      ARCADE.util.text(ctx, '●'.repeat(Math.max(0, lives)), 10, 22, 12, '#f3efe4', 'left');
      ARCADE.util.text(ctx, 'Уровень ' + level, W - 10, 22, 12, '#b9a8e0', 'right');
      if (ball.stuck) ARCADE.util.text(ctx, 'Тап или пробел: запуск', W / 2, 390, 13, '#b9a8e0');
    }

    return {
      update, draw,
      onPointer(type, x, y, e) {
        if (type === 'move' && (e.pointerType === 'mouse' || e.buttons)) paddle.x = clamp(x - paddle.w / 2, 0, W - paddle.w);
        if (type === 'down') paddle.x = clamp(x - paddle.w / 2, 0, W - paddle.w);
      },
      demo() { ball.stuck = false; ball.x = 200; ball.y = 200; paddle.y = 214; }
    };
  }
});
