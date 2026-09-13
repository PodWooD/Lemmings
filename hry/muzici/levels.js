/* Mužíčci — levely laděné na hratelnost. */

(function (global) {
  'use strict';

  function n01(x, y) {
    var n = Math.imul(x * 1597334677 ^ y * 3812015801, 1);
    n = (n ^ (n >>> 16)) >>> 0;
    return (n % 1000) / 1000;
  }

  function dirtBand(t, x, y, w, h) {
    var xx, yy, n, depth, r, g, b;
    for (yy = 0; yy < h; yy++) {
      depth = yy / Math.max(1, h - 1);
      for (xx = 0; xx < w; xx++) {
        n = n01(x + xx, y + yy);
        r = (118 + n * 36 - depth * 46) | 0;
        g = (78 + n * 22 - depth * 34) | 0;
        b = (44 + n * 14 - depth * 18) | 0;
        if (n > 0.93) { r = 150; g = 108; b = 68; }
        if (n < 0.07) { r = 72; g = 44; b = 26; }
        t.plot(x + xx, y + yy, 1, [r, g, b, 255]);
      }
    }
    for (xx = 0; xx < w; xx++) {
      n = n01(x + xx, y);
      var gh = 4 + ((n * 3) | 0);
      if (gh > h) gh = h;
      for (yy = 0; yy < gh; yy++) {
        var gn = n01(x + xx, y + yy + 3);
        r = (62 + gn * 28) | 0;
        g = (132 + gn * 40 - yy * 8) | 0;
        b = (58 + gn * 16) | 0;
        t.plot(x + xx, y + yy, 1, [r, g, b, 255]);
      }
      if (n > 0.72 && h > 6) {
        t.plot(x + xx, y + 3, 1, [48, 102, 52, 255]);
      }
    }
    for (xx = 0; xx < w; xx++) {
      t.plot(x + xx, y + Math.min(5, h - 1), 1, [168, 126, 78, 255]);
    }
    var bot = Math.max(0, h - 5);
    for (yy = bot; yy < h; yy++) {
      for (xx = 0; xx < w; xx++) {
        n = n01(x + xx, y + yy + 9);
        t.plot(x + xx, y + yy, 1, [58 + n * 18, 34 + n * 10, 20, 255]);
      }
    }
  }

  function steelBand(t, x, y, w, h) {
    var xx, yy, n;
    for (yy = 0; yy < h; yy++) {
      for (xx = 0; xx < w; xx++) {
        n = n01(x + xx, y + yy);
        var edge = xx < 2 || xx >= w - 2 || yy < 1;
        var r = edge ? 70 : 108 + n * 18;
        var g = edge ? 76 : 116 + n * 16;
        var b = edge ? 84 : 124 + n * 18;
        if (yy % 8 === 0) { r -= 18; g -= 16; b -= 14; }
        t.plot(x + xx, y + yy, 2, [r, g, b, 255]);
      }
    }
    for (yy = 6; yy < h - 4; yy += 10) {
      for (xx = 3; xx < w - 3; xx += 6) {
        t.plot(x + xx, y + yy, 2, [198, 204, 210, 255]);
        t.plot(x + xx + 1, y + yy, 2, [90, 96, 104, 255]);
      }
    }
  }

  function waterPool(t, x, y, w, h) {
    t.fillRect(x, y, w, h, 3, [28, 92, 138, 255]);
    var xx, yy, n, depth;
    for (yy = 0; yy < h; yy++) {
      depth = yy / Math.max(1, h - 1);
      for (xx = 0; xx < w; xx++) {
        n = n01(x + xx, y + yy);
        t.plot(x + xx, y + yy, 3, [
          (22 + n * 18) | 0,
          (90 - depth * 40 + n * 20) | 0,
          (140 - depth * 30 + n * 24) | 0,
          255
        ]);
      }
    }
    for (xx = 0; xx < w; xx++) {
      t.plot(x + xx, y, 3, [90, 180, 210, 255]);
      if (xx % 7 !== 0) t.plot(x + xx, y + 1, 3, [70, 150, 188, 255]);
    }
  }

  var LEVELS = [

    {
      id: 1,
      name: 'První krůčky',
      blurb: 'Kopač je vybraný. Klikni na mužíčka, prokope díru. Ostatní dírou propadnou k východu.',
      total: 6,
      need: 3,
      time: 90,
      spawnMs: 900,
      skills: { blocker: 0, builder: 0, digger: 6, basher: 0 },
      entrance: { x: 200, y: 62 },
      exit: { x: 200, y: 188 },
      paint: function (t) {
        steelBand(t, 100, 48, 12, 176);
        steelBand(t, 308, 48, 12, 176);
        dirtBand(t, 100, 120, 220, 32);
        dirtBand(t, 100, 188, 220, 36);
        dirtBand(t, 0, 420, 640, 60);
        steelBand(t, 0, 460, 640, 20);
      }
    },

    {
      id: 2,
      name: 'Most přes propast',
      blurb: 'Stavař (2) postaví most. Blokér (1) drží dav. Po mostě ho znovu klikni (skill 1) a uvolníš ho.',
      total: 8,
      need: 4,
      time: 120,
      spawnMs: 800,
      skills: { blocker: 3, builder: 16, digger: 0, basher: 0 },
      entrance: { x: 90, y: 190 },
      exit: { x: 480, y: 239 },
      paint: function (t) {
        dirtBand(t, 30, 240, 255, 44);
        dirtBand(t, 335, 240, 265, 44);
        steelBand(t, 30, 190, 12, 94);
        steelBand(t, 588, 190, 12, 94);
        dirtBand(t, 0, 420, 640, 60);
        waterPool(t, 270, 430, 80, 30);
        steelBand(t, 0, 460, 640, 20);
      }
    },

    {
      id: 3,
      name: 'Zastav a raz',
      blurb: 'Blokér (1) zastaví dav. Razíc (4) vyrazí tunel ve zdi doprava.',
      total: 10,
      need: 5,
      time: 140,
      spawnMs: 750,
      skills: { blocker: 3, builder: 0, digger: 0, basher: 6 },
      entrance: { x: 80, y: 70 },
      exit: { x: 500, y: 267 },
      paint: function (t) {
        dirtBand(t, 30, 110, 220, 32);
        steelBand(t, 30, 70, 12, 72);
        dirtBand(t, 230, 110, 70, 190);
        dirtBand(t, 300, 268, 280, 32);
        steelBand(t, 568, 230, 12, 70);
        dirtBand(t, 0, 420, 640, 60);
        steelBand(t, 0, 460, 640, 20);
      }
    },

    {
      id: 4,
      name: 'Všechno najednou',
      blurb: 'Kombinuj schopnosti. Cíl: zachránit aspoň 6 mužíčků.',
      total: 12,
      need: 6,
      time: 180,
      spawnMs: 700,
      skills: { blocker: 4, builder: 12, digger: 5, basher: 5 },
      entrance: { x: 70, y: 50 },
      exit: { x: 540, y: 299 },
      paint: function (t) {
        dirtBand(t, 40, 90, 150, 28);
        steelBand(t, 40, 55, 12, 63);
        dirtBand(t, 40, 118, 90, 100);
        dirtBand(t, 210, 180, 130, 28);
        dirtBand(t, 400, 140, 100, 28);
        dirtBand(t, 430, 168, 60, 150);
        dirtBand(t, 470, 300, 140, 36);
        steelBand(t, 590, 260, 12, 76);
        dirtBand(t, 0, 420, 640, 60);
        waterPool(t, 290, 430, 130, 30);
        steelBand(t, 0, 460, 640, 20);
      }
    }

  ];

  global.MUZICI_LEVELS = LEVELS;
})(window);
