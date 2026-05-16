/* backdrop-particles.js — 2D canvas constellation. Lazy-loaded. */

let canvas = null;
let ctx = null;
let particles = [];
let rafId = 0;
let lastFrame = 0;
let resizeHandler = null;
let visHandler = null;
let mouseX = -9999;
let mouseY = -9999;
let mouseHandler = null;

const TARGET_FPS = 30;
const FRAME_MS = 1000 / TARGET_FPS;
const LINK_DIST = 130;

function init() {
  const host = document.querySelector(".backdrop-layer.is-particles");
  if (!host) return false;

  canvas = host.querySelector("canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    host.appendChild(canvas);
  }
  ctx = canvas.getContext("2d");
  if (!ctx) return false;

  resize();
  seed();
  return true;
}

function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.scale(dpr, dpr);
}

function seed() {
  const area = window.innerWidth * window.innerHeight;
  const count = Math.min(80, Math.max(28, Math.round(area / 22000)));
  particles = new Array(count).fill(0).map(() => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
    r: Math.random() * 1.4 + 0.6,
  }));
}

function step() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  ctx.clearRect(0, 0, w, h);

  // links
  for (let i = 0; i < particles.length; i++) {
    const a = particles[i];
    for (let j = i + 1; j < particles.length; j++) {
      const b = particles[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < LINK_DIST * LINK_DIST) {
        const alpha = (1 - Math.sqrt(d2) / LINK_DIST) * 0.18;
        ctx.strokeStyle = `rgba(74, 222, 128, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  // particles
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < -10) p.x = w + 10;
    if (p.x > w + 10) p.x = -10;
    if (p.y < -10) p.y = h + 10;
    if (p.y > h + 10) p.y = -10;

    // gentle pull toward cursor for nearby dots
    const dx = mouseX - p.x;
    const dy = mouseY - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 160 * 160) {
      const f = (1 - Math.sqrt(d2) / 160) * 0.04;
      p.vx += (dx / Math.max(1, Math.sqrt(d2))) * f;
      p.vy += (dy / Math.max(1, Math.sqrt(d2))) * f;
    }
    // friction
    p.vx *= 0.985;
    p.vy *= 0.985;
    // base drift floor
    if (Math.abs(p.vx) < 0.08) p.vx += (Math.random() - 0.5) * 0.04;
    if (Math.abs(p.vy) < 0.08) p.vy += (Math.random() - 0.5) * 0.04;

    ctx.fillStyle = "rgba(167, 243, 208, 0.85)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function loop(t) {
  if (t - lastFrame >= FRAME_MS) {
    lastFrame = t;
    step();
  }
  rafId = requestAnimationFrame(loop);
}

export function start() {
  if (rafId) return;
  if (!ctx && !init()) return;

  if (!resizeHandler) {
    resizeHandler = () => {
      resize();
      seed();
    };
    window.addEventListener("resize", resizeHandler, { passive: true });
  }
  if (!visHandler) {
    visHandler = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (
        document.documentElement.dataset.backdrop === "particles"
      ) {
        start();
      }
    };
    document.addEventListener("visibilitychange", visHandler);
  }
  if (!mouseHandler) {
    mouseHandler = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener("pointermove", mouseHandler, { passive: true });
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    step();
    return;
  }
  lastFrame = 0;
  rafId = requestAnimationFrame(loop);
}

export function stop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}
