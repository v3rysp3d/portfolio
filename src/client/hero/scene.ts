/*
 * "Blueprint terrain" — a wireframe topographic grid displaced by drifting
 * fbm noise, rendered as GL line segments. Hairline white lines on the ink
 * canvas with a single signal-orange elevation contour: the site's blueprint
 * identity given a third dimension. Pointer sways the camera; scroll dollies
 * it down and fades the scene as the hero exits.
 */
import { Camera, Geometry, Mesh, Program, Renderer, Transform } from 'ogl';

const COLS = 140;
const ROWS = 90;
const WIDTH = 7.2;
const DEPTH = 4.6;

const vertex = /* glsl */ `
  attribute vec3 position;

  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uScroll;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;

  varying float vElev;
  varying float vDepth;

  // Cheap hash-based value noise + 3-octave fbm — plenty for slow contours.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.55;
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p = p * 2.1 + 17.0;
      a *= 0.45;
    }
    return v;
  }

  void main() {
    vec3 pos = position;
    vec2 np = pos.xz * 0.55 + vec2(uTime * 0.03, uTime * 0.018);
    float amp = 0.85 + 0.25 * uMouse.x;
    float elev = fbm(np) * amp;
    // Swell gently around the pointer's horizontal position.
    float sway = 0.12 * uMouse.y * sin(pos.x * 0.8 + uTime * 0.2);
    pos.y += elev + sway;

    vElev = elev;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  precision highp float;

  uniform float uScroll;

  varying float vElev;
  varying float vDepth;

  void main() {
    // Hairline blueprint lines, fading with distance like a survey drawing.
    float fog = smoothstep(9.5, 3.0, vDepth);
    vec3 lineColor = vec3(1.0);
    float alpha = 0.10 * fog;

    // One orange elevation contour band sweeps upward as the hero exits.
    float band = 0.52 + uScroll * 0.5;
    float d = abs(vElev - band);
    float contour = smoothstep(0.05, 0.0, d);
    lineColor = mix(lineColor, vec3(1.0, 0.416, 0.173), contour);
    alpha += contour * 0.55 * fog;

    // Whole scene fades out near the end of the hero scroll.
    alpha *= 1.0 - smoothstep(0.7, 1.0, uScroll);
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(lineColor, alpha);
  }
`;

/** Grid positions + line-segment indices along both axes (clean wireframe). */
function buildWireGrid(): { position: Float32Array; index: Uint32Array } {
  const position = new Float32Array(COLS * ROWS * 3);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = (r * COLS + c) * 3;
      position[i] = (c / (COLS - 1) - 0.5) * WIDTH;
      position[i + 1] = 0;
      position[i + 2] = (r / (ROWS - 1) - 0.5) * DEPTH;
    }
  }
  const segments: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (c < COLS - 1) segments.push(i, i + 1);
      if (r < ROWS - 1) segments.push(i, i + COLS);
    }
  }
  return { position, index: new Uint32Array(segments) };
}

export interface HeroScene {
  render(time: number): void;
  resize(width: number, height: number): void;
  setPointer(x: number, y: number): void;
  setScroll(progress: number): void;
  destroy(): void;
}

export function createScene(canvas: HTMLCanvasElement): HeroScene {
  const renderer = new Renderer({
    canvas,
    dpr: Math.min(window.devicePixelRatio, 1.75),
    alpha: true,
    antialias: true,
    depth: false,
    powerPreference: 'low-power',
  });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const camera = new Camera(gl, { fov: 42, near: 0.1, far: 30 });
  const scene = new Transform();

  const { position, index } = buildWireGrid();
  const geometry = new Geometry(gl, {
    position: { size: 3, data: position },
    index: { data: index },
  });
  const program = new Program(gl, {
    vertex,
    fragment,
    transparent: true,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
      uMouse: { value: [0, 0] },
      uScroll: { value: 0 },
    },
  });
  const mesh = new Mesh(gl, { geometry, program, mode: gl.LINES });
  mesh.setParent(scene);

  // Pointer/scroll targets are lerped each frame for glacial, editorial ease.
  let pointerX = 0;
  let pointerY = 0;
  let mouseX = 0;
  let mouseY = 0;
  let scroll = 0;

  return {
    render(time: number): void {
      mouseX += (pointerX - mouseX) * 0.05;
      mouseY += (pointerY - mouseY) * 0.05;
      program.uniforms.uTime.value = time;
      program.uniforms.uMouse.value = [mouseX, mouseY];
      program.uniforms.uScroll.value = scroll;

      camera.position.set(mouseX * 0.35, 1.35 + scroll * 0.9, 3.1);
      camera.lookAt([mouseX * 0.2, 0.2 - scroll * 0.4, -0.6]);
      renderer.render({ scene, camera });
    },
    resize(width: number, height: number): void {
      renderer.setSize(width, height);
      camera.perspective({ aspect: width / Math.max(1, height) });
    },
    setPointer(x: number, y: number): void {
      pointerX = x;
      pointerY = y;
    },
    setScroll(progress: number): void {
      scroll = Math.min(1, Math.max(0, progress));
    },
    destroy(): void {
      geometry.remove();
      program.remove();
      const ext = gl.getExtension('WEBGL_lose_context');
      ext?.loseContext();
    },
  };
}
