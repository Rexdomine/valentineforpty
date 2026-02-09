(function () {
  const yesBtn = document.getElementById('yesBtn');
  const noBtn = document.getElementById('noBtn');
  const stage = document.getElementById('choiceStage');
  const row = document.getElementById('choiceRow');
  const hearts = document.getElementById('hearts');

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  let base = null; // { stageW, stageH, noW, noH, yesCx, yesCy, noBaseLeft, noBaseTop }

  function measureBase() {
    // Force base position so measurements are consistent.
    noBtn.style.setProperty('--tx', '0px');
    noBtn.style.setProperty('--ty', '0px');

    const s = stage.getBoundingClientRect();
    const yes = yesBtn.getBoundingClientRect();
    const no = noBtn.getBoundingClientRect();

    // Stage-local positions (top-left origin at stage).
    const noBaseLeft = (no.left - s.left);
    const noBaseTop = (no.top - s.top);
    const yesCx = (yes.left - s.left) + yes.width / 2;
    const yesCy = (yes.top - s.top) + yes.height / 2;

    base = {
      stageW: s.width,
      stageH: s.height,
      noW: no.width,
      noH: no.height,
      yesCx,
      yesCy,
      noBaseLeft,
      noBaseTop,
    };
  }

  function placeNoButtonAwayFromPointer(pointerX, pointerY) {
    if (!base) measureBase();
    const wrap = stage.getBoundingClientRect();

    // Convert pointer coords to stage-local coords.
    const px = pointerX - wrap.left;
    const py = pointerY - wrap.top;

    const pad = 10;

    // Allowed translation range so the No button stays within the stage.
    const minTx = (pad - base.noBaseLeft);
    const maxTx = (wrap.width - base.noW - pad) - base.noBaseLeft;
    const minTy = (pad - base.noBaseTop);
    const maxTy = (wrap.height - base.noH - pad) - base.noBaseTop;

    // Try several random spots that are far from both pointer and the Yes button.
    const tries = 20;
    let best = { tx: rand(minTx, maxTx), ty: rand(minTy, maxTy), score: -1 };

    for (let i = 0; i < tries; i++) {
      const tx = rand(minTx, maxTx);
      const ty = rand(minTy, maxTy);

      const cx = (base.noBaseLeft + tx) + base.noW / 2;
      const cy = (base.noBaseTop + ty) + base.noH / 2;
      const dPointer = Math.hypot(cx - px, cy - py);

      // Keep some distance from the Yes button so it still looks like two options.
      const dYes = Math.hypot(cx - base.yesCx, cy - base.yesCy);

      // Score is the worst-case distance from either "threat".
      const score = Math.min(dPointer, dYes * 0.95);
      if (score > best.score) best = { tx, ty, score };
    }

    const tx = clamp(best.tx, minTx, maxTx);
    const ty = clamp(best.ty, minTy, maxTy);
    noBtn.style.setProperty('--tx', `${tx.toFixed(0)}px`);
    noBtn.style.setProperty('--ty', `${ty.toFixed(0)}px`);
  }

  function dodgeFromEvent(e) {
    const touch = e.touches && e.touches[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    placeNoButtonAwayFromPointer(clientX, clientY);
  }

  // Dodge on hover (desktop) and on touch attempt (mobile).
  noBtn.addEventListener('pointerenter', dodgeFromEvent, { passive: true });
  noBtn.addEventListener('pointerdown', function (e) {
    // Prevent click landing.
    e.preventDefault();
    dodgeFromEvent(e);
  });

  // Also dodge when the stage is approached, so it feels extra slippery.
  stage.addEventListener('pointermove', function (e) {
    const nb = noBtn.getBoundingClientRect();
    const dist = Math.hypot((nb.left + nb.width / 2) - e.clientX, (nb.top + nb.height / 2) - e.clientY);
    if (dist < 140) placeNoButtonAwayFromPointer(e.clientX, e.clientY);
  }, { passive: true });

  yesBtn.addEventListener('click', function () {
    // Mark that we have a user gesture so player page can attempt autoplay.
    try { localStorage.setItem('val_yes_clicked', String(Date.now())); } catch (_) {}
    window.location.href = './player.html';
  });

  // Ambient hearts
  const heartCount = 16;
  for (let i = 0; i < heartCount; i++) {
    const h = document.createElement('div');
    h.className = 'heart';
    const left = rand(6, 94);
    const top = rand(70, 104);
    const dur = rand(6.5, 10.5);
    const delay = rand(-8, 0);
    const size = rand(10, 20);
    h.style.left = `${left}%`;
    h.style.top = `${top}%`;
    h.style.width = `${size}px`;
    h.style.height = `${size}px`;
    h.style.animationDuration = `${dur}s`;
    h.style.animationDelay = `${delay}s`;
    hearts.appendChild(h);
  }

  // Initial placement: center-ish.
  requestAnimationFrame(() => {
    measureBase();
    // Start perfectly centered next to "Yes".
    noBtn.style.setProperty('--tx', '0px');
    noBtn.style.setProperty('--ty', '0px');
  });

  window.addEventListener('resize', () => {
    base = null;
    requestAnimationFrame(() => {
      measureBase();
    });
  }, { passive: true });
})();
