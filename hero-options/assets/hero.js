/* SILÊNCIO hero options: shared motion. Slow, deliberate, nothing bouncy.
   [data-reveal]        fades and rises in, in DOM order (or data-reveal="<delay s>")
   [data-depth="k"]     drifts with the cursor; k > 0 moves with it, k < 0 against it (px at the viewport edge)
   Without JS, or with reduced motion, everything is simply visible and still. */
window.SilencioHero = (() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const api = { reduce, onMove: [] };
  if (reduce || !window.gsap) return api;
  document.documentElement.classList.add('js-motion');

  addEventListener('DOMContentLoaded', () => {
    const items = [...document.querySelectorAll('[data-reveal]')];
    items.forEach((el, i) => {
      const d = el.dataset.reveal === '' ? 0.5 + i * 0.12 : +el.dataset.reveal;
      gsap.fromTo(el, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.6, delay: d, ease: 'expo.out', clearProps: 'transform' });
    });

    if (!matchMedia('(hover: hover)').matches) return;
    const layers = [...document.querySelectorAll('[data-depth]')].map(el => ({
      k: +el.dataset.depth,
      x: gsap.quickTo(el, 'x', { duration: 1.8, ease: 'power3' }),
      y: gsap.quickTo(el, 'y', { duration: 1.8, ease: 'power3' }),
    }));
    addEventListener('pointermove', e => {
      const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
      layers.forEach(l => { l.x(nx * l.k); l.y(ny * l.k * 0.6); });
      api.onMove.forEach(f => f(e, nx, ny));
    });
  });
  return api;
})();
