/* Had — klasický snake na mřížce 20 × 15. */

(function () {
  'use strict';

  var SLUG = 'had';
  var COLS = 20, ROWS = 15, CELL = 32;
  var W = COLS * CELL, H = ROWS * CELL;

  var SPEED_START = 135;   // ms na tah
  var SPEED_MIN = 70;
  var SPEED_STEP = 2.5;    // zrychlení za každé snědené jablko

  var COL_BG = '#08090b';
  var COL_GRID = '#14161a';
  var COL_BODY = '#33ff66';
  var COL_HEAD = '#5cff8a';
  var COL_FOOD = '#ff5c33';

  var view = Arcade.canvas(document.getElementById('screen'), W, H);
  var ctx = view.ctx;
  var overlay = Arcade.overlay(document.getElementById('overlay'));
  var board = Arcade.scoreboard(SLUG, document.getElementById('score'), document.getElementById('best'));

  var snake, dir, queue, food, speed, state;

  function reset() {
    snake = [{ x: 8, y: 7 }, { x: 7, y: 7 }, { x: 6, y: 7 }];
    dir = { x: 1, y: 0 };
    queue = [];
    speed = SPEED_START;
    state = 'ready';
    board.reset();
    placeFood();
    loop.setStep(speed);
  }

  function placeFood() {
    var free = [];
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (!occupied(x, y)) free.push({ x: x, y: y });
      }
    }
    food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function occupied(x, y) {
    for (var i = 0; i < snake.length; i++) {
      if (snake[i].x === x && snake[i].y === y) return true;
    }
    return false;
  }

  function turn(d) {
    var last = queue.length ? queue[queue.length - 1] : dir;
    // zákaz otočky o 180° — had by najel sám do sebe
    if (d.x === -last.x && d.y === -last.y) return;
    if (d.x === last.x && d.y === last.y) return;
    if (queue.length < 2) queue.push(d);
  }

  function tick() {
    if (state !== 'playing') return;

    if (queue.length) dir = queue.shift();

    var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) return gameOver();
    // ocas se v tomto tahu posune, takže poslední článek nekolduje
    for (var i = 0; i < snake.length - 1; i++) {
      if (snake[i].x === head.x && snake[i].y === head.y) return gameOver();
    }

    snake.unshift(head);

    if (food && head.x === food.x && head.y === food.y) {
      board.add(10);
      speed = Math.max(SPEED_MIN, speed - SPEED_STEP);
      loop.setStep(speed);
      placeFood();
      if (!food) return win();
    } else {
      snake.pop();
    }
  }

  function draw() {
    ctx.fillStyle = COL_BG;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = COL_GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = CELL; x < W; x += CELL) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); }
    for (var y = CELL; y < H; y += CELL) { ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); }
    ctx.stroke();

    if (food) {
      ctx.fillStyle = COL_FOOD;
      ctx.fillRect(food.x * CELL + 5, food.y * CELL + 5, CELL - 10, CELL - 10);
    }

    for (var i = snake.length - 1; i >= 0; i--) {
      ctx.fillStyle = i === 0 ? COL_HEAD : COL_BODY;
      ctx.fillRect(snake[i].x * CELL + 2, snake[i].y * CELL + 2, CELL - 4, CELL - 4);
    }
  }

  var loop = Arcade.loop({
    step: SPEED_START,
    update: tick,
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
    else if (state === 'playing') pause();
    else resume();
  }

  function gameOver() {
    state = 'over';
    loop.stop();
    var isNew = board.commit();
    overlay.show(
      isNew ? 'Nový rekord<span>.</span>' : 'Konec<span>.</span>',
      'SKÓRE ' + Arcade.fmt(board.get()) + '<br>MEZERNÍK NEBO R — ZNOVU'
    );
    draw();
  }

  function win() {
    state = 'over';
    loop.stop();
    board.commit();
    overlay.show('Vyhráno<span>.</span>', 'ZAPLNIL JSI CELOU PLOCHU<br>SKÓRE ' + Arcade.fmt(board.get()));
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

  var DIRS = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
  };

  function steer(name) {
    if (state === 'ready') start();
    if (state === 'paused') resume();
    if (state !== 'playing') return;
    turn(DIRS[name]);
  }

  Arcade.keys({
    ArrowUp: function () { steer('up'); },
    ArrowDown: function () { steer('down'); },
    ArrowLeft: function () { steer('left'); },
    ArrowRight: function () { steer('right'); },
    w: function () { steer('up'); },
    s: function () { steer('down'); },
    a: function () { steer('left'); },
    d: function () { steer('right'); },
    space: togglePause,
    r: restart
  });

  Arcade.swipe(view.el, steer);
  Arcade.dpad(document.getElementById('dpad'), steer);
  document.getElementById('btn-new').addEventListener('click', restart);
  document.getElementById('overlay').addEventListener('click', function () {
    if (state === 'ready') start();
    else if (state === 'paused') resume();
    else if (state === 'over') restart();
  });

  reset();
  draw();
  overlay.show('Had<span>.</span>', 'ŠIPKY NEBO WASD · MEZERNÍK — START');
})();
