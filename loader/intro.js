const INTRO_DURATION = 6.0;   // one 360° emblem turn + the corner draw; the hand-off starts here
const WORDMARK_SPEED = 1.5;   // 1.0 = 6 s to fully chrome. 1.5 = 4 s. 2.0 = 3 s.
const WORDMARK_START = 0.0;   // seconds after the emblem appears
const CORNER_EASE = 'power2.in'; // corner draw: starts very slow, ends fast ('power3.in' = more contrast)

/* SILÊNCIO intro. One GSAP timeline is the clock; no timers, no extra RAF loop
   (a site using Lenis should drive it from gsap.ticker too).
   Site hooks, on window.SilencioIntro (created inline in the HTML):
     waitFor(promise)        hand-off also waits for this (≤ 3 s past the intro end)
     handoff = fn(ctx)       replace the default hand-off; return a promise/timeline
     done                    promise, resolves after the overlay is gone
   Critical hero assets can also be marked with [data-hero-critical] (img / video).
   The header logo slot is [data-intro-logo-slot]; without one the hand-off is a 0.7 s crossfade. */
(() => {
  const root = document.getElementById('sl');
  if (!root || !root.isConnected) return;
  const de = document.documentElement;
  const api = window.SilencioIntro;
  let finish;
  api.done = new Promise(r => (finish = r));

  const teardown = () => {
    root.slUnblock();
    inerted.forEach(el => (el.inert = false));
    de.classList.remove('sl-lock');
    removeEventListener('resize', fit);
    root.remove();
    gsap && gsap.ticker.lagSmoothing(500, 33); // GSAP default
    finish();
    document.dispatchEvent(new CustomEvent('silencio:intro-done'));
  };

  const gsap = window.gsap;
  if (!gsap) return teardown();
  root.slStarted = true;
  root.style.animation = 'none'; // cancel the CSS failsafe, we are in charge now
  // The videos run on wall-clock time, so the timeline must too: no lag smoothing while the intro plays.
  gsap.ticker.lagSmoothing(0);

  // Page behind: inert while the overlay is up.
  const inerted = [...document.body.children].filter(el => el !== root && el.tagName !== 'SCRIPT' && !el.inert);
  inerted.forEach(el => (el.inert = true));

  const speed = Math.min(2, Math.max(1, WORDMARK_SPEED)); // > 2 looks rushed: re-render instead
  const T = {};
  T.writeStart = WORDMARK_START + (5 / 30) / speed; // first spark, frame 6
  T.writeEnd = WORDMARK_START + 5.0 / speed;        // last letter written, frame 150
  T.coolEnd = WORDMARK_START + 6.0 / speed;
  T.turnSrc = 4.0;                                  // the emblem video: one 360° turn, 120 frames @ 30 fps
  T.emblemEnd = INTRO_DURATION;                     // played slower/faster so the turn ends front-facing here
  T.handoff = T.emblemEnd;                          // (if the wordmark ever ran longer, the hand-off waits for it)
  T.cornerIn = 0;                                   // corners draw across the whole intro…
  T.cornerEnd = T.handoff;                          // …and finish as the hand-off starts
  api.times = T;

  const mode = root.dataset.mode; // video | still | reduced
  const lockup = root.querySelector('.sl-lockup');
  const emblem = root.querySelector('.sl-emblem');
  const word = root.querySelector('.sl-word');
  const ev = emblem.querySelector('video');
  const wv = word.querySelector('video');
  const sweep = root.querySelector('.sl-sweep');
  const bg = root.querySelector('.sl-bg');

  // Ornaments: one inline copy, cloned for the second corner.
  const tpl = root.querySelector('#sl-orn').content.firstElementChild;
  const orns = ['tl', 'br'].map(c => {
    const s = tpl.cloneNode(true);
    s.classList.add('sl-orn--' + c);
    root.insertBefore(s, lockup);
    return s;
  });

  // Lockup ink box (the media frames carry transparent padding), in viewport px.
  const inkRect = () => {
    const l = lockup.getBoundingClientRect();
    const E = emblem.offsetWidth, W = word.offsetWidth, H = word.offsetHeight;
    const ex = l.left + emblem.offsetLeft, ey = l.top + emblem.offsetTop;
    const wx = l.left + word.offsetLeft, wy = l.top + word.offsetTop;
    return {
      left: Math.min(ex + E * 0.169, wx + W * 0.0746), right: Math.max(ex + E * 0.831, wx + W * 0.938),
      top: ey + E * 0.169, bottom: wy + H * 0.746,
    };
  };

  // Keep the lockup clear: shrink the ornaments, never the logo.
  const M = 12; // breathing room, px
  function fit() {
    root.style.removeProperty('--orn-fit');
    const ink = inkRect();
    let maxW = Infinity;
    const [tl, br] = orns.map(o => o.getBoundingClientRect());
    const k = 1012 / 870;
    if (tl.right > ink.left - M && tl.bottom > ink.top - M)
      maxW = Math.min(maxW, Math.max(ink.left - M - tl.left, (ink.top - M - tl.top) * k));
    if (br.left < ink.right + M && br.top < ink.bottom + M)
      maxW = Math.min(maxW, Math.max(br.right - ink.right - M, (br.bottom - ink.bottom - M) * k));
    if (maxW < Infinity) root.style.setProperty('--orn-fit', Math.max(40, Math.floor(maxW)) + 'px');
  }
  fit();
  addEventListener('resize', fit); // rotation/resize: CSS vars re-apply themselves; media + timeline untouched

  // ── reduced motion: stills, ornaments drawn, hold 1.2 s, 0.6 s fade ──
  if (mode === 'reduced') {
    gsap.delayedCall(1.2, () => whenReady(false).then(() =>
      gsap.to(root, { opacity: 0, duration: 0.6, ease: 'power1.inOut', onComplete: teardown })));
    return;
  }

  // ── media ──
  const toStill = () => {
    if (word.classList.contains('is-still')) return;
    word.classList.add('is-still');
    wv.pause();
    // reveal over whatever is left of the writing window
    const from = Math.max(tl.time(), WORDMARK_START + 0.2 / speed);
    if (from < T.writeEnd) tl.fromTo(word.querySelector('img'), { '--reveal': -8 }, { '--reveal': 100, duration: T.writeEnd - from, ease: 'none', immediateRender: true }, from);
    else gsap.set(word.querySelector('img'), { '--reveal': 100 });
  };
  const emblemStill = () => { ev.pause(); emblem.classList.remove('is-playing'); };

  let emblemEnded = mode !== 'video', wordEnded = mode !== 'video';
  let videosDone;
  const videosDonePromise = new Promise(r => (videosDone = r));
  const checkDone = () => emblemEnded && wordEnded && videosDone();
  checkDone();

  if (mode === 'video') {
    ev.muted = wv.muted = true;
    wv.defaultPlaybackRate = wv.playbackRate = speed;
    ev.defaultPlaybackRate = ev.playbackRate = T.turnSrc / T.emblemEnd;
    // Swap the inline still for the video on the first frame actually presented.
    const showFirstFrame = () => (ev.requestVideoFrameCallback
      ? ev.requestVideoFrameCallback(() => emblem.classList.add('is-playing'))
      : emblem.classList.add('is-playing'));
    ev.addEventListener('playing', showFirstFrame, { once: true });
    ev.addEventListener('ended', () => { emblemEnded = true; api.emblemEndedAt = tl.time(); checkDone(); });
    wv.addEventListener('ended', () => { wordEnded = true; checkDone(); });
    ev.addEventListener('error', () => { emblemStill(); emblemEnded = true; checkDone(); });
    wv.addEventListener('error', () => { toStill(); wordEnded = true; checkDone(); });
  }

  // ── the timeline ──
  const tl = gsap.timeline({ paused: true });
  api.timeline = tl;

  tl.to(emblem, { opacity: 1, scale: 1, duration: 0.9, ease: 'expo.out' }, 0);

  // play() and resolve once frames are actually moving (or it failed → still fallback).
  const playing = (v, fail) => new Promise(r => {
    v.addEventListener('playing', r, { once: true });
    v.addEventListener('error', () => { fail(); r(); }, { once: true });
    v.play().catch(() => { fail(); r(); });
  });
  const failEmblem = () => { emblemStill(); emblemEnded = true; checkDone(); };
  const failWord = () => { toStill(); wordEnded = true; checkDone(); };

  if (mode !== 'video') toStill();
  else if (WORDMARK_START > 0) tl.call(() => { wv.playbackRate = speed; playing(wv, failWord); }, null, WORDMARK_START);

  // Corners: strands race out of the knot, cells last. The draw is laid out on a 0→1 track and that track is
  // played with CORNER_EASE over the writing window: the busy knot draws slowly, the long arms speed up.
  const draw = gsap.timeline({ paused: true });
  orns.forEach(svg => {
    svg.querySelectorAll('path').forEach(p => {
      const len = +p.dataset.len, d = +p.dataset.delay;
      p.setAttribute('pathLength', len); // dash units follow data-len regardless of scale
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
      draw.to(p, { strokeDashoffset: 0, duration: 1 - d, ease: 'none' }, d);
    });
  });
  tl.fromTo(draw, { progress: 0 }, { progress: 1, duration: T.cornerEnd - T.cornerIn, ease: CORNER_EASE }, T.cornerIn);

  tl.call(() => whenReady(true).then(handoff), null, T.handoff);

  // ── hand-off ──
  // Hero readiness: fonts, [data-hero-critical] media, anything passed to waitFor().
  function loaded(el) {
    if (el.tagName !== 'VIDEO') return el.decode ? el.decode().catch(() => {}) : Promise.resolve();
    if (el.readyState >= 2) return Promise.resolve();
    return new Promise(r => { el.addEventListener('loadeddata', r, { once: true }); el.addEventListener('error', r, { once: true }); });
  }
  function whenReady(withVideos) {
    const all = Promise.all([
      document.fonts ? document.fonts.ready : null,
      ...[...document.querySelectorAll('[data-hero-critical]')].map(loaded),
      ...api.wait.map(p => Promise.resolve(p).catch(() => {})),
      withVideos ? videosDonePromise : null,
    ]);
    return new Promise(res => {
      let ready = false, light = null;
      const go = () => { if (ready) return; ready = true; cap.kill(); if (light) { light.kill(); gsap.to(sweep, { opacity: 0, duration: 0.3 }); } res(); };
      const cap = gsap.delayedCall(3, go); // hold at most 3 s, then hand off regardless
      all.then(go);
      // still waiting next tick → a slow, faint light sweep across the emblem
      gsap.delayedCall(0.05, () => {
        if (ready) return;
        gsap.to(sweep, { opacity: 0.6, duration: 0.6 });
        light = gsap.fromTo(sweep, { backgroundPosition: '120% 0' }, { backgroundPosition: '-20% 0', duration: 2.6, ease: 'sine.inOut', repeat: -1, repeatDelay: 0.4 });
      });
    });
  }

  function handoff() {
    const orn = orns;
    if (api.handoff) return Promise.resolve(api.handoff({ root, lockup, bg, ornaments: orn, gsap })).then(teardown);
    const slot = document.querySelector('[data-intro-logo-slot]');
    const out = gsap.timeline({ onComplete: teardown });
    const s = slot && slot.getBoundingClientRect();
    if (!s || !s.width) {
      out.to(root, { opacity: 0, duration: 0.7, ease: 'power1.inOut' });
      return;
    }
    // FLIP only the emblem onto the slot measured now (it differs per breakpoint); the wordmark leaves with the ornaments.
    // The emblem's ink is centred in its frame and 66.2% of it.
    const e = emblem.getBoundingClientRect();
    const scale = Math.min(s.width, s.height) / (e.width * 0.662);
    out.to(emblem, {
      x: s.left + s.width / 2 - (e.left + e.width / 2), y: s.top + s.height / 2 - (e.top + e.height / 2), scale,
      transformOrigin: '50% 50%', duration: 0.9, ease: 'expo.inOut',
    }, 0)
      .to(bg, { opacity: 0, duration: 0.7, ease: 'power1.inOut' }, 0)
      .to([...orn, word], { opacity: 0, duration: 0.5, ease: 'power1.out' }, 0)
      .fromTo(slot, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'none' }, 0.65)
      .to(emblem, { opacity: 0, duration: 0.25, ease: 'none' }, 0.65)
      .set(slot, { clearProps: 'opacity' });
  }

  // The clock starts once the videos are actually playing (≤ 2 s), so the corners stay in step with the writing.
  // play() is called right away: iOS ignores preload until it is.
  if (mode !== 'video') tl.play(0);
  else {
    let started = false;
    const start = () => { if (started) return; started = true; cap.kill(); tl.play(0); };
    const cap = gsap.delayedCall(2, start); // slow network: start anyway; a late video keeps its pace and the hand-off waits for it
    Promise.all([playing(ev, failEmblem), WORDMARK_START > 0 || playing(wv, failWord)]).then(start);
  }
})();
