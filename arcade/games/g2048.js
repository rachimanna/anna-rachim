// 09 · 2048 — slide and merge number tiles.
ARCADE.register({
  id: 'g2048', title: '2048', genre: 'Головоломка с числами', cat: 'Головоломки', color: '#efe3c8',
  desc: 'Сдвигай плитки. Две одинаковые сливаются в одну. Доберись до плитки 2048.',
  keys: 'Стрелки или WASD сдвигают все плитки',
  touch: 'Проводи пальцем по полю в нужную сторону.',
  w: 360, h: 360, swipe: true, pad: null,

  create(api) {
    const N = 4, GAP = 10, S = (360 - GAP * 5) / 4;
    let grid = Array.from({ length: N }, () => new Array(N).fill(0));
    let pop = {}, points = 0, won = false;
    const COLORS = { 2: '#f4ead8', 4: '#efdcb4', 8: '#f5b270', 16: '#f59560', 32: '#f47b5e', 64: '#f25c3c', 128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#56c2a6', 2048: '#3e8ed0' };

    function add() {
      const empty = [];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!grid[y][x]) empty.push([x, y]);
      if (!empty.length) return;
      const [x, y] = empty[Math.floor(Math.random() * empty.length)];
      grid[y][x] = Math.random() < 0.9 ? 2 : 4;
      pop[y * N + x] = 0.15;
    }
    add(); add();

    function slide(dx, dy) {
      let moved = false, gained = 0;
      const merged = {};
      const order = [0, 1, 2, 3];
      const xs = dx > 0 ? [...order].reverse() : order, ys = dy > 0 ? [...order].reverse() : order;
      for (const y of ys) for (const x of xs) {
        const v = grid[y][x]; if (!v) continue;
        let cx = x, cy = y;
        while (true) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= N || ny >= N) break;
          const t = grid[ny][nx];
          if (!t) { grid[ny][nx] = v; grid[cy][cx] = 0; cx = nx; cy = ny; moved = true; continue; }
          if (t === v && !merged[ny * N + nx]) {
            grid[ny][nx] = v * 2; grid[cy][cx] = 0; merged[ny * N + nx] = true;
            gained += v * 2; moved = true; pop[ny * N + nx] = 0.15;
            if (v * 2 === 2048) won = true;
          }
          break;
        }
      }
      if (!moved) return;
      points += gained; api.score(points);
      api.sfx(gained ? 500 + Math.log2(gained) * 40 : 260, 0.06, 'triangle', 0.04);
      add();
      if (won) return api.over('Плитка 2048!', true);
      if (!canMove()) api.over('Ходов больше нет');
    }

    function canMove() {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const v = grid[y][x];
        if (!v) return true;
        if (x < N - 1 && grid[y][x + 1] === v) return true;
        if (y < N - 1 && grid[y + 1][x] === v) return true;
      }
      return false;
    }

    function update(dt, input) {
      for (const k in pop) { pop[k] -= dt; if (pop[k] <= 0) delete pop[k]; }
      if (input.hit.left) slide(-1, 0);
      else if (input.hit.right) slide(1, 0);
      else if (input.hit.up) slide(0, -1);
      else if (input.hit.down) slide(0, 1);
    }

    function draw(ctx) {
      ctx.fillStyle = '#bba993'; ctx.fillRect(0, 0, 360, 360);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const v = grid[y][x], px = GAP + x * (S + GAP), py = GAP + y * (S + GAP);
        ctx.fillStyle = '#cdbfa9'; ARCADE.util.rrect(ctx, px, py, S, S, 8); ctx.fill();
        if (!v) continue;
        const sc = pop[y * N + x] ? 1 + pop[y * N + x] * 0.8 : 1;
        const w = S * sc, off = (S - w) / 2;
        ctx.fillStyle = COLORS[v] || '#2d2a44'; ARCADE.util.rrect(ctx, px + off, py + off, w, w, 8); ctx.fill();
        const digits = String(v).length;
        ARCADE.util.text(ctx, String(v), px + S / 2, py + S / 2 + 2, digits < 3 ? 34 : digits < 4 ? 28 : 22, v <= 4 ? '#6b5c48' : '#fffaf0');
      }
    }

    return {
      update, draw,
      demo() { grid = [[2, 4, 8, 0], [0, 16, 32, 2], [0, 0, 128, 64], [2, 0, 4, 256]]; }
    };
  }
});
