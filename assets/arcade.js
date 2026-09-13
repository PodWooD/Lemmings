/* games.davidpolesny.cz — sdílené jádro pro všechny hry.
   Nová hra potřebuje jen vlastní logiku; skóre, rekord, smyčka,
   pauza a ovládání jsou tady. */

(function (global) {
  'use strict';

  var Arcade = {};

  /* ---------- formátování ---------- */

  Arcade.fmt = function (n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  /* ---------- rekordy (localStorage) ---------- */

  function key(slug) { return 'dp-games:' + slug + ':best'; }

  Arcade.highScore = function (slug) {
    try {
      var v = parseInt(localStorage.getItem(key(slug)), 10);
      return isFinite(v) && v > 0 ? v : 0;
    } catch (e) { return 0; }
  };

  Arcade.saveHighScore = function (slug, score) {
    if (!(score > Arcade.highScore(slug))) return false;
    try { localStorage.setItem(key(slug), String(Math.round(score))); } catch (e) {}
    return true;
  };

  /* ---------- plátno s ohledem na DPR ---------- */

  Arcade.canvas = function (el, w, h) {
    var ctx = el.getContext('2d');

    function resize() {
      var dpr = Math.min(global.devicePixelRatio || 1, 2);
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    }

    resize();
    global.addEventListener('resize', resize);

    return { ctx: ctx, width: w, height: h, el: el, resize: resize };
  };

  /* ---------- smyčka s pevným krokem ---------- */

  Arcade.loop = function (opts) {
    var step = opts.step || 1000 / 60;
    var update = opts.update;
    var render = opts.render;
    var running = false;
    var raf = null;
    var last = 0;
    var acc = 0;

    function frame(now) {
      if (!running) return;
      raf = global.requestAnimationFrame(frame);
      var dt = now - last;
      last = now;
      // po přepnutí záložky nedoháněj hodiny skokem
      if (dt > 250) dt = step;
      acc += dt;
      var guard = 0;
      while (acc >= step && guard < 8) { update(step); acc -= step; guard++; }
      if (guard >= 8) acc = 0;
      render();
    }

    var api = {
      start: function () {
        if (running) return;
        running = true;
        last = global.performance.now();
        acc = 0;
        raf = global.requestAnimationFrame(frame);
      },
      stop: function () {
        running = false;
        if (raf) global.cancelAnimationFrame(raf);
        raf = null;
      },
      isRunning: function () { return running; },
      setStep: function (ms) { step = ms; },
      renderOnce: function () { render(); }
    };

    // pauza při odchodu ze záložky, ať hra neběží naslepo
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && running && opts.onHide) opts.onHide();
    });

    return api;
  };

  /* ---------- klávesnice ---------- */

  Arcade.keys = function (map) {
    function norm(e) {
      var k = e.key;
      if (k === ' ' || k === 'Spacebar') return 'space';
      if (k && k.length === 1) return k.toLowerCase();
      return k;
    }
    document.addEventListener('keydown', function (e) {
      var fn = map[norm(e)];
      if (fn) { e.preventDefault(); fn(e); }
    });
  };

  /* ---------- swipe na dotykových displejích ---------- */

  Arcade.swipe = function (el, handler) {
    var x0 = 0, y0 = 0, active = false;

    el.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0];
      x0 = t.clientX; y0 = t.clientY; active = true;
    }, { passive: true });

    el.addEventListener('touchend', function (e) {
      if (!active) return;
      active = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      handler(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    }, { passive: true });
  };

  /* ---------- křížový ovladač pro mobil ---------- */

  Arcade.dpad = function (root, handler) {
    if (!root) return;
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-dir]');
      if (!btn) return;
      handler(btn.getAttribute('data-dir'));
    });
  };

  /* ---------- překryv (start / pauza / konec) ---------- */

  Arcade.overlay = function (el) {
    var titleEl = el.querySelector('[data-overlay-title]');
    var subEl = el.querySelector('[data-overlay-sub]');
    return {
      show: function (title, sub) {
        titleEl.innerHTML = title;
        subEl.innerHTML = sub || '';
        el.hidden = false;
      },
      hide: function () { el.hidden = true; },
      visible: function () { return !el.hidden; }
    };
  };

  /* ---------- deska se skóre ---------- */

  Arcade.scoreboard = function (slug, scoreEl, bestEl) {
    var best = Arcade.highScore(slug);
    var score = 0;

    function paintBest() { bestEl.textContent = best ? Arcade.fmt(best) : '—'; }
    function paintScore() { scoreEl.textContent = Arcade.fmt(score); }

    paintBest();
    paintScore();

    return {
      get: function () { return score; },
      best: function () { return best; },
      add: function (n) { score += n; paintScore(); },
      reset: function () { score = 0; paintScore(); },
      commit: function () {
        var isNew = Arcade.saveHighScore(slug, score);
        if (isNew) { best = score; paintBest(); }
        return isNew;
      }
    };
  };

  global.Arcade = Arcade;
})(window);
