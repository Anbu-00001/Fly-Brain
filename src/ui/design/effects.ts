/**
 * effects.ts
 *
 * Motion primitives, ported by hand from React Bits (reactbits.dev) to plain
 * TypeScript so they can be used without pulling React into an app whose hot
 * paths are a Web Worker, a canvas and a Three.js scene.
 *
 * LICENCE — READ BEFORE LIFTING THIS FILE INTO ANOTHER PROJECT.
 * React Bits is MIT + Commons Clause License Condition v1.0, NOT plain MIT. The
 * condition forbids selling, sublicensing or redistributing the components
 * "whether alone, in a bundle, or as a ported version". Using them inside an
 * application (this one) is expressly permitted; republishing this file as a
 * component library is not. That restriction travels with this module even
 * though the rest of this project is MIT. See NOTICE.md §4.
 *
 * The ports are deliberately conservative, because this is a scientific
 * instrument and not a landing page:
 *
 *   - Every effect honours `prefers-reduced-motion` and degrades to its final
 *     state instantly. An instrument that animates through a value the reader is
 *     trying to read is worse than one that does not animate at all.
 *   - Every effect returns a disposer. Effects attach observers and animation
 *     frames; the previous build's habit of starting loops with no way to stop
 *     them is exactly what this codebase is being repaired for.
 *   - Nothing here touches the render loop of the arena or the brain view. These
 *     are chrome. They must never compete with the simulation for frame budget.
 *
 * Ported: CountUp, DecryptedText, ShinyText, DotGrid, ClickSpark, AnimatedContent.
 */

export type Disposer = () => void;

const prefersReducedMotion = (): boolean =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Ease-out cubic: fast arrival, gentle settle. Reads as "measured", not bouncy. */
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/* ---------- CountUp ---------- */

export interface CountUpOptions {
  durationMs?: number;
  decimals?: number;
  /** Rendered before/after the number, e.g. a unit. Not animated. */
  suffix?: string;
  prefix?: string;
}

/**
 * Animates an element's text from its current numeric value to `to`.
 *
 * This is the one effect that earns its place on telemetry: a number that slides
 * carries the direction and size of a change, which a number that snaps does not.
 * It is capped short so the value is readable almost immediately.
 */
export function countUp(el: HTMLElement, to: number, opts: CountUpOptions = {}): Disposer {
  const { durationMs = 420, decimals = 0, suffix = '', prefix = '' } = opts;
  const from = parseFloat(el.dataset.countValue ?? '0') || 0;
  const render = (v: number) => {
    el.textContent = `${prefix}${v.toFixed(decimals)}${suffix}`;
  };

  el.dataset.countValue = String(to);

  if (prefersReducedMotion() || from === to) {
    render(to);
    return () => {};
  }

  let raf: number | null = null;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    render(from + (to - from) * easeOutCubic(t));
    if (t < 1) raf = requestAnimationFrame(tick);
    else raf = null;
  };
  raf = requestAnimationFrame(tick);

  return () => {
    if (raf !== null) cancelAnimationFrame(raf);
    render(to);
  };
}

/* ---------- DecryptedText ---------- */

const SCRAMBLE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&/\\<>[]{}=+*';

/**
 * Resolves text character by character out of scrambled glyphs.
 *
 * Used only for state transitions that genuinely change meaning -- the engine
 * badge switching between LIVE and RECORDED, a lesion condition being applied --
 * where a moment of illegibility marks the boundary between two readings. It is
 * never used on a number.
 */
export function decryptText(el: HTMLElement, text: string, durationMs = 560): Disposer {
  if (prefersReducedMotion()) {
    el.textContent = text;
    return () => {};
  }

  let raf: number | null = null;
  const start = performance.now();
  const chars = [...text];

  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    const settled = Math.floor(easeOutCubic(t) * chars.length);
    el.textContent = chars
      .map((c, i) => {
        if (i < settled || c === ' ') return c;
        return SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0];
      })
      .join('');
    if (t < 1) raf = requestAnimationFrame(tick);
    else {
      el.textContent = text;
      raf = null;
    }
  };
  raf = requestAnimationFrame(tick);

  return () => {
    if (raf !== null) cancelAnimationFrame(raf);
    el.textContent = text;
  };
}

/* ---------- DotGrid background ---------- */

export interface DotGridOptions {
  spacing?: number;
  dotRadius?: number;
  color?: string;
  /** Radius in px within which dots brighten toward the pointer. 0 disables. */
  influence?: number;
}

/**
 * A pointer-reactive dot lattice, drawn on a single canvas.
 *
 * This is the app's backdrop. A lattice reads as graph paper -- the surface of an
 * instrument -- and the pointer response makes the surface feel physical without
 * adding anything that competes with the data drawn on top of it. It is one
 * canvas and one pass, and it pauses when the tab is hidden.
 */
export function dotGrid(host: HTMLElement, opts: DotGridOptions = {}): Disposer {
  const { spacing = 26, dotRadius = 1.1, color = '190, 230, 255', influence = 130 } = opts;

  const canvas = document.createElement('canvas');
  canvas.className = 'fx-dotgrid';
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => canvas.remove();

  let raf: number | null = null;
  let w = 0;
  let h = 0;
  const pointer = { x: -9999, y: -9999 };
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const reduced = prefersReducedMotion();

  const resize = () => {
    const r = host.getBoundingClientRect();
    w = r.width;
    h = r.height;
    canvas.width = Math.max(1, w * dpr);
    canvas.height = Math.max(1, h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  };

  const draw = () => {
    raf = null;
    ctx.clearRect(0, 0, w, h);
    const useInfluence = influence > 0 && !reduced;
    for (let y = spacing / 2; y < h; y += spacing) {
      for (let x = spacing / 2; x < w; x += spacing) {
        let alpha = 0.16;
        let r = dotRadius;
        if (useInfluence) {
          const d = Math.hypot(x - pointer.x, y - pointer.y);
          if (d < influence) {
            const k = 1 - d / influence;
            alpha += k * 0.5;
            r += k * 1.0;
          }
        }
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, ${alpha})`;
        ctx.fill();
      }
    }
  };

  const schedule = () => {
    if (raf === null && !document.hidden) raf = requestAnimationFrame(draw);
  };

  const ac = new AbortController();
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  if (influence > 0 && !reduced) {
    window.addEventListener(
      'pointermove',
      (e) => {
        const r = host.getBoundingClientRect();
        pointer.x = e.clientX - r.left;
        pointer.y = e.clientY - r.top;
        schedule();
      },
      { signal: ac.signal, passive: true }
    );
    window.addEventListener('pointerleave', () => { pointer.x = -9999; schedule(); }, { signal: ac.signal });
  }
  resize();

  return () => {
    ac.abort();
    ro.disconnect();
    if (raf !== null) cancelAnimationFrame(raf);
    canvas.remove();
  };
}

/* ---------- ClickSpark ---------- */

/**
 * A short radial burst at the click point. Confirms that a control was hit,
 * which matters on dark surfaces where a pressed state is easy to miss.
 */
export function clickSpark(el: HTMLElement, color = 'var(--accent)'): Disposer {
  if (prefersReducedMotion()) return () => {};
  const ac = new AbortController();

  el.addEventListener(
    'click',
    (e) => {
      const rect = el.getBoundingClientRect();
      const spark = document.createElement('span');
      spark.className = 'fx-spark';
      spark.style.left = `${e.clientX - rect.left}px`;
      spark.style.top = `${e.clientY - rect.top}px`;
      spark.style.setProperty('--spark-color', color);
      el.appendChild(spark);
      spark.addEventListener('animationend', () => spark.remove(), { once: true });
    },
    { signal: ac.signal }
  );

  return () => ac.abort();
}

/* ---------- AnimatedContent ---------- */

/**
 * Reveals elements as they enter the viewport, staggered by DOM order.
 * Applied to panels on mount so a dense instrument assembles itself rather than
 * arriving all at once.
 */
export function animateOnReveal(root: HTMLElement, selector = '[data-reveal]'): Disposer {
  const targets = Array.from(root.querySelectorAll<HTMLElement>(selector));
  if (prefersReducedMotion()) {
    targets.forEach((t) => t.classList.add('is-revealed'));
    return () => {};
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        const idx = targets.indexOf(el);
        el.style.transitionDelay = `${Math.min(idx, 6) * 55}ms`;
        el.classList.add('is-revealed');
        io.unobserve(el);
      });
    },
    { threshold: 0.12 }
  );
  targets.forEach((t) => io.observe(t));
  return () => io.disconnect();
}
