/* Arkanoid — odpal míček, rozbij cihly. */

(function () {
  'use strict';

  var SLUG = 'arkanoid';
  var W = 640, H = 480;

  var COLS = 10, ROWS = 5;
  var BRICK_W = 50, BRICK_H = 20, GAP = 6;
  var GRID_X = (W - (COLS * BRICK_W + (COLS - 1) * GAP)) / 2;
  var GRID_Y = 64;

  var PADDLE_W = 96, PADDLE_H = 12, PADDLE_Y = H - 34;
  var BALL_R = 6;
  var SPEED_START = 290;      // px/s
  var SPEED_LEVEL = 1.08;     // zrychlení na každé další kolo
  var MAX_BOUNCE = Math.PI / 3;  // 60° od svislice
  var LIVES = 3;

  var COL_BG = '#08090b';
  var COL_WALL = '#14161a';
  var COL_PADDLE = '#ececec';
  var COL_BALL = '#ececec';
  var ROW_COLORS = ['#ff5c33', '#ff8a66', '#ffd166', '#33ff66', '#00e5ff'];

  var view = Arcade.canvas(document.getElementById('screen'), W, H);
  var ctx = view.ctx;
  var overlay = Arcade.overlay(document.getElementById('overlay'));
  var board = Arcade.scoreboard(SLUG, document.getElementById('score'), document.getElementById('best'));
  var livesEl = document.getElementById('lives');

  var paddle, ball, bricks, lives, level, speed, state, stuck;

  function reset() {
    lives = LIVES;
    level = 1;
    speed = SPEED_START;
    board.reset();
    buildBricks();
    resetPaddle();
    parkBall();
    state = 'ready';
    paintLives();
  }

  function resetPaddle() {
    paddle = { x: W / 2 - PADDLE_W / 2, w: PADDLE_W, dir: 0 };
  }

  function parkBall() {
    stuck = true;
    ball = { x: paddle.x + paddle.w / 2, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0 };
  }

  function launch() {
    if (!stuck) return;
    stuck = false;
    var angle = (Math.random() * 0.5 - 0.25) - Math.PI / 2;  // vzhůru s mírným rozptylem
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
  }

  function buildBricks() {
    bricks = [];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        bricks.push({
          x: GRID_X + c * (BRICK_W + GAP),
          y: GRID_Y + r * (BRICK_H + GAP),
          w: BRICK_W,
          h: BRICK_H,
          color: ROW_COLORS[r % ROW_COLORS.length],
          points: (ROWS - r) * 10,
          alive: true
        });
      }
    }
  }

  function remaining() {
    var n = 0;
    for (var i = 0; i < bricks.length; i++) if (bricks[i].alive) n++;
    return n;
  }

  function paintLives() {
    livesEl.textContent = lives > 0 ? lives : '0';
  }

  /* ---------- fyzika ---------- */

  function update(stepMs) {
    if (state !== 'playing') return;
    var dt = stepMs / 1000;

    if (paddle.dir) {
      paddle.x += paddle.dir * 460 * dt;
    }
    paddle.x = Math.max(8, Math.min(W - 8 - paddle.w, paddle.x));

    if (stuck) {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = PADDLE_Y - BALL_R - 1;
      return;
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // boční a horní stěna
    if (ball.x - BALL_R < 8) { ball.x = 8 + BALL_R; ball.vx = Math.abs(ball.vx); }
    if (ball.x + BALL_R > W - 8) { ball.x = W - 8 - BALL_R; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - BALL_R < 8) { ball.y = 8 + BALL_R; ball.vy = Math.abs(ball.vy); }

    // pálka
    if (ball.vy > 0 &&
        ball.y + BALL_R >= PADDLE_Y &&
        ball.y - BALL_R <= PADDLE_Y + PADDLE_H &&
        ball.x >= paddle.x - BALL_R &&
        ball.x <= paddle.x + paddle.w + BALL_R) {
      var hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      hit = Math.max(-1, Math.min(1, hit));
      var angle = hit * MAX_BOUNCE - Math.PI / 2;
      var v = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      ball.vx = Math.cos(angle) * v;
      ball.vy = Math.sin(angle) * v;
      ball.y = PADDLE_Y - BALL_R - 1;
    }

    // cihly
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (!b.alive) continue;
      if (ball.x + BALL_R < b.x || ball.x - BALL_R > b.x + b.w ||
          ball.y + BALL_R < b.y || ball.y - BALL_R > b.y + b.h) continue;

      b.alive = false;
      board.add(b.points);

      // odraz podle mělčího průniku
      var overlapX = Math.min(ball.x + BALL_R - b.x, b.x + b.w - (ball.x - BALL_R));
      var overlapY = Math.min(ball.y + BALL_R - b.y, b.y + b.h - (ball.y - BALL_R));
      if (overlapX < overlapY) ball.vx = -ball.vx;
      else ball.vy = -ball.vy;

      if (remaining() === 0) return nextLevel();
      break;
    }

    // propadnutí
    if (ball.y - BALL_R > H) loseLife();
  }

  function draw() {
    ctx.fillStyle = COL_BG;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = COL_WALL;
    ctx.fillRect(0, 0, W, 8);
    ctx.fillRect(0, 0, 8, H);
    ctx.fillRect(W - 8, 0, 8, H);

    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }

    ctx.fillStyle = COL_PADDLE;
    ctx.fillRect(paddle.x, PADDLE_Y, paddle.w, PADDLE_H);

    ctx.fillStyle = COL_BALL;
    ctx.fillRect(ball.x - BALL_R, ball.y - BALL_R, BALL_R * 2, BALL_R * 2);
  }

  var loop = Arcade.loop({
    step: 1000 / 120,
    update: update,
    render: draw,
    onHide: function () { if (state === 'playing') pause(); }
  });

  /* ---------- stavy ---------- */

  function start() {
    if (state === 'playing') return;
    if (state === 'over') return restart();
    state = 'playing';
    overlay.hide();
    loop.start();
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    overlay.show('Pauza<span>.</span>', 'MEZERNÍK — POKRAČOVAT');
  }

  function resume() {
    if (state !== 'paused') return;
    state = 'playing';
    overlay.hide();
  }

  function togglePause() {
    if (state === 'ready' || state === 'over') start();
    else if (state === 'playing') { if (stuck) launch(); else pause(); }
    else resume();
  }

  function loseLife() {
    lives--;
    paintLives();
    if (lives <= 0) return gameOver();
    resetPaddle();
    parkBall();
    overlay.show('Míček pryč<span>.</span>', 'ZBÝVÁ ' + lives + ' × ŽIVOT<br>MEZERNÍK — POKRAČOVAT');
    state = 'paused';
  }

  function nextLevel() {
    level++;
    speed *= SPEED_LEVEL;
    buildBricks();
    resetPaddle();
    parkBall();
    state = 'paused';
    overlay.show('Kolo ' + level + '<span>.</span>', 'RYCHLEJI<br>MEZERNÍK — POKRAČOVAT');
  }

  function gameOver() {
    state = 'over';
    loop.stop();
    var isNew = board.commit();
    overlay.show(
      isNew ? 'Nový rekord<span>.</span>' : 'Konec<span>.</span>',
      'SKÓRE ' + Arcade.fmt(board.get()) + ' · KOLO ' + level + '<br>MEZERNÍK NEBO R — ZNOVU'
    );
    draw();
  }

  function restart() {
    loop.stop();
    reset();
    draw();
    state = 'playing';
    overlay.hide();
    loop.start();
  }

  /* ---------- ovládání ---------- */

  Arcade.keys({
    ArrowLeft: function () { paddle.dir = -1; },
    ArrowRight: function () { paddle.dir = 1; },
    a: function () { paddle.dir = -1; },
    d: function () { paddle.dir = 1; },
    space: togglePause,
    r: restart
  });

  document.addEventListener('keyup', function (e) {
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'a' || k === 'd' || k === 'A' || k === 'D') {
      paddle.dir = 0;
    }
  });

  function pointerTo(clientX) {
    var rect = view.el.getBoundingClientRect();
    var x = (clientX - rect.left) / rect.width * W;
    paddle.x = Math.max(8, Math.min(W - 8 - paddle.w, x - paddle.w / 2));
  }

  view.el.addEventListener('mousemove', function (e) {
    if (state === 'playing') pointerTo(e.clientX);
  });

  view.el.addEventListener('touchmove', function (e) {
    if (state !== 'playing') return;
    e.preventDefault();
    pointerTo(e.touches[0].clientX);
  }, { passive: false });

  view.el.addEventListener('touchstart', function (e) {
    pointerTo(e.touches[0].clientX);
    if (state === 'ready') start();
    else if (state === 'paused') resume();
    else if (state === 'playing' && stuck) launch();
  }, { passive: true });

  view.el.addEventListener('click', function () {
    if (state === 'ready') start();
    else if (state === 'playing' && stuck) launch();
  });

  Arcade.dpad(document.getElementById('dpad'), function (dir) {
    if (state === 'ready') start();
    else if (state === 'paused') resume();
    if (dir === 'left') { paddle.dir = -1; setTimeout(function () { paddle.dir = 0; }, 120); }
    if (dir === 'right') { paddle.dir = 1; setTimeout(function () { paddle.dir = 0; }, 120); }
    if (dir === 'up' && stuck) launch();
  });

  document.getElementById('btn-new').addEventListener('click', restart);
  document.getElementById('overlay').addEventListener('click', function () {
    if (state === 'ready') start();
    else if (state === 'paused') resume();
    else if (state === 'over') restart();
  });

  reset();
  draw();
  overlay.show('Arkanoid<span>.</span>', 'MYŠ NEBO ŠIPKY · MEZERNÍK — START');
})();
