import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createSwimmer } from './motion.js';

const $ = id => document.getElementById(id);
const canvas = $('aquariumCanvas');
const loading = $('aquariumLoading');
const pauseButton = $('pauseFish');
const detailButton = $('detailView');
const topButton = $('topView');
const frame = $('aquariumScene');
const SOURCE = 'https://sketchfab.com/3d-models/comet-goldfish-5adcbf784df540a0b46dae8950bd3ec6';
let renderer, scene, camera, controls, fish, swimmer, mixer, swimAction;
let standbyAction, loopBlend = null, clipDuration = 0;
let tank;
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let ready = false, detail = false, lastFrame = 0, cameraTransition = null, needsRender = true;
let metrics = {}, meshes = [], bones = [], elapsed = 0, frameCount = 0;
const smoothedPoses = new Map();
const worldUp = new THREE.Vector3(0, 1, 0);
const vector = new THREE.Vector3();

function fail(error) {
  console.error('Aquarium:', error);
  loading.hidden = false;
  loading.classList.add('is-error');
  loading.querySelector('strong').textContent = '观察室暂时未能打开';
  $('loadMessage').textContent = '请使用支持 WebGL 2 的新版 Chrome 或 Edge，并通过预览地址访问。没有加载成功时不会用图片或简化鱼替代模型。';
  $('aquariumStatus').textContent = '渲染未完成';
}

function makeTank() {
  tank = new THREE.Group();
  tank.name = 'glass-aquarium';
  const base = new THREE.Mesh(new THREE.BoxGeometry(6.2, .12, 3.2), new THREE.MeshStandardMaterial({color:0x2c2a24, roughness:.32, metalness:.25}));
  base.position.y = -1.7;
  tank.add(base);
  const sand = new THREE.Mesh(new THREE.BoxGeometry(5.9, .05, 2.9), new THREE.MeshStandardMaterial({color:0x837965, roughness:.98}));
  sand.position.y = -1.6;
  tank.add(sand);
  // Side walls use physical transmission; the front is a subtle transparent pane,
  // so alpha-blended fin membranes remain visible through multiple glass layers.
  const glass = new THREE.MeshPhysicalMaterial({color:0xc6e1db, roughness:.06, metalness:0, transmission:.97, thickness:.035, ior:1.5, transparent:true, opacity:.28, side:THREE.DoubleSide, depthWrite:false});
  for (const x of [-3, 3]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.3), glass);
    wall.rotation.y = Math.PI/2;
    wall.position.set(x, 0, 0);
    tank.add(wall);
  }
  const frontGlass = new THREE.MeshPhysicalMaterial({color:0xc8dcd1, roughness:.08, metalness:0, clearcoat:.5, transparent:true, opacity:.035, side:THREE.DoubleSide, depthWrite:false});
  for (const z of [-1.5, 1.5]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.3), frontGlass);
    wall.position.z = z;
    tank.add(wall);
  }
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6, 3.3, 3)), new THREE.LineBasicMaterial({color:0xb0c0ab, transparent:true, opacity:.3}));
  tank.add(edges);
  const waterline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(5.96, .005, 2.96)), new THREE.LineBasicMaterial({color:0xd8c1a1, transparent:true, opacity:.22}));
  waterline.position.y = 1.43;
  tank.add(waterline);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(6.4, .34, 3.4), new THREE.MeshStandardMaterial({color:0x171a18, roughness:.27, metalness:.45}));
  stand.position.y = -1.95;
  tank.add(stand);
  scene.add(tank);
}

function setView(position, target, caption) {
  cameraTransition = {position:position.clone(), target:target.clone()};
  needsRender = true;
  $('viewCaption').textContent = caption;
}

function resetView() {
  detail = false;
  if(tank) tank.visible = true;
  detailButton.setAttribute('aria-pressed', 'false');
  const narrow = frame.clientWidth < 650;
  setView(new THREE.Vector3(narrow ? 6.1 : 5.8, narrow ? 3.1 : 2.4, narrow ? 11.2 : 8.9), new THREE.Vector3(0,-.12,0), '夕阳中的观察室');
}

function render() {
  scene.updateMatrixWorld(true);
  renderer.render(scene, camera);
  frameCount++;
  needsRender = false;
}

function step(dt) {
  if (!ready) return;
  elapsed += dt;
  swimmer.update(dt);
  const movement = swimmer.getState();
  // The authored skeleton/cloth-retarget animation drives all fins and the body.
  // Swim cadence follows the fish's actual speed rather than the render frame rate.
  const cadence = .58 + movement.speedNormalized * .55;
  swimAction.setEffectiveTimeScale(cadence);
  standbyAction.setEffectiveTimeScale(cadence);
  // The original clip is not seamless. Overlap the final 0.8 seconds with a
  // second instance of its opening pose instead of wrapping an animation clock.
  if(!loopBlend && swimAction.time >= clipDuration-.8) {
    standbyAction.reset().setLoop(THREE.LoopOnce,1);
    standbyAction.clampWhenFinished = true;
    standbyAction.setEffectiveTimeScale(cadence).setEffectiveWeight(0).play();
    loopBlend = {progress:0};
  }
  if(loopBlend) {
    loopBlend.progress = Math.min(1,loopBlend.progress+dt*cadence/.8);
    const t=loopBlend.progress;
    const blend=t*t*(3-2*t);
    swimAction.setEffectiveWeight(1-blend);
    standbyAction.setEffectiveWeight(blend);
    if(t>=1) {
      swimAction.stop();
      [swimAction,standbyAction]=[standbyAction,swimAction];
      loopBlend=null;
    }
  }
  mixer.update(dt);
  // Add a small continuous turn bend to the animated spine, in each bone's local
  // coordinates. The mixer resets each pose first, so this never accumulates.
  scene.updateMatrixWorld(true);
  const turn = movement.turning || 0;
  for (const bone of bones.filter(b => /Spine[1-4]_/.test(b.name))) {
    const localUp = worldUp.clone().applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
    bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(localUp, turn * .045));
  }
  // Keep the authored motion but soften abrupt fin accelerations in the source
  // keyframes. This operates on weighted bones, preserving real skin deformation.
  const damping=1-Math.exp(-dt/.045);
  for(const bone of bones) {
    let pose=smoothedPoses.get(bone);
    if(!pose) {
      pose={q:bone.quaternion.clone(),p:bone.position.clone(),s:bone.scale.clone()};
      smoothedPoses.set(bone,pose);
    }
    pose.q.slerp(bone.quaternion,damping);
    pose.p.lerp(bone.position,damping);
    pose.s.lerp(bone.scale,damping);
    bone.quaternion.copy(pose.q);
    bone.position.copy(pose.p);
    bone.scale.copy(pose.s);
  }
}

function animate(time) {
  if (!renderer) return;
  const dt = Math.min(Math.max((time-lastFrame)/1000,0), .10);
  lastFrame = time;
  if (document.hidden) return;
  if (!paused) step(dt);
  const transitioning=Boolean(cameraTransition);
  if (cameraTransition) {
    const blend = 1 - Math.exp(-5*dt);
    camera.position.lerp(cameraTransition.position, blend);
    controls.target.lerp(cameraTransition.target, blend);
    if (camera.position.distanceTo(cameraTransition.position)<.006 && controls.target.distanceTo(cameraTransition.target)<.006) cameraTransition = null;
  } else if (detail && ready) {
    const delta = fish.position.clone().sub(controls.target).multiplyScalar(1-Math.exp(-2*dt));
    controls.target.add(delta);
    camera.position.add(delta);
  }
  const controlsChanged=controls.update(dt);
  if((ready && !paused) || transitioning || controlsChanged || needsRender) render();
}

async function initialize() {
  renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true, powerPreference:'high-performance', preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .88;
  renderer.setClearColor(0x111719, 0);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38,1,.05,90);
  camera.position.set(5.8,2.4,8.9);
  controls = new OrbitControls(camera, canvas);
  controls.target.set(0,-.12,0);
  controls.enableDamping = true;
  controls.dampingFactor = .07;
  controls.enablePan = false;
  controls.minDistance = 1.1;
  controls.maxDistance = 18;
  controls.minPolarAngle = .08;
  controls.maxPolarAngle = Math.PI*.86;
  controls.addEventListener('start', () => {cameraTransition = null; $('gestureHint').style.opacity='.45';});
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .035);
  scene.environment = environment.texture;
  scene.environmentIntensity = .5;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xd5ebef,0x453c2b,.9));
  const sun = new THREE.DirectionalLight(0xffd0a0,1.9);
  sun.position.set(-4,5,3);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc9e3e6,.7);
  fill.position.set(3,2,-4);
  scene.add(fill);
  makeTank();
  const resize = () => {
    renderer.setSize(frame.clientWidth, frame.clientHeight, false);
    camera.aspect = frame.clientWidth/frame.clientHeight;
    camera.updateProjectionMatrix();
    needsRender = true;
  };
  new ResizeObserver(resize).observe(frame);
  resize();
  resetView();
  renderer.setAnimationLoop(animate);

  const gltf = await new GLTFLoader().loadAsync('./assets/aquarium/models/comet-goldfish.glb', progress => {
    if (progress.total) $('loadMessage').textContent = `加载本地金鱼与材质… ${Math.round(progress.loaded/progress.total*100)}%`;
  });
  gltf.scene.traverse(object => {
    if (object.isMesh) {
      meshes.push(object);
      object.frustumCulled = false;
      const association=gltf.parser.associations.get(object);
      const assetName=gltf.parser.json.meshes[association?.meshes]?.name || object.name;
      object.userData.sourceMeshName=assetName;
      if (/^body_/.test(assetName)) {
        object.material=object.material.clone();
        object.material.transparent=false;
        object.material.opacity=1;
        object.material.depthWrite=true;
      }
      if (/^eye_/.test(assetName)) {
        object.material=object.material.clone();
        object.material.transmission=0;
        object.material.metalness=0;
        object.material.roughness=.23;
        object.material.roughnessMap=null;
        object.material.transparent=false;
        object.material.opacity=1;
        object.material.depthWrite=true;
      }
      // Preserve the creator's embedded PBR/alpha/normal maps, including fins.
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {material.envMapIntensity = .7; if(material.transparent) material.depthWrite = false;});
    }
    if (object.isBone) bones.push(object);
  });
  if (!meshes.some(mesh => mesh.isSkinnedMesh) || bones.length < 10 || !gltf.animations.length) throw new Error('Model must contain a real skinned mesh and animation.');
  fish = new THREE.Group();
  fish.name = 'single-goldfish';
  const calibration = new THREE.Group();
  calibration.add(gltf.scene);
  fish.add(calibration);
  scene.add(fish);
  scene.updateMatrixWorld(true);
  const head = bones.find(b => /DEF_Head/.test(b.name));
  const tail = bones.find(b => /DEF_Spine5/.test(b.name));
  if (head && tail) {
    const forward = head.getWorldPosition(new THREE.Vector3()).sub(tail.getWorldPosition(new THREE.Vector3()));
    calibration.rotation.y = -Math.atan2(forward.x, forward.z);
  }
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(calibration, true);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 1.35/Math.max(size.x,size.y,size.z);
  calibration.scale.setScalar(scale);
  calibration.position.copy(center.multiplyScalar(-scale));
  mixer = new THREE.AnimationMixer(gltf.scene);
  swimAction = mixer.clipAction(gltf.animations[0]);
  const duplicate=gltf.animations[0].clone();
  duplicate.name='swim-loop-overlap';
  standbyAction=mixer.clipAction(duplicate);
  clipDuration=gltf.animations[0].duration;
  swimAction.setLoop(THREE.LoopOnce,1);
  swimAction.clampWhenFinished=true;
  swimAction.play();
  mixer.update(0);
  swimmer = createSwimmer(THREE,fish);
  metrics = {
    model:'Comet goldfish', creator:'somitsu', license:'CC BY 4.0',
    skinnedMeshes:meshes.filter(m => m.isSkinnedMesh).length,
    meshes:meshes.length, bones:bones.length,
    triangles:meshes.reduce((sum,m) => sum+(m.geometry.index?.count || m.geometry.attributes.position.count)/3,0),
    animations:gltf.animations.map(a => ({name:a.name,duration:a.duration,tracks:a.tracks.length})),
    originalBounds:size.toArray(), textures:[...new Set(meshes.flatMap(m => [m.material.map,m.material.normalMap,m.material.roughnessMap,m.material.metalnessMap,m.material.transmissionMap].filter(Boolean)))].length
  };
  $('modelCredits').innerHTML = `<p><a href="${SOURCE}" target="_blank" rel="noopener">Comet goldfish</a> · 作者 <a href="https://sketchfab.com/somitsu" target="_blank" rel="noopener">somitsu</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>。模型经 <a href="https://objaverse.allenai.org/" target="_blank" rel="noopener">Ai2 / Objaverse</a> 公开数据集取得；保留原始 GLB 与嵌入材质、骨骼和动画。网页调整展示比例、光照、鱼身不透明设置、眼球透射与游动方向，加入动画循环过渡、鱼鳍缓动及轻微转向弯曲。</p><p>原作者使用 Blender 建模、绑定及动画，并将鱼鳍的布料模拟转换为骨骼动画。当前为实时栅格化预览，写实程度请以实际旋转观察与游动效果为准。</p>`;
  $('modelFacts').innerHTML = [['实体网格',metrics.meshes+' 组'],['三角面',metrics.triangles.toLocaleString()],['骨骼',metrics.bones+' 个'],['游动动画',metrics.animations[0].duration.toFixed(1)+' 秒原始动作'],['材质', 'PBR / 法线 / 透明鱼鳍'],['渲染','Three.js r180 / WebGL 2']].map(([term,value])=>`<div><dt>${term}</dt><dd>${value}</dd></div>`).join('');
  ready = true;
  needsRender = true;
  loading.hidden = true;
  [pauseButton, detailButton, topButton].forEach(button => button.disabled = false);
  $('statusDot').classList.add('is-ready');
  updatePauseUI();
  if(new URLSearchParams(location.search).has('debug')) window.aquariumDebug = {
    snapshot:() => ({...metrics,ready,paused,detail,elapsed,frameCount,renderer:renderer.info.render,position:fish.position.toArray(),quaternion:fish.quaternion.toArray(),camera:camera.position.toArray(),motion:swimmer.getState(),bonePoses:bones.map(b=>({name:b.name,q:b.quaternion.toArray(),p:b.position.toArray(),s:b.scale.toArray()})),deformedVertices:meshes.filter(m=>m.isSkinnedMesh).map(m => {m.skeleton.update();return {name:m.userData.sourceMeshName,points:[0,.2,.4,.6,.8].map(f=>m.getVertexPosition(Math.floor((m.geometry.attributes.position.count-1)*f),new THREE.Vector3()).toArray())};})}),
    setPaused:value => {paused=value;updatePauseUI();},
    setFishVisible:value => {fish.visible=value;render();},
    tick:dt => {step(dt);render();},
    simulate:dt => {step(dt);scene.updateMatrixWorld(true);},
    setAnimationTime:time => {mixer.setTime(time);render();},
    capturePixels:() => {const target = new THREE.WebGLRenderTarget(512,320);renderer.setRenderTarget(target);renderer.render(scene,camera);const pixels=new Uint8Array(512*320*4);renderer.readRenderTargetPixels(target,0,0,512,320,pixels);renderer.setRenderTarget(null);target.dispose();render();return Array.from(pixels);}
  };
}

function updatePauseUI() {
  pauseButton.textContent = paused ? '继续游动' : '暂停游动';
  pauseButton.setAttribute('aria-pressed',String(paused));
  $('aquariumStatus').textContent = paused ? '暂停 · 自由观察' : '一尾金鱼 · 自由游动';
}
pauseButton.addEventListener('click', () => {paused=!paused;updatePauseUI();});
detailButton.addEventListener('click', () => {
  detail=!detail;
  detailButton.setAttribute('aria-pressed',String(detail));
  if(detail) {
    tank.visible = false;
    const target=fish.position.clone();
    setView(target.clone().add(new THREE.Vector3(1.45,.48,.85)),target,'细看鳞片与鱼鳍');
  } else resetView();
});
topButton.addEventListener('click', () => {
  detail=false;
  tank.visible=false;
  detailButton.setAttribute('aria-pressed','false');
  const target=fish.position.clone();
  setView(target.clone().add(new THREE.Vector3(.2,3.6,.25)),target,'从上方观察');
});
$('resetView').addEventListener('click',resetView);
canvas.addEventListener('keydown',event => {
  if(!controls) return;
  const offset=camera.position.clone().sub(controls.target);
  const spherical=new THREE.Spherical().setFromVector3(offset);
  if(event.key==='ArrowLeft') spherical.theta-=.12;
  else if(event.key==='ArrowRight') spherical.theta+=.12;
  else if(event.key==='ArrowUp') spherical.phi-=.1;
  else if(event.key==='ArrowDown') spherical.phi+=.1;
  else if(event.key==='+' || event.key==='=') spherical.radius*=.9;
  else if(event.key==='-') spherical.radius*=1.1;
  else return;
  event.preventDefault();
  cameraTransition=null;
  spherical.radius=THREE.MathUtils.clamp(spherical.radius,controls.minDistance,controls.maxDistance);
  spherical.phi=THREE.MathUtils.clamp(spherical.phi,controls.minPolarAngle,controls.maxPolarAngle);
  camera.position.copy(controls.target).add(vector.setFromSpherical(spherical));
  controls.update();
});
canvas.addEventListener('webglcontextlost',event => {event.preventDefault();ready=false;renderer?.setAnimationLoop(null);fail(new Error('WebGL context lost'));});
document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();});
initialize().catch(fail);
