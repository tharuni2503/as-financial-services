/**
 * Procedural modern-house scene for the homepage hero.
 *
 * Everything is built from Three.js primitives — no external model files.
 * The scene is intentionally conservative on GPU work: pixel ratio is capped,
 * shadows are disabled on mobile, the loop pauses when the hero is off-screen
 * and prefers-reduced-motion renders a single static frame.
 */
import * as THREE from "./vendor/three.module.js";

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function initThreeScene() {
  const canvas = document.getElementById("hero-canvas");
  const hero = document.querySelector(".hero");
  if (!canvas || !hero) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.matchMedia("(max-width: 768px)").matches;
  const tablet = window.matchMedia("(max-width: 1100px)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !mobile,
      powerPreference: "high-performance",
    });
  } catch (error) {
    console.warn("WebGL unavailable — the hero will use its CSS fallback.", error);
    return;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = !mobile && !reducedMotion;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf4eee3, 26, 58);

  const camera = new THREE.PerspectiveCamera(mobile ? 44 : tablet ? 38 : 34, 1, 0.1, 120);
  const basePosition = new THREE.Vector3(
    mobile ? 11.4 : 9.6,
    mobile ? 6.7 : 5.6,
    mobile ? 17.2 : 14.2
  );
  camera.position.copy(basePosition);

  const lookTarget = new THREE.Vector3(mobile ? 1.4 : 0.7, 2.55, 0);
  camera.lookAt(lookTarget);

  /* ------------------------------------------------------------- lighting */
  const hemisphere = new THREE.HemisphereLight(0xdcecf5, 0xcabfa9, 1.35);
  scene.add(hemisphere);

  const ambient = new THREE.AmbientLight(0xfff8ee, 0.4);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff1d6, 3.4);
  sun.position.set(9, 14, 8);
  sun.castShadow = renderer.shadowMap.enabled;
  if (renderer.shadowMap.enabled) {
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -15;
    sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 16;
    sun.shadow.camera.bottom = -10;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 45;
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.025;
  }
  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.set(1.5, 0, 0);

  const fill = new THREE.DirectionalLight(0xd6e8f2, 0.7);
  fill.position.set(-10, 6, -4);
  scene.add(fill);

  /* Soft generated environment for glass and water reflections. */
  const environment = createEnvironmentTexture();
  scene.environment = environment;
  scene.environmentIntensity = 0.85;

  /* ------------------------------------------------------------ materials */
  const mats = {
    plaster: new THREE.MeshStandardMaterial({ color: 0xe7dbc9, roughness: 0.88, metalness: 0.01 }),
    plasterWarm: new THREE.MeshStandardMaterial({ color: 0xe1d0ba, roughness: 0.92 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xc8bdab, roughness: 0.94 }),
    stoneLight: new THREE.MeshStandardMaterial({ color: 0xd9cdb9, roughness: 0.9 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xa9764c, roughness: 0.62, metalness: 0.02 }),
    woodLight: new THREE.MeshStandardMaterial({ color: 0xc29367, roughness: 0.67 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xb07d4f, roughness: 0.48, metalness: 0.35 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x3b484d, roughness: 0.45, metalness: 0.45 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xb9d6e2,
      metalness: 0.08,
      roughness: 0.06,
      transparent: true,
      opacity: 0.36,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      side: THREE.DoubleSide,
      envMapIntensity: 1.35,
      depthWrite: false,
    }),
    glassRail: new THREE.MeshPhysicalMaterial({
      color: 0xd3e7ee,
      metalness: 0,
      roughness: 0.12,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    water: new THREE.MeshPhysicalMaterial({
      color: 0x87b9ca,
      metalness: 0.25,
      roughness: 0.1,
      transparent: true,
      opacity: 0.93,
      envMapIntensity: 1.7,
    }),
    lawn: new THREE.MeshStandardMaterial({ color: 0xaebf9c, roughness: 1 }),
    sage: new THREE.MeshStandardMaterial({ color: 0x8fa47d, roughness: 0.95, flatShading: true }),
    sageLight: new THREE.MeshStandardMaterial({ color: 0xaebf9f, roughness: 0.95, flatShading: true }),
    olive: new THREE.MeshStandardMaterial({ color: 0x748868, roughness: 0.98, flatShading: true }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x8b7158, roughness: 1 }),
    interior: new THREE.MeshStandardMaterial({ color: 0xf4e7d2, roughness: 0.9 }),
    warmGlow: new THREE.MeshStandardMaterial({
      color: 0xf7e3bd,
      emissive: 0xf2c987,
      emissiveIntensity: 1.5,
      roughness: 0.75,
    }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0xf7f1e7, roughness: 0.95 }),
    cushion: new THREE.MeshStandardMaterial({ color: 0xd9cdbb, roughness: 1 }),
    panel: new THREE.MeshPhysicalMaterial({
      color: 0xdcebf0,
      metalness: 0,
      roughness: 0.05,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      clearcoat: 1,
      envMapIntensity: 1.5,
      depthWrite: false,
    }),
  };

  /* --------------------------------------------------------------- helpers */
  const add = (parent, mesh) => {
    parent.add(mesh);
    return mesh;
  };

  const box = (parent, width, height, depth, material, x, y, z, cast = true, receive = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    return add(parent, mesh);
  };

  const cylinder = (parent, radiusTop, radiusBottom, height, material, x, y, z, segments = 16) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
      material
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return add(parent, mesh);
  };

  /* ----------------------------------------------------------------- world */
  const world = new THREE.Group();
  scene.add(world);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mats.stone);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  world.add(ground);

  const lawn = new THREE.Mesh(new THREE.CircleGeometry(16, 48), mats.lawn);
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(-4, 0.005, 3.5);
  lawn.receiveShadow = true;
  world.add(lawn);

  const terrace = box(world, 13.5, 0.22, 10.2, mats.stoneLight, 2.6, 0.11, 1.6, false, true);
  terrace.receiveShadow = true;

  const stepMat = mats.stoneLight;
  box(world, 3.2, 0.16, 0.55, stepMat, -1.2, 0.09, 6.65, false, true);
  box(world, 2.6, 0.16, 0.55, stepMat, -1.3, 0.25, 6.72, false, true);

  /* ------------------------------------------------------------- house core */
  const house = new THREE.Group();
  house.position.set(2.6, 0, 0);
  house.rotation.y = -0.12;
  world.add(house);

  /* Ground floor — hollow shell so the interior is visible through glass. */
  box(house, 6.6, 0.2, 4.9, mats.woodLight, 0, 0.3, 0, false, true);

  const lowerWallY = 1.95;
  const lowerWallH = 3.3;
  box(house, 0.2, lowerWallH, 4.9, mats.plaster, -3.2, lowerWallY, 0);
  box(house, 0.2, lowerWallH, 4.9, mats.plaster, 3.2, lowerWallY, 0);
  box(house, 6.6, lowerWallH, 0.2, mats.plasterWarm, 0, lowerWallY, -2.35);

  /* Interior back wall + warm panels */
  box(house, 5.9, 3.0, 0.08, mats.interior, 0, 1.95, -2.22, false, true);
  box(house, 2.5, 0.72, 0.06, mats.warmGlow, -1.15, 2.0, -2.17, false, false);

  /* Interior furniture silhouettes */
  box(house, 1.9, 0.45, 0.78, mats.cushion, -1.3, 0.66, 0.1);
  box(house, 1.9, 0.55, 0.18, mats.cushion, -1.3, 1.02, -0.3);
  box(house, 1.2, 0.07, 0.66, mats.wood, -0.9, 0.86, 1.0);
  box(house, 1.0, 0.42, 0.06, mats.wood, -0.9, 0.56, 1.0);
  box(house, 2.8, 0.025, 1.9, mats.stoneLight, -1.2, 0.41, 0.4, false, false);

  /* Pendant lights */
  [
    [-1.8, 2.85, 0.5],
    [-0.8, 2.7, 0.7],
    [0.2, 2.82, 0.45],
  ].forEach(([x, y, z]) => {
    cylinder(house, 0.015, 0.015, 0.75, mats.dark, x, y + 0.35, z, 6);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), mats.warmGlow);
    bulb.position.set(x, y, z);
    house.add(bulb);
  });

  const interiorLight = new THREE.PointLight(0xffd9a0, 6, 5.5, 2);
  interiorLight.position.set(-0.6, 2.5, 0.2);
  house.add(interiorLight);

  /* Front glass facade */
  box(house, 5.9, 2.8, 0.06, mats.glass, 0, 1.98, 2.46, false, false);
  add(house, frameFor(5.9, 2.8, 2.49, 1.98, mats.dark, 4));

  /* Roof / soffit over ground floor */
  box(house, 8.1, 0.24, 6.4, mats.plaster, 0.1, 3.67, 0.1);
  box(house, 7.6, 0.06, 5.8, mats.wood, 0.1, 3.52, 0.1, false, false);
  for (let i = 0; i < 5; i += 1) {
    box(house, 5.6, 0.012, 0.02, mats.warmGlow, 0, 3.485, 1.9 - i * 0.7, false, false);
  }

  /* Wood-slat feature wall on the visible side */
  for (let i = 0; i < 18; i += 1) {
    box(house, 0.055, 2.95, 0.09, mats.wood, 3.31, 1.95, -2.05 + i * 0.235, true, true);
  }

  /* Upper floor */
  const upper = new THREE.Group();
  upper.position.set(-0.55, 0, -0.15);
  house.add(upper);

  box(upper, 5.4, 0.2, 4.4, mats.woodLight, 0, 3.82, 0, false, true);
  box(upper, 0.18, 2.15, 4.4, mats.plaster, -2.7, 4.95, 0);
  box(upper, 0.18, 2.15, 4.4, mats.plaster, 2.7, 4.95, 0);
  box(upper, 5.4, 2.15, 0.18, mats.plaster, 0, 4.95, -2.2);
  box(upper, 5.4, 2.15, 0.18, mats.plaster, 0, 4.95, 2.2);
  box(upper, 4.8, 1.65, 0.06, mats.glass, 0, 4.88, 2.3, false, false);
  add(upper, frameFor(4.8, 1.65, 2.33, 4.88, mats.dark, 5));
  box(upper, 4.4, 0.6, 0.05, mats.warmGlow, 0.1, 4.55, 2.29, false, false);
  box(upper, 6.2, 0.24, 5.1, mats.plaster, 0, 6.08, 0.15);
  box(upper, 5.7, 0.05, 4.7, mats.wood, 0, 5.94, 0.1, false, false);

  /* Vertical shading fins */
  for (let i = 0; i < 6; i += 1) {
    box(upper, 0.05, 1.9, 0.1, mats.dark, -2.2 + i * 0.88, 4.86, 2.43, true, true);
  }

  /* Cantilever balcony */
  box(house, 5.9, 0.16, 1.2, mats.plaster, -0.55, 3.82, 2.75);
  for (let i = 0; i < 3; i += 1) {
    box(house, 0.04, 1.05, 0.04, mats.dark, -3.2 + i * 2.65, 4.4, 3.3, true, true);
  }
  box(house, 5.9, 0.04, 0.05, mats.dark, -0.55, 4.94, 3.3, true, true);
  box(house, 5.7, 1.0, 0.035, mats.glassRail, -0.55, 4.42, 3.31, false, false);

  /* Pergola on the entry side */
  for (let i = 0; i < 6; i += 1) {
    box(house, 2.5, 0.08, 0.13, mats.wood, -4.55, 3.5, 2.05 + i * 0.42, true, true);
  }
  box(house, 0.14, 3.1, 0.14, mats.dark, -5.72, 1.6, 3.9);
  box(house, 0.14, 3.1, 0.14, mats.dark, -5.72, 1.6, 1.85);

  /* Entry door + address plaque */
  box(house, 1.5, 2.6, 0.08, mats.dark, -2.1, 1.72, 2.48);
  box(house, 1.25, 2.35, 0.05, mats.glass, -2.1, 1.72, 2.54, false, false);
  box(house, 0.5, 0.18, 0.05, mats.copper || mats.wood, -3.9, 2.1, 2.48, false, false);
  cylinder(house, 0.035, 0.035, 0.03, mats.wood, -1.62, 1.85, 2.58, 12).rotation.x = Math.PI / 2;

  /* Exterior downlights along the soffit */
  [-2.2, 0, 2.2].forEach((x) => {
    const light = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12), mats.warmGlow);
    light.position.set(x, 3.54, 2.2);
    light.rotation.x = Math.PI / 2;
    house.add(light);
  });

  /* --------------------------------------------------------------- pool */
  const pool = new THREE.Group();
  pool.position.set(5.4, 0, 3.2);
  world.add(pool);
  box(pool, 4.7, 0.16, 2.5, mats.stoneLight, 0, 0.08, 0, false, true);
  const water = new THREE.Mesh(new THREE.BoxGeometry(4.25, 0.06, 2.08), mats.water);
  water.position.set(0, 0.18, 0);
  water.receiveShadow = true;
  pool.add(water);
  box(pool, 4.4, 0.05, 2.2, new THREE.MeshPhysicalMaterial({ color: 0xbfe4ea, transparent: true, opacity: 0.18, roughness: 0.15 }), 0, 0.205, 0, false, false);

  /* Poolside loungers */
  [-0.9, 0.2].forEach((x) => {
    box(pool, 0.7, 0.12, 1.35, mats.plaster, x, 0.42, 1.9);
    const back = box(pool, 0.7, 0.12, 0.6, mats.plaster, x, 0.7, 2.4);
    back.rotation.x = -0.55;
    box(pool, 0.62, 0.05, 1.05, mats.cushion, x, 0.5, 1.9, false, false);
  });

  /* ------------------------------------------------------- trees & planting */
  const treeCount = mobile ? 2 : tablet ? 3 : 4;
  const treePositions = [
    [-6.8, 1.6, 1.25],
    [9.7, -2.4, 1.45],
    [-5.1, 6.2, 0.95],
    [0.8, -6.4, 1.3],
  ];
  treePositions
    .slice(0, treeCount)
    .forEach(([x, z, scale]) => world.add(createTree(x, z, scale, mats)));

  const shrubPositions = [
    [-4.0, 2.9, 0.55],
    [-3.6, 2.5, 0.42],
    [7.9, 0.4, 0.5],
    [8.1, 1.5, 0.44],
    [0.4, 4.5, 0.42],
  ];
  shrubPositions.slice(0, mobile ? 2 : 5).forEach(([x, z, scale]) => {
    const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(scale, 1), mats.sage);
    shrub.position.set(x, 0.22 + scale * 0.7, z);
    shrub.castShadow = true;
    world.add(shrub);
  });

  /* Low hedges */
  [-2.2, 0, 2.2].forEach((x) => {
    const hedge = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.55), mats.olive);
    hedge.position.set(x - 0.5, 0.27, 4.25);
    hedge.castShadow = true;
    hedge.receiveShadow = true;
    world.add(hedge);
  });

  /* ----------------------------------------------------- floating panels */
  const panels = [];
  const panelConfigs = mobile
    ? [
        [-4.2, 4.1, 1.0, 0.9, -0.4],
        [6.6, 5.8, -1.2, 1.1, 0.35],
      ]
    : [
        [-5.0, 3.8, 2.2, 1.05, -0.5],
        [7.8, 5.2, 0.4, 1.15, 0.4],
        [4.6, 7.2, -2.6, 0.8, -0.2],
        [-4.2, 6.1, -3.4, 0.7, 0.5],
      ];

  panelConfigs.forEach(([x, y, z, scale, rotation]) => {
    const group = new THREE.Group();
    const geometry = new THREE.PlaneGeometry(2.1 * scale, 2.9 * scale);
    const mesh = new THREE.Mesh(geometry, mats.panel);
    mesh.castShadow = false;
    group.add(mesh);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.4,
      })
    );
    group.add(edges);
    group.position.set(x, y, z);
    group.rotation.set(0.04, rotation, -0.1);
    group.userData = {
      baseY: y,
      phase: x * 0.7 + z,
      speed: 0.32 + Math.abs(rotation) * 0.2,
      baseRotation: rotation,
    };
    panels.push(group);
    scene.add(group);
  });

  /* Soft contact shadow keeps the house grounded even without real-time shadows. */
  const shadowTexture = createRadialShadowTexture();
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 13),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: renderer.shadowMap.enabled ? 0.16 : 0.3,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(2.4, 0.015, 1.8);
  world.add(shadow);

  /* --------------------------------------------------------------- resize */
  const setSize = () => {
    const width = hero.clientWidth || window.innerWidth;
    const height = hero.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
  };

  setSize();
  const resizeObserver = new ResizeObserver(() => setSize());
  resizeObserver.observe(hero);

  /* ------------------------------------------------------------- animation */
  const clock = new THREE.Clock();
  const pointer = new THREE.Vector2(0, 0);
  const pointerSmooth = new THREE.Vector2(0, 0);
  let scrollProgress = 0;
  let scrollSmooth = 0;
  let intro = 0;
  let running = true;
  let visible = true;
  let rafId = 0;
  let mouseAttached = false;

  const start = performance.now();

  const onPointerMove = (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  };

  const onScroll = () => {
    scrollProgress = clamp(window.scrollY / (hero.offsetHeight || 1), 0, 1);
  };

  const render = () => {
    if (!visible || !running) return;
    rafId = requestAnimationFrame(render);

    const elapsed = (performance.now() - start) / 1000;
    const delta = Math.min(clock.getDelta(), 0.05);

    if (!reducedMotion) {
      intro = Math.min(1, intro + delta * 0.55);
      pointerSmooth.lerp(pointer, 0.055);
      scrollSmooth += (scrollProgress - scrollSmooth) * 0.07;
    } else {
      intro = 1;
      pointerSmooth.set(0, 0);
      scrollSmooth = 0;
    }

    const introEase = 1 - Math.pow(1 - intro, 3);

    camera.position.x = basePosition.x + (1 - introEase) * 1.7 + scrollSmooth * 1.8 + pointerSmooth.x * 0.55;
    camera.position.y = basePosition.y + (1 - introEase) * 1.2 + scrollSmooth * 1.5 - pointerSmooth.y * 0.32;
    camera.position.z = basePosition.z + (1 - introEase) * 2.4 - scrollSmooth * 0.9;
    camera.lookAt(lookTarget.x, lookTarget.y + scrollSmooth * 0.7, lookTarget.z);

    if (!reducedMotion) {
      panels.forEach((panel) => {
        const data = panel.userData;
        panel.position.y = data.baseY + Math.sin(elapsed * data.speed + data.phase) * 0.18;
        panel.rotation.z = -0.1 + Math.sin(elapsed * 0.22 + data.phase) * 0.025;
      });

      /* A barely-there drift keeps the architecture from feeling static. */
      house.rotation.y = -0.12 + Math.sin(elapsed * 0.11) * 0.006;
    }

    renderer.render(scene, camera);

    /* Keep the canvas invisible until the first frame has been drawn. */
    if (intro > 0.05 && !canvas.classList.contains("is-ready")) {
      requestAnimationFrame(() => canvas.classList.add("is-ready"));
    }
  };

  const startLoop = () => {
    if (rafId) cancelAnimationFrame(rafId);
    clock.getDelta();
    render();
  };

  const stopLoop = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  };

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (visible) startLoop();
      else stopLoop();
    },
    { threshold: 0.01 }
  );
  intersectionObserver.observe(hero);

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running && visible) startLoop();
    else stopLoop();
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (!reducedMotion && !mobile) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    mouseAttached = true;
  }

  if (reducedMotion) {
    canvas.classList.add("is-ready");
    renderer.render(scene, camera);
  } else {
    startLoop();
  }

  /* Clean up if the page is ever navigated away in a SPA-like context. */
  window.addEventListener("pagehide", () => {
    stopLoop();
    intersectionObserver.disconnect();
    resizeObserver.disconnect();
    if (mouseAttached) window.removeEventListener("pointermove", onPointerMove);
    renderer.dispose();
    environment.dispose();
  });
}

/* -------------------------------------------------------------- utilities */

function frameFor(width, height, z, y, material, columns) {
  const group = new THREE.Group();
  const thickness = 0.055;
  const depth = 0.12;

  const horizontal = (h, yy) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, h, depth), material);
    bar.position.set(0, yy, z);
    bar.castShadow = true;
    group.add(bar);
  };

  horizontal(0.08, y + height / 2);
  horizontal(0.08, y - height / 2);

  const gap = width / columns;
  for (let i = 0; i <= columns; i += 1) {
    const x = -width / 2 + i * gap;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, depth), material);
    bar.position.set(x, y, z);
    bar.castShadow = true;
    group.add(bar);
  }

  return group;
}

function createTree(x, z, scale, materials) {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.26, 2.6, 8),
    materials.trunk
  );
  trunk.position.y = 1.3;
  trunk.castShadow = true;
  tree.add(trunk);

  const clusters = [
    [0, 3.2, 0, 1.35, materials.sage],
    [-0.9, 2.8, 0.35, 0.9, materials.sageLight],
    [0.85, 2.7, -0.3, 0.84, materials.olive],
    [0.2, 3.7, -0.2, 0.82, materials.sageLight],
  ];

  clusters.forEach(([cx, cy, cz, radius, material]) => {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), material);
    leaf.position.set(cx, cy, cz);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    tree.add(leaf);
  });

  return tree;
}

function createEnvironmentTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#c9e2ef");
  gradient.addColorStop(0.42, "#eef3ef");
  gradient.addColorStop(0.62, "#f8f1e5");
  gradient.addColorStop(1, "#cabb9f");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 256);

  const glow = context.createRadialGradient(360, 58, 0, 360, 58, 95);
  glow.addColorStop(0, "rgba(255, 247, 225, 0.95)");
  glow.addColorStop(1, "rgba(255, 247, 225, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 512, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createRadialShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(128, 128, 10, 128, 128, 128);
  gradient.addColorStop(0, "rgba(30, 30, 30, 0.55)");
  gradient.addColorStop(0.55, "rgba(30, 30, 30, 0.25)");
  gradient.addColorStop(1, "rgba(30, 30, 30, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
