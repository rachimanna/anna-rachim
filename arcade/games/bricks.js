// 06 · Кирпичики — falling-blocks puzzle.
ARCADE.register({
  id: 'bricks', title: 'Кирпичики', genre: 'Головоломка', cat: 'Головоломки', color: '#1f2447',
  desc: 'Собирай из падающих фигур целые ряды, чтобы они исчезали. Чем выше уровень, тем быстрее.',
  keys: '← → двигать · ↑ повернуть · ↓ быстрее · пробел уронить',
  touch: '◀ ▶ двигать, ▲ повернуть, ▼ быстрее, «Бросок» уронить фигуру вниз.',
  w: 360, h: 480, pad: { dpad: true, a: 'Бросок' }, thumbY: 1,

  create(api) {
    const COLS = 10, ROWS = 20, C = 24;
    const SHAPES = {
      I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]],
      S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]]
    };
    const COLORS = { I: '#4fd1e8', O: '#ffcc48', T: '#b06ef0', S: '#5cd67a', Z: '#f0566a', J: '#4f7cf0', L: '#f59a3c' };
    const board = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    let bag = [], piece = null, next = null, dropT = 0, lines = 0, level = 1, points = 0;
    let das = { dir: 0, t: 0 }, flash = [], flashT = 0;

    const take = () => { if (!bag.length) bag = Object.keys(SHAPES).sort(() => Math.random() - 0.5); return bag.pop(); };
    function make(k) { return { k, cells: SHAPES[k].map(c => [...c]), x: 3, y: k === 'I' ? -1 : 0 }; }

    function fits(cells, px, py) {
      return cells.every(([cx, cy]) => {
        const x = px + cx, y = py + cy;
        return x >= 0 && x < COLS && y < ROWS && (y < 0 || !board[y][x]);
      });
    }
    function spawn() {
      piece = next ? make(next) : make(take());
      next = take();
      if (!fits(piece.cells, piece.x, piece.y)) api.over(`Собрано рядов: ${lines}`);
    }
    function rotate() {
      if (piece.k === 'O') return;
      const size = piece.k === 'I' ? 4 : 3;
      const rot = piece.cells.map(([x, y]) => [size - 1 - y, x]);
      for (const off of [0, -1, 1, -2, 2]) if (fits(rot, piece.x + off, piece.y)) { piece.cells = rot; piece.x += off; api.sfx(500, 0.03, 'square', 0.03); return; }
    }
    function shift(d) { if (fits(piece.cells, piece.x + d, piece.y)) { piece.x += d; return true; } return false; }
    function lock() {
      for (const [cx, cy] of piece.cells) { const y = piece.y + cy; if (y >= 0) board[y][piece.x + cx] = piece.k; else { api.over(`Собрано рядов: ${lines}`); return; } }
      const full = [];
      for (let y = 0; y < ROWS; y++) if (board[y].every(Boolean)) full.push(y);
      if (full.length) {
        flash = full; flashT = 0.18;
        points += [0, 100, 300, 500, 800][full.length] * level;
        lines += full.length;
        level = 1 + Math.floor(lines / 10);
        api.score(points);
        api.sfx(700 + full.length * 150, 0.2, 'triangle', 0.06, 300);
        piece = null;
      } else {
        api.sfx(160, 0.05, 'square', 0.04);
        spawn();
      }
    }
    function clearFlash() {
      for (const y of flash) { board.splice(y, 1); board.unshift(new Array(COLS).fill(null)); }
      flash = [];
      spawn();
    }
    spawn();

    function update(dt, input) {
      if (flashT > 0) { flashT -= dt; if (flashT <= 0) clearFlash(); return; }
      if (!piece) return;
      if (input.hit.up) rotate();
      if (input.hit.left) { shift(-1); das = { dir: -1, t: 0.17 }; }
      if (input.hit.right) { shift(1); das = { dir: 1, t: 0.17 }; }
      const held = input.held.left ? -1 : input.held.right ? 1 : 0;
      if (held && held === das.dir) { das.t -= dt; if (das.t <= 0) { shift(held); das.t = 0.05; } } else das.dir = held;
      if (input.hit.a) {
        let d = 0; while (fits(piece.cells, piece.x, piece.y + 1)) { piece.y++; d++; }
        points += d * 2; api.score(points);
        lock(); return;
      }
      const speed = Math.max(0.06, 0.8 - (level - 1) * 0.07);
      dropT += dt * (input.held.down ? 12 : 1);
      if (dropT >= speed) {
        dropT = 0;
        if (fits(piece.cells, piece.x, piece.y + 1)) { piece.y++; if (input.held.down) { points++; api.score(points); } }
        else lock();
      }
    }

    function cell(ctx, x, y, k, alpha = 1) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS[k]; ctx.fillRect(x + 1, y + 1, C - 2, C - 2);
      ctx.fillStyle = '#ffffff55'; ctx.fillRect(x + 1, y + 1, C - 2, 4);
      ctx.fillStyle = '#00000033'; ctx.fillRect(x + 1, y + C - 5, C - 2, 4);
      ctx.globalAlpha = 1;
    }

    function draw(ctx) {
      ctx.fillStyle = '#12152e'; ctx.fillRect(0, 0, 360, 480);
      ctx.fillStyle = '#1a1e3d'; ctx.fillRect(0, 0, COLS * C, ROWS * C);
      ctx.strokeStyle = '#ffffff0d'; ctx.lineWidth = 1;
      for (let x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(x * C + 0.5, 0); ctx.lineTo(x * C + 0.5, ROWS * C); ctx.stroke(); }
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (board[y][x]) cell(ctx, x * C, y * C, board[y][x]);
      for (const y of flash) { ctx.fillStyle = '#ffffffcc'; ctx.fillRect(0, y * C, COLS * C, C); }
      if (piece) {
        let gy = piece.y; while (fits(piece.cells, piece.x, gy + 1)) gy++;
        for (const [cx, cy] of piece.cells) if (gy + cy >= 0) cell(ctx, (piece.x + cx) * C, (gy + cy) * C, piece.k, 0.2);
        for (const [cx, cy] of piece.cells) if (piece.y + cy >= 0) cell(ctx, (piece.x + cx) * C, (piece.y + cy) * C, piece.k);
      }
      const px = COLS * C + 14, t = ARCADE.util.text;
      t(ctx, 'ДАЛЬШЕ', px, 20, 11, '#8b93c9', 'left');
      if (next) for (const [cx, cy] of SHAPES[next]) cell(ctx, px + cx * C * 0.8, 36 + cy * C * 0.8, next);
      t(ctx, 'УРОВЕНЬ', px, 120, 11, '#8b93c9', 'left'); t(ctx, String(level), px, 142, 22, '#fff', 'left');
      t(ctx, 'РЯДЫ', px, 180, 11, '#8b93c9', 'left'); t(ctx, String(lines), px, 202, 22, '#fff', 'left');
    }

    return {
      update, draw,
      demo() {
        const rows = ['ZZ.OOIIII', 'SZZOOJ.LL', 'SSTTTJJJL'];
        rows.forEach((r, i) => [...r].forEach((c, x) => { if (c !== '.') board[ROWS - 3 + i][x] = c; }));
        piece.y = 13;
      }
    };
  }
});
