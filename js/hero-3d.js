/**
 * Cinematic financial hero — Three.js scene (v2, art-directed).
 *
 * Composition: a sweeping metallic-gold growth arc drawn by a bezier curve
 * and milestone nodes, rising stepped bars beneath it, two glass analytics
 * panels at different depths, and a shallow band of drifting gold dust.
 *
 * Realism upgrades over v1:
 *  - PMREM-baked studio environment (warm gold key + cool blue bounce) so
 *    the gold reads as polished metal instead of flat colour.
 *  - One continuous curve for the arc (no visible seam) with milestone
 *    nodes and a diamond apex, instead of a plain torus.
 *  - Asymmetric depth composition with scene fog for aerial perspective.
 *  - Damped, clamped mouse parallax + idle camera sway; both directions.
 *
 * Safeguards (preserved from v1):
 *  - prefers-reduced-motion → single static frame, no loop
 *  - lite mode on small / coarse-pointer devices (fewer objects, capped DPR)
 *  - pauses when offscreen or the tab is hidden
 *  - full GPU cleanup on pagehide; silent fallback without WebGL
 */
import * as THREE from "./vendor/three.module.js";

/* ------------------------------------------------------------------ helpers */

/** Damped easing applied to scroll progress for a gentler pull. */
const easeOut = (p) => 1 - (1 - p) * (1 - p);

/**
 * Builds a tiny studio scene (dark navy field + warm and cool "softboxes")
 * and bakes it with PMREM so metallic materials get real reflections.
 */
function createEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x0a1d3a);

  const softbox = (color, intensity, w, h, pos, rot) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(intensity),
      })
    );
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.set(rot[0], rot[1], rot[2]);
    envScene.add(mesh);
  };

  // Warm gold softbox — upper right, the "sun" for the metal.
  softbox(0xffd98a, 5.2, 7, 4.4, [4.6, 4.4, 3.4], [0, -Math.PI * 0.36, Math.PI * 0.28]);
  // Cool blue bounce — left side, gives shadows a navy tint.
  softbox(0x8fb9f0, 2.4, 5.4, 3.6, [-5.2, 2.2, 2.2], [0, Math.PI * 0.3, -Math.PI * 0.18]);
  // Ivory strip — a long highlight along the arc's sweep direction.
  softbox(0xfff6e2, 3.0, 8, 1.4, [0.8, 5.6, -2.6], [Math.PI * 0.42, 0, 0]);
  // Warm front fill so bar faces facing the camera still catch gold.
  softbox(0xffe0a8, 2.6, 9, 5, [0.6, 0.6, 7.2], [0, Math.PI, 0]);
  // Dim navy floor to ground the reflections.
  softbox(0x123055, 1.1, 14, 10, [0, -4.6, 0], [-Math.PI * 0.5, 0, 0]);

  const envRT = pmrem.fromScene(envScene, 0.09);
  pmrem.dispose();
  return envRT;
}

/** Smooth growth arc from lower-left to a rising upper-right end. */
function arcCurve(lite) {
  const lift = lite ? 0.9 : 1;
  const points = [
    new THREE.Vector3(-2.6, -1.15 * lift, 0.32),
    new THREE.Vector3(-1.5, 0.06 * lift, 0.14),
    new THREE.Vector3(-0.15, 0.72 * lift, 0.0),
    new THREE.Vector3(1.05, 1.22 * lift, -0.16),
    new THREE.Vector3(2.15, 2.1 * lift, -0.34),
    new THREE.Vector3(2.62, 2.62 * lift, -0.5),
  ];
  return new THREE.CatmullRomCurve3(points, false, "centripetal", 0.6);
}

/** Zig-zag chart line inside a glass panel. */
function chartLine(width) {
  const geo = new THREE.BufferGeometry();
  const h = 0.16;
  geo.setFromPoints(
    [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
      const x = -width / 2 + (width * i) / 8;
      const y = [-h, h * 0.3, -h * 0.4, h, h * 0.5, h * 1.1, h * 0.7, h * 1.5, h * 1.4][i];
      return new THREE.Vector3(x, y, 0);
    })
  );
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xe8c96a }));
}

/* -------------------------------------------------------------------- main */

export function initHero3D() {
  const hero =
    document.querySelector(".hero--cinematic") || document.querySelector(".hero");
  const canvas = document.getElementById("hero-canvas");
  if (!hero || !canvas) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.matchMedia("(max-width: 768px)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const lite = mobile || coarse;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !lite,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
  } catch {
    return;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;

  const scene = new THREE.Scene();
  // No scene fog: the renderer clears to transparent over a bright hero.

  const camera = new THREE.PerspectiveCamera(
    lite ? 47 : 34,
    1,
    0.1,
    60
  );
  const cameraBase = new THREE.Vector3(
    lite ? 0.0 : 2.85,
    lite ? 1.0 : 1.5,
    lite ? 11.6 : 9.9
  );
  const cameraLookAt = new THREE.Vector3(1.0, -0.05, 0);
  camera.position.copy(cameraBase);

  /* ---------------------------------------------------- environment + lights */
  let envRT = null;
  const disposables = [];
  try {
    envRT = createEnvironment(renderer);
    scene.environment = envRT.texture;
  } catch {
    envRT = null;
  }

  const ambient = new THREE.AmbientLight(0x8fa5c8, 0.42);
  scene.add(ambient);

  const hemisphere = new THREE.HemisphereLight(0xbfd6f2, 0x0a1c33, 0.5);
  scene.add(hemisphere);

  const key = new THREE.DirectionalLight(0xfff0c8, 2.8);
  key.position.set(5.2, 6.8, 5.4);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x7ab4ff, 1.35);
  rim.position.set(-6.0, 2.8, -5.0);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0xffffff, 0.55);
  fill.position.set(1.5, 1.2, 7.5);
  scene.add(fill);

  const crest = new THREE.PointLight(0xffcf4d, 9, 8, 2);
  crest.position.set(2.1, 2.4, 1.6);
  scene.add(crest);

  /* ------------------------------------------------------------- materials */
  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xe0b030,
    metalness: 1.0,
    roughness: 0.14,
    clearcoat: 0.62,
    clearcoatRoughness: 0.18,
    emissive: 0x5a3a08,
    emissiveIntensity: 0.42,
    envMapIntensity: 1.55,
  });
  const goldBrushed = new THREE.MeshPhysicalMaterial({
    color: 0xe8c050,
    metalness: 0.9,
    roughness: 0.22,
    clearcoat: 0.4,
    emissive: 0x6a4408,
    emissiveIntensity: 0.4,
    envMapIntensity: 1.65,
  });
  const navyGlass = new THREE.MeshPhysicalMaterial({
    color: 0x3d679c,
    metalness: 0.45,
    roughness: 0.28,
    emissive: 0x102848,
    emissiveIntensity: 0.18,
    envMapIntensity: 1.2,
  });
  const panelGlass = new THREE.MeshPhysicalMaterial({
    color: 0xe8f3ff,
    metalness: 0.18,
    roughness: 0.08,
    transparent: true,
    opacity: lite ? 0.22 : 0.32,
    clearcoat: 1.0,
    clearcoatRoughness: 0.12,
    side: THREE.DoubleSide,
    envMapIntensity: 1.35,
  });
  const goldLine = new THREE.MeshBasicMaterial({
    color: 0xe8c96a,
    transparent: true,
    opacity: 0.85,
  });
  [gold, goldBrushed, navyGlass, panelGlass].forEach((m) => disposables.push(m));

  /* ---------------------------------------------------------- composition */
  const world = new THREE.Group();
  scene.add(world);

  const stage = new THREE.Group();
  stage.position.set(lite ? 0.0 : 1.35, lite ? -0.35 : -0.4, 0);
  world.add(stage);

  /* The arc — hero element. */
  const curve = arcCurve(lite);
  const arcGeometry = new THREE.TubeGeometry(curve, lite ? 72 : 148, 0.085, lite ? 10 : 14, false);
  const arc = new THREE.Mesh(arcGeometry, gold);
  stage.add(arc);

  // Thin echo line alongside the arc (a "second reading" of the trend).
  const echo = new THREE.Mesh(
    new THREE.TubeGeometry(curve, lite ? 48 : 96, 0.016, 6, false),
    goldBrushed
  );
  echo.scale.set(1.045, 1.075, 0.94);
  echo.position.set(-0.08, 0.14, 0.12);
  stage.add(echo);

  // Milestone nodes along the arc — pulse sequentially as scroll progresses.
  const milestones = [];
  [0.12, 0.36, 0.6, 0.84].forEach((u, i) => {
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(0.055 + i * 0.008, 18, 18),
      goldBrushed
    );
    node.position.copy(curve.getPoint(u));
    node.position.z += 0.02;
    node.userData.phase = i * 1.4;
    stage.add(node);
    milestones.push(node);
  });

  // Diamond apex marking the arc's highest point.
  const apex = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), gold);
  apex.position.copy(curve.getPoint(1));
  apex.rotation.z = Math.PI / 4;
  stage.add(apex);

  /* Rising stepped bars beneath the arc. */
  const bars = [];
  const barSpec = lite
    ? [
        [-0.5, 0.5, 0.34, -0.8],
        [0.26, 0.78, 0.34, -0.62],
        [1.0, 1.14, 0.34, -0.78],
      ]
    : [
        [-1.55, 0.42, 0.34, -0.86],
        [-0.85, 0.62, 0.34, -0.66],
        [-0.15, 0.86, 0.34, -0.9],
        [0.6, 1.18, 0.34, -0.6],
        [1.4, 1.55, 0.34, -0.84],
      ];
  barSpec.forEach(([x, h, w, z], i) => {
    const isLast = i === barSpec.length - 1;
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, w * 0.78),
      isLast ? gold : i === 1 || (lite && i === 0) ? navyGlass : goldBrushed
    );
    bar.position.set(x, h / 2 - 1.38, z);
    bar.userData.baseY = bar.position.y;
    bar.userData.phase = i * 0.75;
    stage.add(bar);
    bars.push(bar);

    // Warm cap on every bar; brighter on the leader.
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.05, 0.05, w * 0.78 + 0.05),
      isLast ? gold : goldBrushed
    );
    cap.position.y = h / 2 + 0.032;
    bar.add(cap);
  });

  /* Glass analytics panels at different depths. */
  const panels = [];
  const panelSpec = lite
    ? [
        [1.55, 1.75, 0.9, 0.1, -0.34, 0.04, 1.18],
        [-1.35, 0.05, 0.55, -0.06, 0.42, -0.03, 0.92],
      ]
    : [
        [2.1, 2.0, 0.85, 0.08, -0.4, 0.05, 1.22],
        [-1.85, 1.35, 0.5, -0.06, 0.42, -0.04, 1.0],
        [0.35, -0.15, 1.35, 0.09, 0.3, 0.02, 0.85],
      ];
  panelSpec.forEach(([x, y, z, rx, ry, rz, scale]) => {
    const w = 1.42 * scale;
    const h = 0.9 * scale;
    const panel = new THREE.Group();
    panel.position.set(x, y, z);
    panel.rotation.set(rx, ry, rz);
    panel.userData.baseY = y;
    panel.userData.phase = x * 0.6 + y;
    panel.userData.depth = 0.4 + scale * 0.4;

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), panelGlass);
    panel.add(glass);

    panel.userData.baseX = x;

    // Gold frame — four thin bars instead of a line grid (catches the env).
    const frameMat = goldLine;
    const frame = [
      [0, h / 2, w, 0.022],
      [0, -h / 2, w, 0.022],
      [-w / 2, 0, 0.022, h],
      [w / 2, 0, 0.022, h],
    ].map(([fx, fy, fw, fh]) => {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), frameMat);
      bar.position.set(fx, fy, 0.004);
      return bar;
    });
    frame.forEach((bar) => panel.add(bar));

    // Content: chart line + axis dots.
    const chart = chartLine(w * 0.78);
    chart.position.set(0, 0.06 * scale, 0.01);
    panel.add(chart);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 12, 12),
      goldBrushed
    );
    dot.position.set(w * 0.27, h * 0.18, 0.012);
    panel.add(dot);
    const barMini = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.42, 0.05 * scale, 0.012),
      goldBrushed
    );
    barMini.position.set(-w * 0.26, -h * 0.26, 0.012);
    panel.add(barMini);

    stage.add(panel);
    panels.push(panel);
  });

  /* Gold dust — two bands so small and large flecks read at different depths. */
  const dustGroups = [];
  const dustSpec = lite
    ? [
        { count: 46, size: 0.05, spread: 7.4, opacity: 0.6, speed: 0.06 },
      ]
    : [
        { count: 96, size: 0.032, spread: 8.6, opacity: 0.5, speed: 0.05 },
        { count: 54, size: 0.062, spread: 7.2, opacity: 0.78, speed: 0.07 },
      ];
  dustSpec.forEach(({ count, size, spread, opacity, speed }) => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      // Bias distribution toward the arc's path (upper right) and keep the
      // band shallow so dust stays behind the copy, never across it.
      const u = Math.random();
      positions[i * 3] = -spread / 2 + u * spread + (Math.random() - 0.5) * 1.2;
      positions[i * 3 + 1] = -2.0 + Math.pow(Math.random(), 0.72) * 5.4;
      positions[i * 3 + 2] = -1.6 - Math.random() * 3.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    disposables.push(geo);
    const cloud = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xe8c96a,
        size,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      })
    );
    cloud.userData.speed = speed;
    world.add(cloud);
    dustGroups.push(cloud);
  });

  /* Soft stage glows near the floor of the composition. */
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 48),
    new THREE.MeshBasicMaterial({
      color: 0xd7a52e,
      transparent: true,
      opacity: 0.05,
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0.6, -1.5, -0.3);
  stage.add(glow);

  const glowCool = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 40),
    new THREE.MeshBasicMaterial({
      color: 0x6aa8ff,
      transparent: true,
      opacity: 0.05,
    })
  );
  glowCool.rotation.x = -Math.PI / 2;
  glowCool.position.set(1.6, -1.46, 0.4);
  stage.add(glowCool);

  /* --------------------------------------------------------------- resize */
  const size = () => {
    const w = hero.clientWidth || window.innerWidth;
    const h = hero.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const maxDpr = lite ? 1.4 : 1.85;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(w, h, false);
  };
  size();
  const ro = new ResizeObserver(size);
  ro.observe(hero);

  /* ----------------------------------------------------------- interactions */
  const mouse = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };
  const onPointerMove = (event) => {
    if (reduced) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (event.clientY / window.innerHeight) * 2 - 1;
  };
  if (!lite) window.addEventListener("pointermove", onPointerMove, { passive: true });

  let progress = 0;
  let targetProgress = 0;
  const { gsap, ScrollTrigger } = window;
  let trigger = null;
  if (gsap && ScrollTrigger && !reduced) {
    try {
      trigger = ScrollTrigger.create({
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: 0.7,
        onUpdate: (self) => {
          targetProgress = self.progress;
        },
      });
    } catch {
      trigger = null;
    }
  }
  const onScroll = () => {
    if (!trigger) {
      targetProgress = Math.min(1, Math.max(0, window.scrollY / Math.max(1, hero.offsetHeight)));
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ----------------------------------------------------------------- loop */
  let raf = 0;
  let running = true;
  let visible = true;
  let t = 0;

  const stageBaseX = () => (lite ? 0.0 : 1.35);
  const stageBaseY = () => (lite ? -0.35 : -0.4);

  const draw = () => {
    renderer.render(scene, camera);
    canvas.classList.add("is-ready");
  };

  const frame = () => {
    raf = 0;
    if (!running || !visible) return;
    raf = requestAnimationFrame(frame);

    t += 0.01;
    progress += (targetProgress - progress) * 0.06;
    smooth.x += (mouse.x - smooth.x) * 0.045;
    smooth.y += (mouse.y - smooth.y) * 0.045;

    const eased = easeOut(progress);
    const sway = Math.sin(t * 0.14) * 0.028;

    // Composition: settles + turns gently as the hero scrolls away.
    stage.rotation.y = -0.2 + eased * 0.44 + sway + smooth.x * 0.09;
    stage.rotation.x = 0.03 - eased * 0.08 + smooth.y * 0.05;
    stage.position.y = stageBaseY() - eased * 0.34 + smooth.y * -0.04;
    stage.position.x = stageBaseX() - smooth.x * 0.1;

    // Camera: slow dolly-in and descend, plus the same mouse drift clamped.
    camera.position.x = cameraBase.x - eased * 0.85 + smooth.x * 0.16;
    camera.position.y = cameraBase.y - eased * 0.42 + smooth.y * 0.12;
    camera.position.z = cameraBase.z - eased * 1.15;
    cameraLookAt.set(
      1.0 + smooth.x * 0.1,
      -0.05 - eased * 0.45 + smooth.y * 0.06,
      0
    );
    camera.lookAt(cameraLookAt);

    panels.forEach((panel) => {
      panel.position.y =
        panel.userData.baseY + Math.sin(t * 0.6 + panel.userData.phase) * 0.05;
      // Deeper panels counter-move slightly — believable parallax layers.
      panel.position.x = panel.userData.baseX + smooth.x * -0.05 * panel.userData.depth;
      panel.rotation.y = panel.userData.baseRotY + smooth.x * 0.055;
    });

    bars.forEach((bar, i) => {
      bar.position.y =
        bar.userData.baseY + Math.sin(t * 0.5 + bar.userData.phase) * 0.014;
    });

    milestones.forEach((node) => {
      const pulse = 0.85 + Math.sin(t * 0.8 - node.userData.phase + eased * 2.2) * 0.15;
      node.scale.setScalar(pulse);
    });
    apex.rotation.y = t * 0.4;
    apex.position.y += Math.sin(t * 0.7) * 0.0006;

    dustGroups.forEach((cloud) => {
      cloud.position.y = (t * cloud.userData.speed) % 1.2;
      cloud.rotation.y = t * 0.016 + smooth.x * 0.03;
    });

    crest.intensity = 8.6 + Math.sin(t * 0.9) * 1.1;

    draw();
  };

  const start = () => {
    if (raf) return;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  /* --------------------------------------------------------------- cleanup */
  let io = null;
  const disposeScene = () => {
    try {
      trigger?.kill();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      ro.disconnect();
      io?.disconnect();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          Array.isArray(object.material)
            ? object.material.forEach((m) => m.dispose())
            : object.material.dispose();
        }
      });
      disposables.forEach((d) => d.dispose());
      envRT?.dispose?.();
      renderer.dispose();
    } catch {
      /* no-op */
    }
  };

  if (reduced) {
    progress = 0.22;
    targetProgress = 0.22;
    draw();
  } else {
    io = new IntersectionObserver(
      (entries) => {
        visible = Boolean(entries[0]?.isIntersecting);
        if (visible && running) start();
        if (!visible) stop();
      },
      { threshold: 0.01 }
    );
    io.observe(hero);

    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
      if (running && visible) start();
      else stop();
    });

    window.addEventListener("pagehide", disposeScene, { once: true });

    start();
  }
}
