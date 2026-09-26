// 05 · Змейка — classic snake on a 20×20 field.
ARCADE.register({
  id: 'snake', title: 'Змейка', genre: 'Классика', cat: 'Аркады', color: '#2a4d3a',
  desc: 'Ешь яблоки, расти и не врезайся в стены и в свой хвост. Золотое яблоко даёт пять очков.',
  keys: 'Стрелки или WASD поворот',
  touch: 'Проведи пальцем в нужную сторону или жми крестик.',
  w: 400, h: 400, swipe: true, pad: { dpad: true },

  create(api) {
    const N = 20, C = 20;
    let snake = [{ x: 7, y: 10 }, { x: 6, y: 10 }, { x: 5, y: 10 }];
    let dir = { x: 1, y: 0 }, queue = [], stepT = 0, delay = 0.13, points = 0, grow = 0;
    let food = null, gold = null, goldT = 0;

    function free() {
      for (;;) {
        const c = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) };
        if (!snake.some(s => s.x === c.x && s.y === c.y) && !(food && food.x === c.x && food.y === c.y)) return c;
      }
    }
    food = free();

    function turn(x, y) {
      const lastDir = queue.length ? queue[queue.length - 1] : dir;
      if (lastDir.x === -x && lastDir.y === -y) return;
      if (lastDir.x === x && lastDir.y === y) return;
      if (queue.length < 3) queue.push({ x, y });
    }

    function update(dt, input) {
      if (input.hit.up) turn(0, -1);
      if (input.hit.down) turn(0, 1);
      if (input.hit.left) turn(-1, 0);
      if (input.hit.right) turn(1, 0);
      if (gold) { goldT -= dt; if (goldT <= 0) gold = null; }
      stepT += dt;
      while (stepT >= delay) {
        stepT -= delay;
        if (queue.length) dir = queue.shift();
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        const tailFree = grow === 0;
        const body = tailFree ? snake.slice(0, -1) : snake;
        if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N || body.some(s => s.x === head.x && s.y === head.y)) {
          api.over(`Длина змейки: ${snake.length}`);
          return;
        }
        snake.unshift(head);
        if (grow > 0) grow--; else snake.pop();
        if (head.x === food.x && head.y === food.y) {
          points++; grow += 1; api.score(points);
          food = free();
          delay = Math.max(0.065, delay - 0.003);
          api.sfx(600 + points * 8, 0.08, 'square', 0.04);
          if (!gold && Math.random() < 0.2) { gold = free(); goldT = 5; }
        } else if (gold && head.x === gold.x && head.y === gold.y) {
          points += 5; grow += 3; api.score(points);
          gold = null;
          api.sfx(1200, 0.2, 'triangle', 0.06, 400);
        }
      }
    }

    function apple(ctx, c, color) {
      const x = c.x * C + C / 2, y = c.y * C + C / 2 + 1;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#4a2c12'; ctx.fillRect(x - 1, y - 11, 2, 5);
      ctx.fillStyle = '#6fd35a'; ctx.beginPath(); ctx.ellipse(x + 4, y - 9, 4, 2, -0.5, 0, 7); ctx.fill();
    }

    function draw(ctx) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#a9d65a' : '#b5de66';
        ctx.fillRect(x * C, y * C, C, C);
      }
      apple(ctx, food, '#e5433d');
      if (gold && !(goldT < 1.5 && Math.floor(goldT * 8) % 2)) apple(ctx, gold, '#ffcc48');
      snake.forEach((s, i) => {
        const t = i / snake.length;
        ctx.fillStyle = `hsl(${220 - t * 30} 70% ${48 + t * 10}%)`;
        ARCADE.util.rrect(ctx, s.x * C + 1, s.y * C + 1, C - 2, C - 2, i === 0 ? 7 : 5); ctx.fill();
      });
      const h = snake[0], hx = h.x * C + C / 2, hy = h.y * C + C / 2;
      ctx.fillStyle = '#fff';
      const ex = dir.y !== 0 ? 4 : 0, ey = dir.x !== 0 ? 4 : 0;
      ctx.beginPath(); ctx.arc(hx + dir.x * 3 + ex, hy + dir.y * 3 + ey, 3, 0, 7); ctx.arc(hx + dir.x * 3 - ex, hy + dir.y * 3 - ey, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillRect(hx + dir.x * 4 + ex - 1, hy + dir.y * 4 + ey - 1, 2, 2); ctx.fillRect(hx + dir.x * 4 - ex - 1, hy + dir.y * 4 - ey - 1, 2, 2);
    }

    return {
      update, draw,
      demo() { snake = [{ x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 }, { x: 9, y: 9 }, { x: 9, y: 10 }, { x: 8, y: 10 }]; food = { x: 15, y: 8 }; }
    };
  }
});
