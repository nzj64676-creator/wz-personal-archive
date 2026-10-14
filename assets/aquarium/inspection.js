import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createGoldfishActor } from './fish.js';

/** A second, isolated view of the selected real fish. Never touches the tank camera. */
export function createFishInspection(THREE, templates) {
  const pane = document.getElementById('fishInspection');
  const canvas = document.getElementById('inspectionCanvas');
  const title = document.getElementById('inspectionTitle');
  const breed = document.getElementById('inspectionBreed');
  if (!pane || !canvas) throw new Error('The fish inspection panel and canvas are required.');
  let renderer, scene, camera, controls, environmentTarget, resizeObserver;
  let sun, fill, hemisphere, actor = null, resident = null, bonePairs = [];
  let visible = false, night = false, needsRender = true, disposed = false;
  let contextAvailable = true, focusReturn = null, message = null;
  const offset = new THREE.Vector3(), spherical = new THREE.Spherical();

  function showMessage(text) {
    if (!message) {
      message = document.createElement('p');
      message.dataset.inspectionMessage = '';
      message.setAttribute('role', 'status');
      Object.assign(message.style, {
        position: 'absolute', inset: '36% 24px auto', textAlign: 'center',
        color: '#ddc5a1', fontSize: '13px', lineHeight: '1.8', pointerEvents: 'none'
      });
      canvas.parentElement.append(message);
    }
    message.textContent = text;
    message.hidden = !text;
  }

  function resize() {
    if (!renderer || !camera || disposed) return;
    const width = Math.max(1, Math.round(canvas.clientWidth || canvas.getBoundingClientRect().width));
    const height = Math.max(1, Math.round(canvas.clientHeight || canvas.getBoundingClientRect().height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    needsRender = true;
  }

  function setLights() {
    if (!scene) return;
    sun.color.set(night ? 0xb5cae7 : 0xffd6a3);
    sun.intensity = night ? .7 : 1.8;
    fill.color.set(night ? 0xa5c2df : 0xd5e6e4);
    fill.intensity = night ? .55 : .35;
    hemisphere.intensity = night ? .32 : .55;
    scene.environmentIntensity = night ? .32 : .42;
    renderer.toneMappingExposure = night ? .85 : .96;
    needsRender = true;
  }

  function initialize() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: true, powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setClearColor(0x111719, 0);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(34, 1, .025, 40);
    controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = .075;
    controls.minPolarAngle = .08;
    controls.maxPolarAngle = Math.PI * .9;
    controls.enabled = visible;
    controls.addEventListener('change', onControlChange);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    environmentTarget = pmrem.fromScene(room, .035);
    scene.environment = environmentTarget.texture;
    room.dispose();
    pmrem.dispose();
    hemisphere = new THREE.HemisphereLight(0xffe5c5, 0x302a1f, .55);
    sun = new THREE.DirectionalLight(0xffd6a3, 1.8);
    sun.position.set(-3, 4, 3);
    fill = new THREE.DirectionalLight(0xd5e6e4, .35);
    fill.position.set(3, 1, -3);
    scene.add(hemisphere, sun, fill);
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener('resize', resize);
    }
    setLights();
    resize();
  }

  function onControlChange() { needsRender = true; }

  function clearOrbitInertia() {
    if (!controls) return;
    const position = camera.position.clone(), target = controls.target.clone();
    controls.enableDamping = false;
    controls.update();
    camera.position.copy(position);
    controls.target.copy(target);
    controls.update();
    controls.enableDamping = true;
  }

  function syncPose() {
    if (!actor) return;
    for (const [source, destination] of bonePairs) {
      destination.position.copy(source.position);
      destination.quaternion.copy(source.quaternion);
      destination.scale.copy(source.scale);
    }
    actor.root.updateMatrixWorld(true);
  }

  function open(nextResident) {
    if (disposed || !nextResident?.actor || !nextResident?.profile) return false;
    if (!visible) {
      const focused = document.activeElement;
      focusReturn = focused?.id === 'detailView' || focused?.id === 'aquariumCanvas'
        ? focused : document.getElementById('aquariumCanvas') || document.getElementById('detailView');
    }
    visible = true;
    pane.hidden = false;
    if (title) title.textContent = `近看 ${nextResident.profile.name}`;
    if (breed) breed.textContent = nextResident.profile.breed || templates[nextResident.profile.model]?.title || '';
    try {
      initialize();
      const changedResident = !actor || resident?.id !== nextResident.id;
      resident = nextResident;
      if (changedResident) {
        actor?.dispose();
        actor = createGoldfishActor(THREE, templates[resident.profile.model], resident.profile);
        actor.root.position.set(0, 0, 0);
        actor.root.quaternion.identity();
        scene.add(actor.root);
        const length = resident.profile.length || actor.metrics.length || 1.1;
        controls.minDistance = length * .7;
        controls.maxDistance = length * 7;
        controls.target.set(0, 0, 0);
        camera.position.set(1.65, .58, 1.02).multiplyScalar(length / 1.1);
        clearOrbitInertia();
      }
      const sourceBones = new Map(resident.actor.bones.map(bone => [bone.name, bone]));
      bonePairs = actor.bones.map(bone => [sourceBones.get(bone.name), bone]).filter(([source]) => source);
      syncPose();
      controls.enabled = contextAvailable;
      resize();
      needsRender = true;
      if (contextAvailable) showMessage('');
      canvas.focus({preventScroll: true});
      return true;
    } catch (error) {
      console.warn('Fish inspection:', error);
      showMessage('近看视窗暂时无法打开。可以关闭此视窗，继续观察鱼缸。');
      return false;
    }
  }

  function close() {
    if (!visible) return;
    const restoreFocus = pane.contains(document.activeElement);
    clearOrbitInertia();
    if (controls) controls.enabled = false;
    visible = false;
    pane.hidden = true;
    if (restoreFocus && focusReturn?.isConnected) focusReturn.focus({preventScroll: true});
  }

  /** Wheel forwarding from the tank changes only this inspection camera. */
  function zoom(deltaY, deltaMode = 0) {
    if (!visible || !camera || !controls || !contextAvailable || !Number.isFinite(deltaY)) return;
    const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? Math.max(canvas.clientHeight, 400) : 1;
    const pixels = THREE.MathUtils.clamp(deltaY * unit, -800, 800);
    offset.copy(camera.position).sub(controls.target);
    const radius = THREE.MathUtils.clamp(offset.length() * Math.exp(pixels * .0015), controls.minDistance, controls.maxDistance);
    if (offset.lengthSq() < 1e-12) offset.set(1, .3, 1);
    camera.position.copy(controls.target).add(offset.setLength(radius));
    controls.update();
    needsRender = true;
  }

  function update(dt, paused) {
    if (!visible || pane.hidden || !renderer || !actor || !contextAvailable || disposed || document.hidden) return;
    syncPose();
    const changed = controls.update(Math.min(Math.max(dt || 0, 0), .1));
    if (!paused || changed || needsRender) {
      scene.updateMatrixWorld(true);
      renderer.render(scene, camera);
      needsRender = false;
    }
  }

  function setNight(value) { night = Boolean(value); setLights(); }

  function onKeyDown(event) {
    if (!visible || !camera || !controls || !contextAvailable) return;
    if (event.key === '+' || event.key === '=') {
      event.preventDefault(); zoom(-100); return;
    }
    if (event.key === '-') { event.preventDefault(); zoom(100); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
    if (event.key === 'ArrowLeft') spherical.theta -= .12;
    if (event.key === 'ArrowRight') spherical.theta += .12;
    if (event.key === 'ArrowUp') spherical.phi -= .1;
    if (event.key === 'ArrowDown') spherical.phi += .1;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    controls.update();
    needsRender = true;
  }

  function onContextLost(event) {
    event.preventDefault();
    if (disposed) return;
    contextAvailable = false;
    if (controls) controls.enabled = false;
    showMessage('近看视窗的图形连接已中断。可关闭视窗继续观察主鱼缸。');
  }
  function onContextRestored() {
    if (disposed) return;
    contextAvailable = true;
    if (controls) controls.enabled = visible;
    showMessage('');
    needsRender = true;
  }
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  function dispose() {
    if (disposed) return;
    close();
    disposed = true;
    resizeObserver?.disconnect();
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('keydown', onKeyDown);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    controls?.removeEventListener('change', onControlChange);
    controls?.dispose();
    actor?.dispose();
    actor = null;
    resident = null;
    bonePairs = [];
    scene?.clear();
    environmentTarget?.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
    message?.remove();
  }

  return {open, close, zoom, update, setNight, dispose};
}
