/* Mužíčci — moderní Lemmings-like puzzle (2026 look). */

(function () {
  'use strict';

  var SLUG = 'muzici';
  var W = 640, H = 480;
  var STEP_MS = 50;
  var SPLAT_FALL = 100;
  var WALK_SPEED = 1.05;
  var FALL_SPEED = 2.4;
  var BUILD_BRICKS = 28;
  var DIG_RATE = 1;
  var BASH_RATE = 2;
  var UNIT_H = 11;
  var HIT_R = 30;
  var CHAR_SCALE = 0.68;
  var STEP_UP = 3;
  var STEP_DOWN = 4;

  var SKILL_KEYS = ['blocker', 'builder', 'digger', 'basher'];
  var SKILL_LABEL = {
    blocker: 'Blokér', builder: 'Stavař', digger: 'Kopač', basher: 'Razíc'
  };
  var JOB_COLOR = {
    walk: '#7CFFB2', fall: '#FF8A66', block: '#FFD166',
    build: '#FFB020', dig: '#E07840', bash: '#5EB0FF'
  };
  var JOB_TAG = {
    walk: null, fall: 'PADÁ', block: 'BLOKÉR',
    build: 'STAVAŘ', dig: 'KOPAČ', bash: 'RAZÍC'
  };

  var BRICK = [0xc4, 0x8a, 0x52, 255];
  var fx = [];
  var floaters = [];
  var caveRocks = [];
  var stalactites = [];
  var toast = null;
  var toastT = 0;
  var nowMs = 0;

  /* ---------- terrain ---------- */

  function createTerrain(w, h) {
    var solid = new Uint8Array(w * h);
    var rgba = new Uint8ClampedArray(w * h * 4);
    var dirty = true;
    var waterRects = [];
    var off = document.createElement('canvas');
    off.width = w; off.height = h;
    var offCtx = off.getContext('2d');
    offCtx.imageSmoothingEnabled = false;

    function idx(x, y) { return (y | 0) * w + (x | 0); }
    function inBounds(x, y) { return x >= 0 && y >= 0 && x < w && y < h; }

    function setCell(x, y, type, color) {
      if (!inBounds(x, y)) return;
      var i = idx(x, y);
      solid[i] = type;
      var o = i * 4;
      if (type === 0) {
        rgba[o] = rgba[o + 1] = rgba[o + 2] = rgba[o + 3] = 0;
      } else {
        rgba[o] = color[0]; rgba[o + 1] = color[1];
        rgba[o + 2] = color[2]; rgba[o + 3] = color[3];
      }
      dirty = true;
    }

    function fillRect(x, y, rw, rh, type, color) {
      var x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
      var x1 = Math.min(w, (x + rw) | 0), y1 = Math.min(h, (y + rh) | 0);
      if (type === 3 && x1 > x0 && y1 > y0) {
        waterRects.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      }
      for (var yy = y0; yy < y1; yy++)
        for (var xx = x0; xx < x1; xx++) setCell(xx, yy, type, color);
    }

    function clearRect(x, y, rw, rh, onlyDirt) {
      var x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
      var x1 = Math.min(w, (x + rw) | 0), y1 = Math.min(h, (y + rh) | 0);
      for (var yy = y0; yy < y1; yy++) {
        for (var xx = x0; xx < x1; xx++) {
          var t = solid[idx(xx, yy)];
          if (t === 0 || t === 3) continue;
          if (onlyDirt && t === 2) continue;
          setCell(xx, yy, 0, null);
        }
      }
    }

    function isSolid(x, y) {
      if (!inBounds(x, y)) return true;
      var t = solid[idx(x, y)];
      return t === 1 || t === 2;
    }
    function isSteel(x, y) { return inBounds(x, y) && solid[idx(x, y)] === 2; }
    function isWater(x, y) { return inBounds(x, y) && solid[idx(x, y)] === 3; }
    function hasGround(x, y) { return isSolid(x, y + 1); }

    function wallAhead(x, y, dir) {
      var nx = x + dir * 4;
      for (var dy = -UNIT_H + 2; dy <= -2; dy++) {
        if (isSolid(nx, y + dy)) return true;
      }
      return false;
    }

    function draw(ctx) {
      if (dirty) {
        offCtx.clearRect(0, 0, w, h);
        offCtx.putImageData(new ImageData(rgba, w, h), 0, 0);
        for (var yy = 1; yy < h - 1; yy++) {
          for (var xx = 0; xx < w; xx++) {
            var i = idx(xx, yy);
            var t = solid[i];
            if (t !== 1 && t !== 2) continue;
            if (solid[idx(xx, yy - 1)] !== 0) continue;
            offCtx.fillStyle = t === 2 ? 'rgba(210,220,230,.28)' : 'rgba(196, 220, 140,.32)';
            offCtx.fillRect(xx, yy, 1, 2);
            for (var k = 1; k <= 4; k++) {
              if (yy + k >= h || solid[idx(xx, yy + k)] !== 0) break;
              offCtx.fillStyle = 'rgba(6,8,10,' + (0.28 - k * 0.05) + ')';
              offCtx.fillRect(xx, yy + k, 1, 1);
            }
          }
        }
        dirty = false;
      }
      ctx.drawImage(off, 0, 0);
    }

    function drawWater(ctx, t) {
      for (var i = 0; i < waterRects.length; i++) {
        var r = waterRects[i];
        var g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
        g.addColorStop(0, 'rgba(120, 190, 210, .18)');
        g.addColorStop(0.35, 'rgba(40, 110, 140, .08)');
        g.addColorStop(1, 'rgba(12, 40, 58, .28)');
        ctx.fillStyle = g;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = 'rgba(180, 230, 240, .45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        var y0 = r.y + 2 + Math.sin(t / 280) * 1.2;
        ctx.moveTo(r.x, y0);
        for (var x = r.x; x <= r.x + r.w; x += 6) {
          ctx.lineTo(x, r.y + 2 + Math.sin(t / 280 + x / 14) * 1.4);
        }
        ctx.stroke();
      }
    }

    return {
      fillRect: fillRect, clearRect: clearRect, plot: setCell,
      isSolid: isSolid, isSteel: isSteel, isWater: isWater,
      hasGround: hasGround, wallAhead: wallAhead,
      draw: draw, drawWater: drawWater
    };
  }

  /* ---------- DOM ---------- */

  var view = Arcade.canvas(document.getElementById('screen'), W, H);
  var ctx = view.ctx;
  var overlay = Arcade.overlay(document.getElementById('overlay'));
  var board = Arcade.scoreboard(SLUG, document.getElementById('score'), document.getElementById('best'));
  var elSaved = document.getElementById('saved');
  var elTime = document.getElementById('time');
  var elLevel = document.getElementById('level-name');
  var elSpeed = document.getElementById('btn-speed');
  var skillsRoot = document.getElementById('skills');

  var levels = window.MUZICI_LEVELS || [];
  var levelIndex = 0;
  var level, terrain, men;
  var spawned, saved, timeLeft, spawnAcc;
  var selectedSkill, skillLeft;
  var state, speedMul = 1, hoverMan = null, baselineScore = 0;
  var cursor = { x: 0, y: 0, on: false };

  for (var fi = 0; fi < 52; fi++) {
    floaters.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.75,
      r: 0.4 + Math.random() * 1.4,
      s: 0.08 + Math.random() * 0.22,
      a: 0.05 + Math.random() * 0.1
    });
  }
  for (var ri = 0; ri < 7; ri++) {
    caveRocks.push({
      x: ri * 96 - 20,
      y: 300 + (ri % 3) * 18,
      w: 140 + (ri * 17) % 80,
      h: 90
    });
  }
  for (var si = 0; si < 16; si++) {
    stalactites.push({
      x: 18 + si * 40 + (si % 3) * 6,
      w: 5 + (si % 4) * 2,
      h: 16 + (si * 13) % 34
    });
  }

  function fmtTime(sec) {
    var s = Math.max(0, Math.ceil(sec));
    var m = (s / 60) | 0, r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function firstAvailableSkill() {
    for (var i = 0; i < SKILL_KEYS.length; i++) {
      if (skillLeft[SKILL_KEYS[i]] > 0) return SKILL_KEYS[i];
    }
    return null;
  }

  function showToast(msg) {
    toast = msg;
    toastT = 90;
  }

  function paintHud() {
    elSaved.textContent = saved + '/' + level.need;
    elTime.textContent = fmtTime(timeLeft);
    elLevel.textContent = level.id + ' · ' + level.name;
    SKILL_KEYS.forEach(function (k) {
      var btn = skillsRoot.querySelector('[data-skill="' + k + '"]');
      if (!btn) return;
      var n = skillLeft[k] || 0;
      btn.querySelector('[data-count]').textContent = String(n);
      btn.disabled = n <= 0;
      btn.setAttribute('aria-pressed', selectedSkill === k ? 'true' : 'false');
    });
  }

  function selectSkill(skill) {
    if (skill && (skillLeft[skill] || 0) <= 0) return;
    selectedSkill = skill;
    paintHud();
  }

  function showReady() {
    overlay.show(
      level.name,
      level.blurb +
      '<br><br>Zachraň <b>' + level.need + '</b> z <b>' + level.total +
      '</b> · klik / mezerník = start'
    );
  }

  function loadLevel(i, opts) {
    opts = opts || {};
    levelIndex = Math.max(0, Math.min(levels.length - 1, i));
    level = levels[levelIndex];
    terrain = createTerrain(W, H);
    level.paint(terrain);
    men = [];
    fx = [];
    spawned = 0;
    saved = 0;
    timeLeft = level.time;
    spawnAcc = 0;
    skillLeft = {
      blocker: level.skills.blocker | 0,
      builder: level.skills.builder | 0,
      digger: level.skills.digger | 0,
      basher: level.skills.basher | 0
    };
    selectedSkill = firstAvailableSkill();
    state = 'ready';
    hoverMan = null;
    if (opts.resetRun) baselineScore = 0;
    board.reset();
    board.add(baselineScore);
    paintHud();
    showReady();
    loop.renderOnce();
  }

  function startPlay() {
    if (state === 'ready' || state === 'paused') {
      state = 'playing';
      overlay.hide();
      // první mužíček hned, ať je na co kliknout
      if (spawned === 0 && level.total > 0) spawnMan();
    }
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      overlay.show('Pauza', 'Mezerník = pokračovat · R = znovu');
    } else if (state === 'paused' || state === 'ready') {
      startPlay();
    }
  }

  /* ---------- units ---------- */

  function spawnMan() {
    var e = level.entrance;
    men.push({
      x: e.x + (Math.random() * 6 - 3),
      y: e.y,
      dir: 1,
      job: 'fall',
      fall: 0,
      timer: 0,
      bricks: 0,
      gone: false,
      frame: Math.random() * 20 | 0
    });
    spawned++;
  }

  function assignSkill(man, skill) {
    if (!man || man.gone) return false;
    if (!skill || (skillLeft[skill] || 0) <= 0) {
      // výjimka: uvolnění blokéra i při 0 zbývajících
      if (!(man.job === 'block' && skill === 'blocker')) return false;
    }
    if (man.job === 'exit') return false;

    // klik na blokéra se skill blocker = uvolnit (nemáme bomber)
    if (man.job === 'block') {
      if (skill === 'blocker') {
        man.job = 'walk';
        man.dir = 1;
        skillLeft.blocker = (skillLeft.blocker || 0) + 1;
        showToast('Blokér uvolněn');
        spawnFx(man.x, man.y - 12, '#FFD166', 6);
        paintHud();
        return true;
      }
      showToast('Blokéra uvolníš skill 1');
      return false;
    }

    if (man.job === skill) {
      showToast('Už tohle dělá');
      return false;
    }

    skillLeft[skill]--;
    if (skill === 'blocker') {
      if (!terrain.hasGround(man.x | 0, man.y | 0)) {
        skillLeft[skill]++;
        showToast('Blokér jen na zemi');
        return false;
      }
      man.job = 'block';
      man.dir = 0;
    } else if (skill === 'builder') {
      man.job = 'build';
      man.bricks = BUILD_BRICKS;
      man.timer = 0;
      if (!man.dir) man.dir = 1;
    } else if (skill === 'digger') {
      if (!terrain.hasGround(man.x | 0, man.y | 0)) {
        skillLeft[skill]++;
        showToast('Kopač jen na zemi');
        return false;
      }
      man.job = 'dig';
      man.timer = 0;
      while (terrain.isSolid(man.x | 0, man.y | 0)) man.y--;
    } else if (skill === 'basher') {
      man.job = 'bash';
      man.timer = 0;
      if (!man.dir) man.dir = 1;
    }
    if ((skillLeft[skill] || 0) <= 0 && selectedSkill === skill) {
      selectedSkill = firstAvailableSkill();
    }
    spawnFx(man.x, man.y - 12, JOB_COLOR[man.job] || '#fff', 6);
    paintHud();
    return true;
  }

  function kill(man) {
    if (man.gone) return;
    man.gone = true;
    man.job = 'dead';
    spawnFx(man.x, man.y - 4, '#ff5c33', 8);
  }

  function saveMan(man) {
    if (man.gone) return;
    man.gone = true;
    man.job = 'exit';
    saved++;
    board.add(100);
    spawnFx(man.x, man.y - 10, '#3de0ff', 10);
    paintHud();
  }

  function blockersNear(x, y, exclude) {
    for (var i = 0; i < men.length; i++) {
      var m = men[i];
      if (m === exclude || m.gone || m.job !== 'block') continue;
      if (Math.abs(m.x - x) < 10 && Math.abs(m.y - y) < 14) return m;
    }
    return null;
  }

  function atExit(man) {
    var ex = level.exit;
    return Math.abs(man.x - ex.x) < 22 && Math.abs(man.y - ex.y) < 24;
  }

  function aliveCount() {
    var n = 0;
    for (var i = 0; i < men.length; i++) if (!men[i].gone) n++;
    return n;
  }

  function ejectFromTerrain(man) {
    var guard = 0;
    while (terrain.isSolid(man.x | 0, man.y | 0) && man.y > 0 && guard++ < 48) man.y--;
  }

  function landMan(man) {
    man.job = 'walk';
    man.fall = 0;
    var x = man.x | 0;
    var y = Math.min(H - 2, Math.max(0, man.y | 0));
    var guard = 0;
    while (y < H - 1 && !terrain.hasGround(x, y) && guard++ < H) y++;
    guard = 0;
    while (y > 0 && terrain.isSolid(x, y) && guard++ < 48) y--;
    man.y = y;
  }

  function brokeThrough(x, y) {
    if (terrain.hasGround(x | 0, y | 0)) return false;
    for (var dy = 1; dy <= 14; dy++) {
      if (terrain.isSolid(x | 0, (y + dy) | 0)) return false;
    }
    return true;
  }

  function spawnFx(x, y, color, n) {
    for (var i = 0; i < (n || 4); i++) {
      fx.push({
        x: x + Math.random() * 8 - 4,
        y: y + Math.random() * 6 - 3,
        vx: Math.random() * 1.6 - 0.8,
        vy: -Math.random() * 2 - 0.5,
        life: 20 + (Math.random() * 16 | 0),
        color: color,
        r: 1.2 + Math.random() * 2
      });
    }
  }

  function updateFx() {
    for (var i = fx.length - 1; i >= 0; i--) {
      var p = fx[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life--;
      if (p.life <= 0) fx.splice(i, 1);
    }
    if (toastT > 0) toastT--;
  }

  function updateMan(man) {
    if (man.gone) return;
    man.frame++;

    if (terrain.isWater(man.x | 0, man.y | 0) || terrain.isWater(man.x | 0, (man.y - 4) | 0)) {
      kill(man); return;
    }
    if (man.y > H + 24) { kill(man); return; }
    if (atExit(man) && man.job !== 'block') { saveMan(man); return; }

    if (man.job === 'block') {
      if (!terrain.hasGround(man.x | 0, man.y | 0)) {
        man.job = 'fall'; man.fall = 0; man.dir = 1;
      }
      return;
    }

    if (man.job === 'dig') {
      man.timer++;
      if (man.timer % DIG_RATE === 0) {
        var gx = man.x | 0, gy = (man.y + 1) | 0;
        if (terrain.isSteel(gx, gy) || terrain.isSteel(gx, gy + 2)) {
          landMan(man);
        } else {
          terrain.clearRect(gx - 7, gy, 15, 5, true);
          man.y += 3;
          spawnFx(man.x, man.y, '#a07048', 4);
          if (brokeThrough(man.x | 0, man.y | 0)) {
            man.job = 'fall';
            man.fall = 0;
          }
        }
      }
      return;
    }

    if (man.job === 'bash') {
      man.timer++;
      if (man.timer % BASH_RATE === 0) {
        var bdir = man.dir || 1;
        var bx = (man.x + bdir * 6) | 0;
        var by = (man.y - 8) | 0;
        if (terrain.isSteel(bx, by) || terrain.isSteel(bx, man.y | 0)) {
          man.job = 'walk';
        } else if (!terrain.wallAhead(man.x | 0, man.y | 0, bdir)) {
          man.x += bdir * WALK_SPEED;
          if (!terrain.hasGround(man.x | 0, man.y | 0)) {
            man.job = 'fall'; man.fall = 0;
          } else if (man.timer > 50) man.job = 'walk';
        } else {
          terrain.clearRect(bx - 1, by, 5, 14, true);
          man.x += bdir * 1.4;
          spawnFx(man.x + bdir * 5, man.y - 6, '#8a6040', 3);
        }
      }
      return;
    }

    if (man.job === 'build') {
      man.timer++;
      if (man.timer % 5 === 0 && man.bricks > 0) {
        var d = man.dir || 1;
        var sx = (man.x + d * 4) | 0;
        var sy = man.y | 0;
        // schod: 8×2 — walkři po něm vyjdou po 1 px
        terrain.fillRect(sx, sy - 1, 8, 2, 1, BRICK);
        man.x += d * 4;
        man.y -= 1;
        man.bricks--;
        spawnFx(sx + 3, sy - 2, '#d09050', 2);
        if (man.bricks <= 0) man.job = 'walk';
        if (terrain.isSolid((man.x + d * 2) | 0, (man.y - UNIT_H) | 0)) {
          man.dir = -d;
          man.job = 'walk';
        }
      }
      if (man.job === 'build') return;
      // došly cihly / narazil — pokračuj walk/fall logikou níž
    }

    if (!terrain.hasGround(man.x | 0, man.y | 0)) {
      // malý schod dolů (schody stavaře) — nepadat
      var dropped = false;
      for (var sd = 1; sd <= STEP_DOWN; sd++) {
        if (terrain.hasGround(man.x | 0, (man.y + sd) | 0)) {
          man.y += sd;
          dropped = true;
          break;
        }
      }
      if (!dropped) {
        man.job = 'fall';
        man.y += FALL_SPEED;
        man.fall += FALL_SPEED;
        return;
      }
    }

    if (man.job === 'fall') {
      if (man.fall >= SPLAT_FALL) { kill(man); return; }
      landMan(man);
    } else if (terrain.isSolid(man.x | 0, man.y | 0)) {
      landMan(man);
    }

    man.job = 'walk';
    var dir = man.dir || 1;

    // Originál Lemmings: otáčka jen u zdi / blokéra.
    // Okraj a díra = pád, ne otočka.
    if (blockersNear(man.x + dir * 7, man.y, man)) {
      man.dir = -dir; dir = man.dir;
    }
    if (terrain.wallAhead(man.x | 0, man.y | 0, dir)) {
      man.dir = -dir; dir = man.dir;
    }

    // výšlap po schodech po 1 px (ne skok 5 — to shazuje ze schodů)
    var climbed = 0;
    while (climbed < STEP_UP &&
           terrain.isSolid((man.x + dir * 2) | 0, man.y | 0) &&
           !terrain.isSolid((man.x + dir * 2) | 0, (man.y - 1) | 0) &&
           !terrain.isSolid((man.x + dir * 2) | 0, (man.y - UNIT_H) | 0)) {
      man.y -= 1;
      climbed++;
    }

    man.x += dir * WALK_SPEED;
    if (!terrain.hasGround(man.x | 0, man.y | 0)) {
      var downOk = false;
      for (var dd = 1; dd <= STEP_DOWN; dd++) {
        if (terrain.hasGround(man.x | 0, (man.y + dd) | 0)) {
          man.y += dd;
          downOk = true;
          break;
        }
      }
      if (!downOk) {
        man.job = 'fall';
        man.fall = 0;
      }
    }
  }

  function winLevel() {
    state = 'won';
    var bonus = Math.floor(timeLeft) * 2;
    board.add(bonus);
    board.commit();
    baselineScore = board.get();
    try {
      var bestLvl = parseInt(localStorage.getItem('dp-games:muzici:level'), 10) || 0;
      if (level.id > bestLvl) localStorage.setItem('dp-games:muzici:level', String(level.id));
    } catch (e) {}
    var more = levelIndex < levels.length - 1;
    overlay.show(
      'Úroveň splněna!',
      'Uloženo ' + saved + '/' + level.total +
      (bonus ? ' · bonus za čas +' + bonus : '') +
      '<br><br>' + (more
        ? 'Mezerník / klik = další úroveň'
        : 'Hotovo! Skóre ' + Arcade.fmt(board.get()) + '<br>R = od začátku')
    );
  }

  function lose(reason) {
    state = 'lost';
    board.commit();
    overlay.show(
      'Konec úrovně',
      (reason || 'Nepovedlo se') + '<br>Uloženo ' + saved + '/' + level.need +
      '<br><br>R / Nová hra = znovu'
    );
  }

  function checkEnd() {
    if (state !== 'playing') return;
    if (saved >= level.need) { winLevel(); return; }
    if (timeLeft <= 0) { lose('Čas vypršel'); return; }
    var canStill = saved + aliveCount() + (level.total - spawned);
    if (canStill < level.need && spawned >= level.total) {
      lose('Málo mužíčků na záchranu');
    }
  }

  function update() {
    if (state !== 'playing') return;
    nowMs += STEP_MS * speedMul;

    for (var t = 0; t < speedMul; t++) {
      timeLeft -= STEP_MS / 1000;
      if (timeLeft < 0) timeLeft = 0;

      if (spawned < level.total) {
        spawnAcc += STEP_MS;
        if (spawnAcc >= level.spawnMs) {
          spawnAcc -= level.spawnMs;
          spawnMan();
        }
      }
      for (var i = 0; i < men.length; i++) updateMan(men[i]);
      updateFx();
    }
    paintHud();
    checkEnd();
  }

  /* ---------- render ---------- */

  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#171410');
    g.addColorStop(0.28, '#24201c');
    g.addColorStop(0.62, '#1c2422');
    g.addColorStop(1, '#12181a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var lantern = ctx.createRadialGradient(W * 0.52, 8, 8, W * 0.52, 70, 260);
    lantern.addColorStop(0, 'rgba(232, 168, 84, .30)');
    lantern.addColorStop(0.45, 'rgba(180, 110, 50, .10)');
    lantern.addColorStop(1, 'rgba(180, 110, 50, 0)');
    ctx.fillStyle = lantern;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#141816';
    for (var i = 0; i < caveRocks.length; i++) {
      var rk = caveRocks[i];
      ctx.beginPath();
      ctx.moveTo(rk.x, H);
      ctx.quadraticCurveTo(rk.x + rk.w * 0.3, rk.y, rk.x + rk.w * 0.55, rk.y + 20);
      ctx.quadraticCurveTo(rk.x + rk.w * 0.85, rk.y + 8, rk.x + rk.w, H);
      ctx.fill();
    }

    ctx.fillStyle = '#1a1612';
    for (i = 0; i < stalactites.length; i++) {
      var s = stalactites[i];
      ctx.beginPath();
      ctx.moveTo(s.x, 0);
      ctx.lineTo(s.x + s.w, 0);
      ctx.lineTo(s.x + s.w * 0.5, s.h);
      ctx.closePath();
      ctx.fill();
    }

    for (i = 0; i < floaters.length; i++) {
      var f = floaters[i];
      f.y -= f.s * 0.28;
      if (f.y < -4) { f.y = H * 0.7; f.x = Math.random() * W; }
      ctx.globalAlpha = f.a;
      ctx.fillStyle = '#f0e6c8';
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPortal(x, y, color, label, exit) {
    var pulse = 0.55 + 0.35 * Math.sin(nowMs / 340 + (exit ? 2.2 : 0));
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.16 * pulse;
    ctx.beginPath();
    ctx.ellipse(0, 18, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#2a2620';
    roundRect(-12, 0, 5, 24, 1.5);
    ctx.fill();
    roundRect(7, 0, 5, 24, 1.5);
    ctx.fill();
    ctx.fillStyle = '#3a342c';
    roundRect(-13, -4, 26, 7, 3);
    ctx.fill();

    var ig = ctx.createLinearGradient(0, 4, 0, 22);
    ig.addColorStop(0, color);
    ig.addColorStop(1, '#0c1014');
    ctx.globalAlpha = 0.35 + 0.45 * pulse;
    ctx.fillStyle = ig;
    roundRect(-7, 4, 14, 18, 4);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.4;
    roundRect(-7.5, 3.5, 15, 19, 4.5);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.font = '700 8px Space Grotesk, sans-serif';
    ctx.textAlign = 'center';
    var tw = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(12,10,8,.82)';
    roundRect(-tw / 2, -16, tw, 11, 4);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(label, 0, -8);

    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawMan(man) {
    if (man.gone) return;
    var job = man.job;
    var facing = man.dir >= 0 ? 1 : -1;
    if (job === 'block') facing = 1;
    var bob = job === 'walk' ? Math.sin(man.frame / 3) * 0.9 : 0;
    var swing = Math.sin(man.frame / 2.2);

    ctx.save();
    ctx.translate(man.x, man.y - bob);
    ctx.scale(facing * CHAR_SCALE, CHAR_SCALE);
    ctx.imageSmoothingEnabled = true;

    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath();
    ctx.save();
    ctx.scale(1, 0.32);
    ctx.arc(0, 5, 6.5, 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();

    if (job !== 'walk' && job !== 'fall') {
      ctx.fillStyle = JOB_COLOR[job];
      ctx.globalAlpha = 0.14;
      ctx.beginPath();
      ctx.arc(0, -9, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (hoverMan === man) {
      ctx.strokeStyle = selectedSkill ? '#ff5c33' : '#f4efe4';
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.6 / CHAR_SCALE;
      ctx.beginPath();
      ctx.arc(0, -9, 9.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    drawChibiBody(job, swing);
    drawChibiProps(job, swing);

    ctx.restore();

    var tag = JOB_TAG[job];
    if (tag) {
      ctx.save();
      ctx.font = '700 8px IBM Plex Mono, monospace';
      ctx.textAlign = 'center';
      var tw = ctx.measureText(tag).width + 8;
      var ty = man.y - 21;
      ctx.fillStyle = 'rgba(10,8,6,.86)';
      roundRect(man.x - tw / 2, ty - 8, tw, 10, 4);
      ctx.fill();
      ctx.fillStyle = JOB_COLOR[job] || '#ff5c33';
      ctx.fillText(tag, man.x, ty);
      ctx.restore();
    } else if (hoverMan === man && selectedSkill) {
      ctx.save();
      ctx.font = '700 8px IBM Plex Mono, monospace';
      ctx.textAlign = 'center';
      var hint = '+ ' + SKILL_LABEL[selectedSkill];
      var hw = ctx.measureText(hint).width + 8;
      var hy = man.y - 21;
      ctx.fillStyle = 'rgba(10,8,6,.86)';
      roundRect(man.x - hw / 2, hy - 8, hw, 10, 4);
      ctx.fill();
      ctx.fillStyle = '#ff5c33';
      ctx.fillText(hint, man.x, hy);
      ctx.restore();
    }
  }

  function drawChibiBody(job, swing) {
    var skin = '#F3D0AE';
    var shirt = '#F3EEE4';
    var pants = '#3E5FA8';
    var hair = '#3BB85A';
    if (job === 'fall') pants = '#4A6BB8';

    var leg = job === 'fall' ? 2.4 : swing * 1.7;
    ctx.fillStyle = '#1C1814';
    roundRect(-4.6, -8, 3.6, 8, 1.6); ctx.fill();
    roundRect(1, -8 + (job === 'walk' ? leg : 0), 3.6, 8, 1.6); ctx.fill();
    ctx.fillStyle = pants;
    roundRect(-4.4, -8, 3.2, 6.5, 1.4); ctx.fill();
    roundRect(1.2, -8 + (job === 'walk' ? leg : 0), 3.2, 6.5, 1.4); ctx.fill();
    ctx.fillStyle = '#2A2420';
    roundRect(-5, -1.6, 4.4, 2.2, 0.8); ctx.fill();
    roundRect(0.6, -1.6 + (job === 'walk' ? leg : 0), 4.4, 2.2, 0.8); ctx.fill();

    ctx.fillStyle = '#1C1814';
    roundRect(-5.6, -17.5, 11.2, 11.2, 3.4); ctx.fill();
    var tg = ctx.createLinearGradient(0, -17, 0, -7);
    tg.addColorStop(0, '#fffaf2');
    tg.addColorStop(1, shirt);
    ctx.fillStyle = tg;
    roundRect(-5.2, -17, 10.4, 10.4, 3); ctx.fill();
    ctx.fillStyle = pants;
    roundRect(-5.2, -10, 10.4, 4.2, 1.6); ctx.fill();

    ctx.fillStyle = skin;
    if (job === 'fall') {
      roundRect(-9.5, -20, 3.4, 2.6, 1.2); ctx.fill();
      roundRect(6.1, -20, 3.4, 2.6, 1.2); ctx.fill();
    } else if (job === 'block') {
      roundRect(-10, -14.5, 4.2, 2.8, 1.2); ctx.fill();
      roundRect(5.8, -14.5, 4.2, 2.8, 1.2); ctx.fill();
    } else {
      roundRect(-7.6, -14.5, 3, 5.4, 1.3); ctx.fill();
      roundRect(4.6, -14.5 + swing * 0.8, 3, 5.4, 1.3); ctx.fill();
    }

    ctx.fillStyle = '#1C1814';
    ctx.beginPath();
    ctx.arc(0, -21.4, 6.7, 0, Math.PI * 2);
    ctx.fill();
    var hg = ctx.createRadialGradient(-1.4, -23.2, 1, 0, -21.4, 6.4);
    hg.addColorStop(0, '#FFE4C4');
    hg.addColorStop(1, skin);
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(0, -21.4, 6.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.ellipse(0, -25.2, 6.6, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();
    roundRect(-6.4, -24.2, 12.8, 3.4, 1.6); ctx.fill();

    ctx.fillStyle = '#1A1410';
    ctx.beginPath();
    ctx.arc(-2.1, -21.2, 0.95, 0, Math.PI * 2);
    ctx.arc(2.2, -21.2, 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = job === 'fall' ? '#C04540' : '#C07A60';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (job === 'fall') ctx.arc(0, -18.8, 1.8, 0.12 * Math.PI, 0.88 * Math.PI);
    else ctx.arc(0, -18.6, 1.7, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();
  }

  function drawChibiProps(job, swing) {
    if (job === 'block') {
      ctx.fillStyle = '#E8B84A';
      roundRect(-11, -19, 22, 12, 2); ctx.fill();
      ctx.fillStyle = '#FFF1B8';
      roundRect(-9.4, -17.4, 18.8, 8.8, 1.5); ctx.fill();
      ctx.fillStyle = '#5A3A08';
      ctx.font = '700 5.5px IBM Plex Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('STOP', 0, -10.4);
    }
    if (job === 'build') {
      ctx.fillStyle = '#E8A030';
      roundRect(-6.4, -29.5, 12.8, 4.4, 1.6); ctx.fill();
      ctx.fillStyle = '#F2C056';
      roundRect(-7, -26.6, 14, 2.2, 0.8); ctx.fill();
      var lift = swing * 2.4;
      ctx.fillStyle = '#C47840';
      roundRect(5.4, -13.5 + lift, 7.2, 4.2, 1); ctx.fill();
      ctx.fillStyle = '#E09A60';
      roundRect(5.4, -14.4 + lift, 7.2, 1.3, 0.6); ctx.fill();
    }
    if (job === 'dig') {
      ctx.fillStyle = '#C45C2A';
      roundRect(-6.2, -29.2, 12.4, 4.2, 1.5); ctx.fill();
      ctx.fillStyle = '#6A3A1C';
      roundRect(-2.2, -25.4, 4.4, 1.6, 0.6); ctx.fill();
      var ang = swing * 3.2;
      ctx.strokeStyle = '#8A8A8A';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(5.6, -12);
      ctx.lineTo(7.4, -1.4 + ang);
      ctx.stroke();
      ctx.fillStyle = '#D4D4D4';
      roundRect(4.6, -1.6 + ang, 7.2, 3, 0.8); ctx.fill();
    }
    if (job === 'bash') {
      ctx.fillStyle = '#4A9AD8';
      roundRect(-6.2, -29, 12.4, 3.8, 1.5); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(4.6, -27.2);
      ctx.lineTo(10.4, -22);
      ctx.lineTo(7.2, -22);
      ctx.fill();
      var tip = 5.5 + swing * 4;
      ctx.strokeStyle = '#A8B0B8';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(5, -13.5);
      ctx.lineTo(5 + tip, -13.5);
      ctx.stroke();
      ctx.fillStyle = '#E8ECF0';
      roundRect(3.8 + tip, -16.4, 3.6, 6.2, 0.8); ctx.fill();
    }
  }

  function drawFx() {
    for (var i = 0; i < fx.length; i++) {
      var p = fx[i];
      ctx.globalAlpha = Math.max(0, p.life / 28);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawToast() {
    if (toastT <= 0 || !toast) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, toastT / 20);
    ctx.font = '600 13px Space Grotesk, sans-serif';
    ctx.textAlign = 'center';
    var tw = ctx.measureText(toast).width + 24;
    ctx.fillStyle = 'rgba(12,10,8,.92)';
    roundRect(W / 2 - tw / 2, 36, tw, 28, 10);
    ctx.fill();
    ctx.fillStyle = '#ff8a66';
    ctx.fillText(toast, W / 2, 54);
    ctx.restore();
  }

  function drawTopBar() {
    ctx.fillStyle = 'rgba(10,8,6,.72)';
    roundRect(8, 6, W - 16, 26, 10);
    ctx.fill();
    ctx.font = '12px IBM Plex Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#C4B8A8';
    ctx.fillText(
      've frontě ' + Math.max(0, level.total - spawned) +
      '  ·  na mapě ' + aliveCount() +
      '  ·  ' + speedMul + '×',
      18, 23
    );
    if (selectedSkill) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ff5c33';
      ctx.fillText(SKILL_LABEL[selectedSkill] + ': klikni na mužíčka', W - 18, 23);
    }
  }

  function drawVignette() {
    var v = ctx.createRadialGradient(W * 0.5, H * 0.42, 80, W * 0.5, H * 0.5, 420);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(8,6,4,.22)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  function render() {
    nowMs = performance.now();
    ctx.imageSmoothingEnabled = true;
    drawSky();
    terrain.draw(ctx);
    terrain.drawWater(ctx, nowMs);
    drawPortal(level.entrance.x, level.entrance.y, '#7CFF9A', 'VSTUP', false);
    drawPortal(level.exit.x, level.exit.y, '#7AD8FF', 'VÝCHOD', true);
    drawFx();
    for (var i = 0; i < men.length; i++) drawMan(men[i]);

    if (cursor.on && state === 'playing' && selectedSkill) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,92,51,.38)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, HIT_R * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    drawVignette();
    drawTopBar();
    drawToast();
  }

  /* ---------- input ---------- */

  function canvasPos(e) {
    var rect = view.el.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (W / rect.width),
      y: (e.clientY - rect.top) * (H / rect.height)
    };
  }

  function manAt(x, y) {
    var best = null, bestD = 1e9;
    for (var i = 0; i < men.length; i++) {
      var m = men[i];
      if (m.gone) continue;
      var dx = Math.abs(m.x - x);
      var inBody = y < m.y + 4 && y > m.y - 20;
      if (dx > 16 || !inBody) {
        var dy = (m.y - 10) - y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > HIT_R) continue;
        if (d < bestD) { bestD = d; best = m; }
      } else {
        if (dx < bestD) { bestD = dx; best = m; }
      }
    }
    return best;
  }

  function advanceFromWin() {
    if (levelIndex < levels.length - 1) {
      loadLevel(levelIndex + 1);
      startPlay();
    } else {
      loadLevel(0, { resetRun: true });
    }
  }

  function onPointerDown(e) {
    var p = canvasPos(e);
    cursor.x = p.x; cursor.y = p.y; cursor.on = true;

    if (state === 'ready' || state === 'paused') { startPlay(); return; }
    if (state === 'won') { advanceFromWin(); return; }
    if (state === 'lost') return;

    if (state === 'playing') {
      if (!selectedSkill) {
        showToast('Nejdřív vyber schopnost (1–4)');
        return;
      }
      var m = manAt(p.x, p.y);
      if (m) assignSkill(m, selectedSkill);
      else showToast('Klikni blíž na mužíčka');
    }
  }

  view.el.addEventListener('pointerdown', onPointerDown);
  view.el.addEventListener('touchstart', function (e) {
    if (!e.changedTouches || !e.changedTouches[0]) return;
    e.preventDefault();
    var t = e.changedTouches[0];
    onPointerDown({ clientX: t.clientX, clientY: t.clientY });
  }, { passive: false });
  view.el.addEventListener('pointermove', function (e) {
    var p = canvasPos(e);
    cursor.x = p.x; cursor.y = p.y; cursor.on = true;
    hoverMan = manAt(p.x, p.y);
  });
  view.el.addEventListener('pointerleave', function () {
    cursor.on = false; hoverMan = null;
  });

  skillsRoot.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-skill]');
    if (!btn || btn.disabled) return;
    selectSkill(btn.getAttribute('data-skill'));
  });

  document.getElementById('btn-new').addEventListener('click', function () {
    loadLevel(levelIndex);
  });

  elSpeed.addEventListener('click', function () {
    speedMul = speedMul === 1 ? 2 : speedMul === 2 ? 3 : 1;
    elSpeed.textContent = 'Rychlost ' + speedMul + '×';
  });

  Arcade.keys({
    space: function () {
      if (state === 'won') { advanceFromWin(); return; }
      if (state === 'lost') { loadLevel(levelIndex); return; }
      togglePause();
    },
    r: function () {
      loadLevel(levelIndex === 0 ? 0 : levelIndex, levelIndex === 0 ? { resetRun: true } : {});
    },
    f: function () {
      speedMul = speedMul === 1 ? 2 : speedMul === 2 ? 3 : 1;
      elSpeed.textContent = 'Rychlost ' + speedMul + '×';
    },
    '1': function () { selectSkill('blocker'); },
    '2': function () { selectSkill('builder'); },
    '3': function () { selectSkill('digger'); },
    '4': function () { selectSkill('basher'); }
  });

  var loop = Arcade.loop({
    step: STEP_MS,
    update: function () {},
    render: render,
    onHide: function () {
      if (state === 'playing') togglePause();
    }
  });

  // herní logika nezávisle na rAF (pozadí / throttling)
  setInterval(function () {
    if (state === 'playing') update();
  }, STEP_MS);

  loadLevel(0, { resetRun: true });
  loop.start();
})();
