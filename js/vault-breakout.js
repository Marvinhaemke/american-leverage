/* THE VAULT — a small token of appreciation for the curious.
   Loaded on demand only; never part of the normal page load. */
(function () {
  'use strict';

  if (window.__alVault) { window.__alVault.open(); return; }

  var COLORS = {
    bg: '#060d1c',
    panel: '#0a1428',
    line: 'rgba(231,236,245,0.18)',
    ivory: '#f3f1ea',
    silver: '#c6cedb',
    silverDim: '#9aa4b5',
    amber1: '#f2b13a',
    amber2: '#e0931c',
    champagne: '#c8a96a'
  };
  var ROW_COLORS = ['#c8a96a', '#eef2f7', '#c4cdd9', '#97a2b3', '#f2b13a'];

  var W = 720, H = 520;
  var overlay, canvas, ctx, raf = null;

  var state, ball, paddle, bricks, score, lives, level, keys = {};

  function resetBall() {
    ball = { x: paddle.x + paddle.w / 2, y: paddle.y - 9, r: 7, vx: 0, vy: 0, stuck: true };
  }

  function buildBricks() {
    bricks = [];
    var cols = 9, rows = 5, gap = 6, top = 64, side = 28;
    var bw = (W - side * 2 - gap * (cols - 1)) / cols, bh = 20;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        bricks.push({
          x: side + c * (bw + gap), y: top + r * (bh + gap),
          w: bw, h: bh, color: ROW_COLORS[r], alive: true,
          points: (rows - r) * 10
        });
      }
    }
  }

  function newGame() {
    score = 0; lives = 3; level = 1;
    paddle = { w: 110, h: 12, x: W / 2 - 55, y: H - 44, speed: 8 };
    buildBricks();
    resetBall();
    state = 'serve';
  }

  function launch() {
    if (!ball.stuck) return;
    ball.stuck = false;
    var speed = 5 + (level - 1) * 0.75;
    var ang = (-Math.PI / 2) + (Math.random() * 0.6 - 0.3);
    ball.vx = Math.cos(ang) * speed;
    ball.vy = Math.sin(ang) * speed;
  }

  function step() {
    if (keys.ArrowLeft) paddle.x -= paddle.speed;
    if (keys.ArrowRight) paddle.x += paddle.speed;
    paddle.x = Math.max(8, Math.min(W - paddle.w - 8, paddle.x));

    if (ball.stuck) {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r - 2;
      return;
    }

    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
    if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < ball.r + 36) { ball.y = ball.r + 36; ball.vy = Math.abs(ball.vy); }

    // paddle
    if (ball.vy > 0 && ball.y + ball.r >= paddle.y && ball.y + ball.r <= paddle.y + paddle.h + 8 &&
        ball.x >= paddle.x - ball.r && ball.x <= paddle.x + paddle.w + ball.r) {
      var hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2); // -1..1
      var speed = Math.hypot(ball.vx, ball.vy);
      var ang = -Math.PI / 2 + hit * (Math.PI / 3);
      ball.vx = Math.cos(ang) * speed;
      ball.vy = Math.sin(ang) * speed;
      ball.y = paddle.y - ball.r - 1;
    }

    // bricks
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (!b.alive) continue;
      if (ball.x + ball.r < b.x || ball.x - ball.r > b.x + b.w ||
          ball.y + ball.r < b.y || ball.y - ball.r > b.y + b.h) continue;
      b.alive = false;
      score += b.points;
      var overlapX = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r));
      var overlapY = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r));
      if (overlapX < overlapY) ball.vx = -ball.vx; else ball.vy = -ball.vy;
      break;
    }

    if (bricks.every(function (b) { return !b.alive; })) {
      level++;
      buildBricks();
      resetBall();
      state = 'serve';
      return;
    }

    if (ball.y - ball.r > H) {
      lives--;
      if (lives <= 0) { state = 'over'; return; }
      resetBall();
      state = 'serve';
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // header rule + HUD
    ctx.strokeStyle = COLORS.line;
    ctx.beginPath(); ctx.moveTo(0, 36); ctx.lineTo(W, 36); ctx.stroke();
    ctx.fillStyle = COLORS.silverDim;
    ctx.font = '12px "Hanken Grotesk", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE  ' + score, 16, 23);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.champagne;
    ctx.font = '600 15px "Cormorant Garamond", Georgia, serif';
    ctx.fillText('T H E   V A U L T', W / 2, 24);
    ctx.fillStyle = COLORS.silverDim;
    ctx.font = '12px "Hanken Grotesk", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('LVL ' + level + '   ' + '◆ '.repeat(Math.max(0, lives)).trim(), W - 16, 23);

    bricks.forEach(function (b) {
      if (!b.alive) return;
      ctx.fillStyle = b.color;
      roundRect(b.x, b.y, b.w, b.h, 3);
      ctx.fill();
    });

    // paddle
    var grad = ctx.createLinearGradient(0, paddle.y, 0, paddle.y + paddle.h);
    grad.addColorStop(0, COLORS.amber1);
    grad.addColorStop(1, COLORS.amber2);
    ctx.fillStyle = grad;
    roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 6);
    ctx.fill();

    // ball
    ctx.fillStyle = COLORS.ivory;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    if (state === 'serve') {
      ctx.fillStyle = COLORS.silver;
      ctx.textAlign = 'center';
      ctx.font = '13px "Hanken Grotesk", system-ui, sans-serif';
      ctx.fillText('space or click to break in', W / 2, H / 2 + 40);
    } else if (state === 'over') {
      ctx.fillStyle = 'rgba(6,13,28,0.82)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.champagne;
      ctx.font = '600 34px "Cormorant Garamond", Georgia, serif';
      ctx.fillText('VAULT SEALED', W / 2, H / 2 - 12);
      ctx.fillStyle = COLORS.silver;
      ctx.font = '13px "Hanken Grotesk", system-ui, sans-serif';
      ctx.fillText('final score ' + score + '  ·  space to try again', W / 2, H / 2 + 18);
    }
  }

  function loop() {
    if (state === 'play' || state === 'serve') step();
    draw();
    raf = requestAnimationFrame(loop);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') { close(); return; }
    keys[e.key] = true;
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (state === 'over') newGame();
      else { state = 'play'; launch(); }
    }
  }
  function onKeyUp(e) { keys[e.key] = false; }

  function onMouseMove(e) {
    var rect = canvas.getBoundingClientRect();
    var mx = (e.clientX - rect.left) / rect.width * W;
    paddle.x = Math.max(8, Math.min(W - paddle.w - 8, mx - paddle.w / 2));
  }

  function onClick() {
    if (state === 'over') newGame();
    else { state = 'play'; launch(); }
  }

  function fit() {
    var scale = Math.min(1, (window.innerWidth - 32) / W, (window.innerHeight - 32) / H);
    canvas.style.width = (W * scale) + 'px';
    canvas.style.height = (H * scale) + 'px';
  }

  function open() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(6,13,28,0.92);' +
      'display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;';

    canvas = document.createElement('canvas');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.cssText = 'border:1px solid rgba(231,236,245,0.22);border-radius:10px;' +
      'box-shadow:0 30px 80px rgba(0,0,0,0.6);background:#060d1c;cursor:none;';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var hint = document.createElement('div');
    hint.textContent = '← → or mouse  ·  esc to leave no trace';
    hint.style.cssText = 'color:#7e889a;font:12px "Hanken Grotesk",system-ui,sans-serif;letter-spacing:0.08em;';

    overlay.appendChild(canvas);
    overlay.appendChild(hint);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    newGame();
    fit();

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onClick);
    window.addEventListener('resize', fit);
    loop();
  }

  function close() {
    if (!overlay) return;
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('resize', fit);
    overlay.remove();
    overlay = null;
    document.body.style.overflow = '';
  }

  window.__alVault = { open: open, close: close };
  open();
})();
