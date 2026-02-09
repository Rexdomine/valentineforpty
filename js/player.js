(function () {
  const audio = document.getElementById('audio');
  const lyricsEl = document.getElementById('lyrics');
  const autoplayMsg = document.getElementById('autoplayMsg');
  const bestText = document.getElementById('bestText');

  // Custom player UI
  const pcPlay = document.getElementById('pcPlay');
  const pcSeek = document.getElementById('pcSeek');
  const pcTimeNow = document.getElementById('pcTimeNow');
  const pcTimeEnd = document.getElementById('pcTimeEnd');
  const pcIconPlay = document.getElementById('pcIconPlay');
  const pcIconPause = document.getElementById('pcIconPause');

  // Fixed lyric offset tuned for your current MP3.
  // Negative means lyrics show earlier.
  const LYRICS_OFFSET_SEC = -6.0;

  const fallbackLrc = `
[00:00.00] 
[00:02.00]Put your LRC lyrics in assets/lyrics.lrc
[00:06.00]Format like: [mm:ss.xx] your lyric line
[00:10.00]This page will highlight and scroll automatically
[00:14.00] 
`;

  function parseLrc(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    const out = [];
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line) continue;

      // Extract one or more timestamps per line.
      const matches = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]/g)];
      if (matches.length === 0) continue;

      const lyric = line.replace(/\[[^\]]+\]/g, '').trim();
      for (const m of matches) {
        const mm = Number(m[1]);
        const ss = Number(m[2]);
        const cs = m[3] ? Number(m[3].padEnd(2, '0')) : 0;
        const t = mm * 60 + ss + cs / 100;
        out.push({ t, lyric: lyric || ' ' });
      }
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }

  function applyOffset(items, offsetSec) {
    if (!offsetSec) return items;
    return items.map((it) => ({ t: Math.max(0, it.t + offsetSec), lyric: it.lyric }));
  }

  function renderLyrics(items) {
    lyricsEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    items.forEach((it, idx) => {
      const p = document.createElement('p');
      p.className = 'line';
      p.dataset.idx = String(idx);
      p.dataset.t = String(it.t);
      p.textContent = it.lyric;
      frag.appendChild(p);
    });
    lyricsEl.appendChild(frag);
  }

  function getActiveIndex(items, t) {
    // Find the last line with time <= t.
    let lo = 0;
    let hi = items.length - 1;
    let ans = 0;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (items[mid].t <= t) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  }

  function setActiveLine(idx) {
    const lines = lyricsEl.querySelectorAll('.line');
    lines.forEach((el) => {
      el.classList.remove('active');
      el.classList.remove('upNext');
    });

    const active = lines[idx];
    if (!active) return;
    active.classList.add('active');

    const next = lines[idx + 1];
    if (next) next.classList.add('upNext');

    // Center-ish scroll.
    const targetTop = active.offsetTop - (lyricsEl.clientHeight * 0.42);
    lyricsEl.scrollTop = Math.max(0, targetTop);
  }

  async function loadLyrics() {
    try {
      const res = await fetch('./assets/lyrics.lrc', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return parseLrc(text);
    } catch (_) {
      return parseLrc(fallbackLrc);
    }
  }

  let items = [];
  let rawItems = [];
  let lastIdx = -1;
  let offsetSec = LYRICS_OFFSET_SEC;

  function fmtTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  function setPlayIcon(isPlaying) {
    if (!pcIconPlay || !pcIconPause) return;
    pcIconPlay.style.display = isPlaying ? 'none' : 'block';
    pcIconPause.style.display = isPlaying ? 'block' : 'none';
    if (pcPlay) pcPlay.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');

    const viz = document.getElementById('pcViz');
    if (viz) {
      viz.style.opacity = isPlaying ? '1' : '0.55';
      viz.style.filter = isPlaying ? 'saturate(1.15)' : 'saturate(0.9)';
    }
  }

  function updateSeekUI() {
    if (!pcSeek) return;
    const dur = audio.duration || 0;
    const cur = audio.currentTime || 0;
    const max = Number(pcSeek.max) || 1000;
    const v = dur > 0 ? Math.round((cur / dur) * max) : 0;
    pcSeek.value = String(v);
    const fill = dur > 0 ? `${(cur / dur) * 100}%` : '0%';
    pcSeek.style.setProperty('--fill', fill);
    if (pcTimeNow) pcTimeNow.textContent = fmtTime(cur);
    if (pcTimeEnd) pcTimeEnd.textContent = fmtTime(dur);
  }

  function tick() {
    if (!items.length) return;
    const idx = getActiveIndex(items, audio.currentTime || 0);
    if (idx !== lastIdx) {
      lastIdx = idx;
      setActiveLine(idx);

      // Show the big text after the song has actually started moving.
      if ((audio.currentTime || 0) > 1.0) bestText.classList.add('show');
    }
  }

  function tryAutoplay() {
    // Autoplay is allowed on many browsers if navigation came from a click.
    const clicked = (() => {
      try {
        const v = localStorage.getItem('val_yes_clicked');
        return !!v;
      } catch (_) {
        return false;
      }
    })();

    if (!clicked) {
      autoplayMsg.hidden = false;
      return;
    }

    audio.play().then(() => {
      autoplayMsg.hidden = true;
    }).catch(() => {
      autoplayMsg.hidden = false;
    });
  }

  (async function init() {
    rawItems = await loadLyrics();
    items = applyOffset(rawItems, offsetSec);
    renderLyrics(items);

    if (pcPlay) {
      pcPlay.addEventListener('click', () => {
        if (audio.paused) {
          audio.play().catch(() => {
            autoplayMsg.hidden = false;
          });
        } else {
          audio.pause();
        }
      });
    }

    if (pcSeek) {
      pcSeek.addEventListener('input', () => {
        const dur = audio.duration || 0;
        const max = Number(pcSeek.max) || 1000;
        const v = Number(pcSeek.value) || 0;
        if (dur > 0) audio.currentTime = (v / max) * dur;
        updateSeekUI();
      });
    }

    audio.addEventListener('timeupdate', tick);
    audio.addEventListener('play', () => {
      autoplayMsg.hidden = true;
      // Ensure the headline animation shows even if the first lyric line doesn't change immediately.
      setTimeout(() => bestText.classList.add('show'), 700);
      setPlayIcon(true);
    });
    audio.addEventListener('pause', () => setPlayIcon(false));
    audio.addEventListener('loadedmetadata', updateSeekUI);
    audio.addEventListener('timeupdate', updateSeekUI);
    audio.addEventListener('timeupdate', () => {
      if ((audio.currentTime || 0) > 1.0) bestText.classList.add('show');
    });

    // Kick off highlighting even before play (shows first line).
    tick();
    updateSeekUI();

    // Attempt autoplay after a microtask to ensure element is ready.
    setTimeout(tryAutoplay, 0);
  })();
})();
