// Shared engine for the arcade: hub, game loop, input, overlays, records.
(() => {
  const A = window.ARCADE = { games: [], register(g) { this.games.push(g); } };

  const U = A.util = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    rand: (a, b) => a + Math.random() * (b - a),
    irand: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: arr => arr[Math.floor(Math.random() * arr.length)],
    overlap: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
    seeded(seed) {
      return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    text(ctx, s, x, y, size, color, align = 'center') {
      ctx.font = `${size}px "Russo One", "Arial Black", system-ui, sans-serif`;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(s, x, y);
    },
    rrect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  };

  const store = A.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };
  const bestOf = id => +store.get('arcade.best.' + id, 0) || 0;

  // ---------- sound ----------
  let muted = store.get('arcade.muted', '0') === '1';
  let ac = null;
  A.sfx = (freq, dur = 0.1, type = 'square', vol = 0.06, slide = 0) => {
    if (muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ac.destination);
      o.start(t); o.stop(t + dur);
    } catch {}
  };

  // ---------- input ----------
  const input = A.input = { held: {}, hit: {} };
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Space: 'a', KeyZ: 'a', KeyJ: 'a', KeyX: 'b', KeyK: 'b'
  };
  function press(k) { if (!input.held[k]) input.hit[k] = true; input.held[k] = true; }
  function release(k) { input.held[k] = false; }
  function clearInput() { input.held = {}; input.hit = {}; }

  // ---------- dom ----------
  const $ = id => document.getElementById(id);
  const hub = $('hub'), gameEl = $('game'), grid = $('grid'), filters = $('filters');
  const canvas = $('screen'), ctx = canvas.getContext('2d');
  const stage = $('stage'), overlay = $('overlay'), pad = $('pad');
  const gTitle = $('gTitle'), gScore = $('gScore'), gBest = $('gBest'), gHint = $('gHint');
  const oTitle = $('oTitle'), oBig = $('oBig'), oText = $('oText'), oGo = $('oGo');
  const muteBtn = $('mute'), pauseBtn = $('pause');
  const coarse = matchMedia('(pointer: coarse)').matches;

  let def = null, inst = null, state = 'off', score = 0, best = 0, stateAt = 0, k = 1, last = 0;

  const api = {
    score(n) { score = Math.max(0, Math.floor(n)); gScore.textContent = score; },
    add(n) { api.score(score + n); },
    get value() { return score; },
    over(title, win) { finish(title, win); },
    sfx: A.sfx
  };

  function setMute(m) {
    muted = m;
    store.set('arcade.muted', m ? '1' : '0');
    muteBtn.textContent = m ? 'Звук: выкл' : 'Звук: вкл';
  }
  setMute(muted);

  function showOverlay(title, text, btn, big) {
    oTitle.textContent = title;
    oText.textContent = text;
    oGo.textContent = btn;
    oBig.hidden = big === undefined;
    if (big !== undefined) oBig.textContent = big;
    overlay.hidden = false;
  }

  function fit() {
    if (!def) return;
    const r = stage.getBoundingClientRect();
    const availW = Math.max(100, r.width - 32), availH = Math.max(100, r.height - 20);
    const s = Math.min(availW / def.w, availH / def.h);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = Math.floor(def.w * s) + 'px';
    canvas.style.height = Math.floor(def.h * s) + 'px';
    k = s * dpr;
    canvas.width = Math.round(def.w * k);
    canvas.height = Math.round(def.h * k);
  }

  function buildPad() {
    pad.innerHTML = '';
    const p = def.pad;
    if (!coarse || !p) { pad.hidden = true; return; }
    pad.hidden = false;
    const mk = (key, label, cls, area) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'key ' + (cls || '');
      b.textContent = label;
      if (area) b.style.gridArea = area;
      const on = e => { e.preventDefault(); b.classList.add('down'); press(key); if (inst && inst.onButton) inst.onButton(key); };
      const off = e => { e.preventDefault(); b.classList.remove('down'); release(key); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointerleave', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('contextmenu', e => e.preventDefault());
      return b;
    };
    const d = document.createElement('div');
    if (p.dpad === 'lr') {
      d.className = 'dpad lr';
      d.append(mk('left', '◀'), mk('right', '▶'));
    } else if (p.dpad) {
      d.className = 'dpad';
      d.append(mk('up', '▲', '', '1 / 2'), mk('left', '◀', '', '2 / 1'), mk('right', '▶', '', '2 / 3'), mk('down', '▼', '', '3 / 2'));
    }
    const acts = document.createElement('div');
    acts.className = 'actions';
    if (p.b) acts.append(mk('b', p.b, 'act'));
    if (p.a) acts.append(mk('a', p.a, 'act'));
    pad.append(d, acts);
  }

  function open(id) {
    const g = A.games.find(x => x.id === id);
    if (!g) return;
    def = g;
    hub.hidden = true;
    gameEl.hidden = false;
    gTitle.textContent = g.title;
    gHint.textContent = g.keys;
    best = bestOf(g.id);
    gBest.textContent = best;
    buildPad();
    fit();
    newGame();
    state = 'ready';
    showOverlay(g.title, coarse && g.touch ? g.touch : g.keys, 'Играть');
    window.scrollTo(0, 0);
  }

  function newGame() {
    clearInput();
    api.score(0);
    inst = def.create(api);
  }

  function play() {
    if (state === 'over') newGame();
    clearInput();
    state = 'play';
    stateAt = performance.now();
    overlay.hidden = true;
  }

  function pause() {
    if (state !== 'play') return;
    state = 'pause';
    showOverlay('Пауза', 'Игра ждёт тебя.', 'Продолжить');
  }

  function finish(title, win) {
    if (state !== 'play') return;
    state = 'over';
    stateAt = performance.now();
    const record = score > best && score > 0;
    if (record) {
      best = score;
      store.set('arcade.best.' + def.id, best);
      gBest.textContent = best;
    }
    A.sfx(win ? 660 : 180, 0.4, win ? 'triangle' : 'sawtooth', 0.07, win ? 440 : -120);
    showOverlay(title || (win ? 'Победа!' : 'Игра окончена'),
      record ? 'Новый рекорд!' : `Рекорд: ${best}`, 'Ещё раз', score);
  }

  function close() {
    state = 'off';
    inst = null;
    def = null;
    clearInput();
    gameEl.hidden = true;
    hub.hidden = false;
    renderHub();
  }

  function confirmOverlay() {
    if (performance.now() - stateAt < 350) return;
    if (state === 'ready' || state === 'pause' || state === 'over') play();
  }

  overlay.addEventListener('pointerdown', e => { e.preventDefault(); confirmOverlay(); });
  oGo.addEventListener('click', e => { e.preventDefault(); oGo.blur(); confirmOverlay(); });
  $('back').addEventListener('click', close);
  pauseBtn.addEventListener('click', () => { pauseBtn.blur(); state === 'pause' ? play() : pause(); });
  muteBtn.addEventListener('click', () => { muteBtn.blur(); setMute(!muted); });

  window.addEventListener('keydown', e => {
    if (!def) return;
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      if (state === 'play') pause(); else if (state === 'pause') play();
      return;
    }
    if (state !== 'play') {
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); confirmOverlay(); }
      return;
    }
    const key = KEYMAP[e.code];
    if (key) { e.preventDefault(); if (!e.repeat) press(key); }
    if (inst && inst.onKey) inst.onKey(e.code);
  });
  window.addEventListener('keyup', e => { const key = KEYMAP[e.code]; if (key) release(key); });
  window.addEventListener('blur', () => { clearInput(); pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('resize', fit);

  // pointer on the game canvas
  let swipe = null;
  function toGame(e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * def.w, (e.clientY - r.top) / r.height * def.h];
  }
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    if (!def || state !== 'play') return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    const [x, y] = toGame(e);
    swipe = { x: e.clientX, y: e.clientY };
    if (def.tap) press('a');
    if (inst.onPointer) inst.onPointer('down', x, y, e);
  });
  canvas.addEventListener('pointermove', e => {
    if (!def || state !== 'play' || !inst.onPointer) return;
    const [x, y] = toGame(e);
    inst.onPointer('move', x, y, e);
  });
  const up = e => {
    if (!def || state !== 'play') return;
    if (def.tap) release('a');
    if (def.swipe && swipe) {
      const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) {
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        input.hit[dir] = true;
      }
    }
    swipe = null;
    if (inst.onPointer) { const [x, y] = toGame(e); inst.onPointer('up', x, y, e); }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min((t - last) / 1000, 1 / 20);
    last = t;
    if (!def || !inst) return;
    if (state === 'play') inst.update(dt, input);
    input.hit = {};
    if (!def) return; // the game may have been closed during update
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    inst.draw(ctx, state === 'play' ? t / 1000 : 0);
  }

  // ---------- hub ----------
  const CATS = ['Все', 'Приключения', 'Стрелялки', 'Головоломки', 'Аркады'];
  let cat = 'Все';
  try { const c = store.get('arcade.cat', 'Все'); if (CATS.includes(c)) cat = c; } catch {}

  function renderFilters() {
    filters.innerHTML = '';
    for (const c of CATS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = c;
      b.setAttribute('aria-pressed', c === cat);
      b.addEventListener('click', () => { cat = c; store.set('arcade.cat', c); renderHub(); });
      filters.append(b);
    }
  }

  const thumbs = {};
  function thumb(g) {
    if (thumbs[g.id]) return thumbs[g.id];
    const c = document.createElement('canvas');
    const tw = 320, th = 200;
    c.width = tw; c.height = th;
    const x = c.getContext('2d');
    x.fillStyle = g.color;
    x.fillRect(0, 0, tw, th);
    try {
      const fake = { score() {}, add() {}, over() {}, sfx() {}, value: 0 };
      const i = g.create(fake);
      if (i.demo) i.demo();
      const s = Math.max(tw / g.w, th / g.h);
      x.setTransform(s, 0, 0, s, (tw - g.w * s) / 2, (th - g.h * s) * (g.thumbY ?? 0.5));
      x.imageSmoothingEnabled = false;
      i.draw(x, 0);
    } catch (err) { console.error(g.id, err); }
    thumbs[g.id] = c;
    return c;
  }

  function renderHub() {
    renderFilters();
    grid.innerHTML = '';
    let total = 0;
    A.games.forEach((g, i) => {
      const b = bestOf(g.id);
      total += b;
      if (cat !== 'Все' && g.cat !== cat) return;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'card';
      card.innerHTML = `
        <div class="thumb"><span class="num">${String(i + 1).padStart(2, '0')}</span></div>
        <div class="info">
          <span class="genre"></span><h2></h2><p></p>
          <div class="foot"><span class="best"></span><span class="play">Играть ▶</span></div>
        </div>`;
      card.querySelector('.thumb').append(thumb(g));
      card.querySelector('.genre').textContent = g.genre;
      card.querySelector('h2').textContent = g.title;
      card.querySelector('p').textContent = g.desc;
      card.querySelector('.best').textContent = b ? `Рекорд: ${b}` : 'Ещё не играл';
      card.addEventListener('click', () => open(g.id));
      grid.append(card);
    });
    $('total').textContent = total;
  }

  A.boot = () => {
    renderHub();
    const id = (location.hash || '').slice(1);
    if (id && A.games.some(g => g.id === id)) open(id);
    requestAnimationFrame(t => { last = t; frame(t); });
    // fonts load after the first thumbnails; redraw them once they are ready
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { for (const key in thumbs) delete thumbs[key]; if (!def) renderHub(); });
    }
  };
})();
