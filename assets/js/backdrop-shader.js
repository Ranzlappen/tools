/* backdrop-shader.js — WebGL fragment shader: flowing plasma noise.
   Lazy-loaded only when the user selects the shader backdrop. */

let gl = null;
let canvas = null;
let program = null;
let rafId = 0;
let startTime = 0;
let resizeHandler = null;
let visHandler = null;
let lightTheme = 0.0;

const VS = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

/* Fragment shader: layered fbm-ish noise tinted with accent green.
   Cheap enough for integrated GPUs; clamps to half-resolution on mobile.
   u_light = 0.0 for dark theme, 1.0 for light theme; tints accordingly. */
const FS = `
precision mediump float;
uniform vec2  u_res;
uniform float u_time;
uniform float u_light;

float hash(vec2 p){
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i+vec2(0,0)), hash(i+vec2(1,0)), u.x),
             mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){
    v += a * noise(p);
    p *= 2.05;
    a *= 0.5;
  }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p = uv * 2.5;
  p.x *= u_res.x / u_res.y;

  float t = u_time * 0.05;
  vec2 q = vec2(fbm(p + t), fbm(p - t + 5.2));
  vec2 r = vec2(fbm(p + 1.7*q + vec2(1.7, 9.2) + 0.15*t),
                fbm(p + 1.7*q + vec2(8.3, 2.8) + 0.13*t));
  float f = fbm(p + r);

  // Dark palette
  vec3 base_d   = vec3(0.043, 0.071, 0.063);    // #0b1210
  vec3 deep_d   = vec3(0.133, 0.770, 0.369);    // #22c55e
  vec3 accent_d = vec3(0.290, 0.870, 0.502);    // #4ade80

  // Light palette (soft pastels around #16a34a / #f5f9f7)
  vec3 base_l   = vec3(0.961, 0.976, 0.969);    // #f5f9f7
  vec3 deep_l   = vec3(0.082, 0.639, 0.290);    // #15a34a-ish
  vec3 accent_l = vec3(0.706, 0.918, 0.792);    // soft green

  vec3 base   = mix(base_d,   base_l,   u_light);
  vec3 deep   = mix(deep_d,   deep_l,   u_light);
  vec3 accent = mix(accent_d, accent_l, u_light);

  vec3 col = mix(base, deep,   smoothstep(0.3, 0.7, f));
  col      = mix(col,  accent, smoothstep(0.55, 0.95, f) * 0.55);

  // soft vignette at edges
  vec2 c = uv - 0.5;
  float vig = smoothstep(0.85, 0.2, length(c));
  // Light theme: lift the corners instead of darkening them.
  col *= mix(mix(0.6, 1.0, vig), mix(1.05, 1.0, vig), u_light);

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(src, type) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn("shader compile error:", gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function init() {
  const host = document.querySelector(".backdrop-layer.is-shader");
  if (!host) return false;

  canvas = host.querySelector("canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    host.appendChild(canvas);
  }

  gl =
    canvas.getContext("webgl", { antialias: false, alpha: false }) ||
    canvas.getContext("experimental-webgl");
  if (!gl) return false;

  const vs = compile(VS, gl.VERTEX_SHADER);
  const fs = compile(FS, gl.FRAGMENT_SHADER);
  if (!vs || !fs) return false;

  program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("program link error:", gl.getProgramInfoLog(program));
    return false;
  }
  gl.useProgram(program);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  const loc = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  resize();
  return true;
}

function resize() {
  if (!canvas || !gl) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  // half-res on small/touch devices to save battery
  const scale = window.innerWidth < 800 ? 0.5 : 0.75;
  const w = Math.floor(window.innerWidth * dpr * scale);
  const h = Math.floor(window.innerHeight * dpr * scale);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
}

function frame(t) {
  if (!gl || !program) return;
  if (!startTime) startTime = t;
  const elapsed = (t - startTime) / 1000;
  gl.uniform2f(gl.getUniformLocation(program, "u_res"), canvas.width, canvas.height);
  gl.uniform1f(gl.getUniformLocation(program, "u_time"), elapsed);
  gl.uniform1f(gl.getUniformLocation(program, "u_light"), lightTheme);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  rafId = requestAnimationFrame(frame);
}

export function setTheme(theme) {
  lightTheme = theme === "light" ? 1.0 : 0.0;
  // If the shader is idle but visible, redraw a single frame so the tint
  // updates immediately (e.g. user toggles theme while paused).
  if (!rafId && gl && program && !document.hidden) {
    frame(performance.now());
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

export function start() {
  if (rafId) return;
  if (!gl && !init()) return;
  lightTheme =
    document.documentElement.getAttribute("data-theme") === "light" ? 1.0 : 0.0;
  resize();
  if (!resizeHandler) {
    resizeHandler = () => resize();
    window.addEventListener("resize", resizeHandler, { passive: true });
  }
  if (!visHandler) {
    visHandler = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (document.documentElement.dataset.backdrop === "shader") {
        start();
      }
    };
    document.addEventListener("visibilitychange", visHandler);
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // render one frame, no animation
    frame(performance.now());
    cancelAnimationFrame(rafId);
    rafId = 0;
    return;
  }
  rafId = requestAnimationFrame(frame);
}

export function stop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}
