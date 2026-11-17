(function () {
  "use strict";

  /* ---------- 精灵图清单（由 _make_sprites.py 生成后内联，避免 file:// 读不到 json） ---------- */

  var CELL = 200;
  var COLS = 8;

  function repeat(n, ms) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(ms);
    return out;
  }

  var DATA = [
    { file: "a.png", durs: [40, 40, 40, 80, 80, 40, 40, 40, 80, 80, 40, 40, 80, 80, 40, 40, 40, 80, 80, 40, 40, 40] },
    { file: "b.png", durs: [80].concat(repeat(50, 40)) },
    { file: "c.png", durs: repeat(9, 40) },
    { file: "d.png", durs: repeat(4, 40) },
    { file: "e.png", durs: [80, 120, 40, 80, 40, 80, 120, 40, 40, 40, 40, 40] },
    { file: "f.png", durs: repeat(6, 40) },
    { file: "g.png", durs: [40, 80, 40, 40, 120] },
    { file: "h.png", durs: repeat(9, 40) }
  ];

  /* ---------- 元素 ---------- */

  var canvas = document.getElementById("stage");
  var ctx = canvas.getContext("2d");
  var audio = document.getElementById("audio");
  var veil = document.getElementById("veil");
  var veilSub = document.getElementById("veilSub");
  var muteBtn = document.getElementById("muteBtn");
  var replayBtn = document.getElementById("replayBtn");
  var soundOnIcon = muteBtn.querySelector(".ic-on");
  var soundOffIcon = muteBtn.querySelector(".ic-off");

  /* ---------- 参数 ---------- */

  var HEART_POINTS = 70;
  var HEART_INTERVAL = 120;
  var HEART_HOLD = 2600;
  var FILL_INTERVAL = 9;
  var FILL_MAX = 350;

  /* ---------- 状态 ---------- */

  var W = 0;
  var H = 0;
  var dpr = 1;
  var sheets = [];
  var sprites = [];
  var timers = [];
  var started = false;
  var ready = false;

  var state = {
    phase: "idle",
    spawned: 0,
    nextAt: 0,
    holdAt: 0,
    fillCount: 200
  };

  /* ---------- 精灵图 ---------- */

  function setupSheets() {
    sheets = DATA.map(function (item) {
      var cum = [];
      var acc = 0;
      item.durs.forEach(function (v) {
        acc += v;
        cum.push(acc);
      });
      return {
        img: new Image(),
        src: "assets/" + item.file,
        cum: cum,
        total: acc,
        ok: false
      };
    });
  }

  function preload(done) {
    var left = sheets.length;

    function one() {
      left -= 1;
      if (left <= 0) done();
    }

    sheets.forEach(function (sheet) {
      sheet.img.onload = function () {
        sheet.ok = true;
        one();
      };
      sheet.img.onerror = one;
      sheet.img.src = sheet.src;
    });
  }

  function frameIndex(sheet, time) {
    var t = time % sheet.total;
    for (var i = 0; i < sheet.cum.length; i++) {
      if (t < sheet.cum[i]) return i;
    }
    return 0;
  }

  /* ---------- 画布 ---------- */

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "medium";
  }

  /* ---------- 生成 ---------- */

  function addSprite(x, y, size) {
    var sheet = sheets[(Math.random() * sheets.length) | 0];
    sprites.push({
      sheet: sheet,
      x: x,
      y: y,
      size: size,
      born: performance.now() - Math.random() * 700
    });
  }

  function spawnHeartPoint(index) {
    var base = Math.min(W, H);
    var size = base / 14;
    var scale = base / 38 * 0.92;
    var theta = index / HEART_POINTS * Math.PI * 2;

    var hx = 16 * Math.pow(Math.sin(theta), 3);
    var hy = 13 * Math.cos(theta) - 5 * Math.cos(2 * theta)
      - 2 * Math.cos(3 * theta) - Math.cos(4 * theta);

    var x = W / 2 + hx * scale - size / 2;
    var y = H / 2 - hy * scale - size / 2;

    x = Math.max(-size * 0.25, Math.min(W - size * 0.75, x));
    y = Math.max(-size * 0.25, Math.min(H - size * 0.75, y));

    addSprite(x, y, size);
  }

  function spawnFillSprite() {
    var base = Math.min(W, H);
    var roll = Math.random();
    var size = base * (roll < 0.28 ? 1 / 10 : roll < 0.68 ? 1 / 8 : 1 / 6);

    var x = Math.random() * (W - size);
    var y = Math.random() * (H - size);

    addSprite(x, y, size);
  }

  function computeFillCount() {
    var area = W * H;
    state.fillCount = Math.round(Math.min(FILL_MAX, Math.max(170, area / 2700)));
  }

  function spawnTeaser() {
    sprites.length = 0;
    var base = Math.min(W, H);
    var count = W < 640 ? 12 : 20;

    for (var i = 0; i < count; i++) {
      var size = base * (0.075 + Math.random() * 0.05);
      addSprite(
        Math.random() * (W - size),
        Math.random() * (H - size),
        size
      );
    }
  }

  /* ---------- 绘制 ---------- */

  function draw(now) {
    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < sprites.length; i++) {
      var s = sprites[i];
      if (!s.sheet.ok) continue;

      var idx = frameIndex(s.sheet, now - s.born);
      var sx = (idx % COLS) * CELL;
      var sy = ((idx / COLS) | 0) * CELL;

      ctx.drawImage(s.sheet.img, sx, sy, CELL, CELL, s.x, s.y, s.size, s.size);
    }
  }

  /* ---------- 主循环 ---------- */

  function loop(now) {
    requestAnimationFrame(loop);

    if (state.phase === "heart") {
      if (now - state.nextAt > 600) state.nextAt = now;

      var guard = 0;
      while (state.spawned < HEART_POINTS && now >= state.nextAt && guard < 3) {
        spawnHeartPoint(state.spawned);
        state.spawned += 1;
        state.nextAt += HEART_INTERVAL;
        guard += 1;
      }

      if (state.spawned >= HEART_POINTS) {
        if (!state.holdAt) state.holdAt = now + HEART_HOLD;
        else if (now >= state.holdAt) {
          state.holdAt = 0;
          beginFill();
        }
      }
    } else if (state.phase === "fill") {
      if (now - state.nextAt > 600) state.nextAt = now;

      var guardFill = 0;
      while (state.spawned < state.fillCount && now >= state.nextAt && guardFill < 24) {
        spawnFillSprite();
        state.spawned += 1;
        state.nextAt += FILL_INTERVAL;
        guardFill += 1;
      }
    }

    draw(now);
  }

  function beginFill() {
    state.phase = "clear";
    canvas.classList.add("dim");

    timers.push(setTimeout(function () {
      sprites.length = 0;
      computeFillCount();
      state.phase = "fill";
      state.spawned = 0;
      state.nextAt = performance.now();
      canvas.classList.remove("dim");
    }, 360));
  }

  /* ---------- 流程控制 ---------- */

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function startShow() {
    clearTimers();
    sprites.length = 0;
    computeFillCount();

    state.phase = "heart";
    state.spawned = 0;
    state.nextAt = performance.now() + 100;
    state.holdAt = 0;

    canvas.classList.remove("dim");
  }

  function enter() {
    if (!ready || started) return;
    started = true;
    veil.classList.add("gone");

    audio.volume = 0.9;
    var attempt = audio.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(function () {});
    }

    startShow();
  }

  function replay() {
    if (!started) return;
    audio.currentTime = 0;
    var attempt = audio.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(function () {});
    }
    startShow();
  }

  function reset() {
    clearTimers();
    sprites.length = 0;
    state.phase = "idle";
    canvas.classList.remove("dim");
    started = false;

    audio.pause();
    audio.currentTime = 0;

    veil.classList.remove("gone");
    veilSub.textContent = "点击任意处开始";
    spawnTeaser();
  }

  /* ---------- 交互 ---------- */

  function syncIcons() {
    soundOnIcon.hidden = audio.muted;
    soundOffIcon.hidden = !audio.muted;
    muteBtn.setAttribute("aria-label", audio.muted ? "取消静音" : "静音");
  }

  muteBtn.addEventListener("click", function () {
    audio.muted = !audio.muted;
    syncIcons();
  });

  replayBtn.addEventListener("click", replay);

  veil.addEventListener("click", enter);

  document.addEventListener("keydown", function (e) {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;

    if (e.key === "m" || e.key === "M") {
      audio.muted = !audio.muted;
      syncIcons();
    } else if (e.key === "r" || e.key === "R") {
      replay();
    } else if (e.key === "Enter" && !veil.classList.contains("gone")) {
      enter();
    } else if (e.key === "Escape") {
      reset();
    } else if (e.code === "Space") {
      e.preventDefault();
      if (!started) enter();
      else if (audio.paused) replay();
      else audio.pause();
    }
  });

  audio.addEventListener("volumechange", syncIcons);

  /* ---------- 尺寸变化 ---------- */

  var resizeTimer = null;
  var lastW = window.innerWidth;

  window.addEventListener("resize", function () {
    resize();
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(function () {
      var widthChanged = Math.abs(window.innerWidth - lastW) > 60;
      lastW = window.innerWidth;
      resize();
      if (started && widthChanged) startShow();
    }, 260);
  });

  /* ---------- 启动 ---------- */

  resize();
  setupSheets();
  syncIcons();

  preload(function () {
    ready = true;
    veilSub.textContent = "点击任意处开始";
    spawnTeaser();
  });

  requestAnimationFrame(loop);

  if (location.hash === "#go") {
    ready = true;
    enter();
  }
})();
