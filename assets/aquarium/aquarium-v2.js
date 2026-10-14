import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createSwimmer } from './motion.js';
import { loadGoldfishModels, createGoldfishActor } from './fish.js';
import { createAquariumEnvironment } from './environment.js';
import { FISH_PROFILES, MODEL_SOURCES } from './catalog.js';
import { createFishInspection } from './inspection.js';

const $=id=>document.getElementById(id);
const canvas=$('aquariumCanvas'), frame=$('aquariumScene'), observatory=document.querySelector('.aquarium-observatory');
const query=new URLSearchParams(location.search), embedded=query.has('embedded');
if(embedded) document.body.classList.add('aquarium-embedded');
const residents=[], food=[], consumed=[], raycaster=new THREE.Raycaster();
const feedingPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-1.25);
const feedingFrontPlane=new THREE.Plane(new THREE.Vector3(0,0,1),0);
let renderer,scene,camera,controls,environment,templates,sun,fill,hemisphere,lamp,inspection;
let ready=false, paused=matchMedia('(prefers-reduced-motion: reduce)').matches, selected='dawn';
let single=query.has('single'), detail=false, night=false, immersive=false, fullscreenConfirmed=false, expectedFullscreenExit=false;
let armed=false, elapsed=0, lastFrame=0, frameCount=0, needsRender=true, nightAmount=0, nextFoodId=0;
let pointerStart=null, toastTimer=0, lastMeal='', embeddedSuspended=false, feedTimes=0, waterSound=null, soundEnabled=false;
const warmSun=new THREE.Color(0xffd0a0), coolSun=new THREE.Color(0x91b5df);
const normalHint='鱼缸视角固定 · 指向金鱼滚轮近看 · 点击投喂';
const activeResidents=()=>residents.filter(r=>!single || r.id===selected);
const currentResident=()=>residents.find(r=>r.id===selected)||residents[0];
let favorites=[];
try{favorites=JSON.parse(localStorage.getItem('wz-aquarium-favorites')||'[]').filter(id=>FISH_PROFILES.some(p=>p.id===id));}catch{}

function fail(error){
  console.error('Aquarium:',error);
  const loader=$('aquariumLoading'); loader.hidden=false;loader.classList.add('is-error');
  loader.querySelector('strong').textContent='观察室暂时未能打开';
  $('loadMessage').textContent='请使用支持 WebGL 2 的新版 Chrome 或 Edge。真实模型未能加载时，不会用图片或简化金鱼替代。';
  $('aquariumStatus').textContent='模型尚未加载';
}
function toast(text){
  const element=$('aquariumToast');element.textContent=text;element.hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>element.hidden=true,3400);
}
function updateStatus(){
  $('pauseFish').textContent=paused?'继续游动':'暂停游动';$('pauseFish').setAttribute('aria-pressed',String(paused));
  $('singleFish').setAttribute('aria-pressed',String(single));$('detailView').setAttribute('aria-pressed',String(detail));
  $('feedFish').setAttribute('aria-pressed',String(armed));canvas.classList.toggle('is-feeding',armed);
  $('gestureHint').textContent=armed?'轻点缸内投喂 · Enter 在中央投喂 · Esc 取消':detail?'近看视窗可旋转与缩放 · 原鱼缸视角固定':normalHint;
  $('aquariumStatus').textContent=armed?'选择一个投喂位置':detail?`正在近看 ${currentResident()?.profile.name||''}`:paused?'暂停 · 自由观察':`${single?'一':'五'}尾金鱼 · ${night?'夜色中的':'夕阳下的'}日常`;
  document.querySelectorAll('[data-fish]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.fish===selected)));
}
function updateVisibility(){
  residents.forEach(r=>r.actor.root.visible=!single||r.id===selected);
  const active=activeResidents();residents.forEach(r=>r.swimmer.setNeighbors(active.filter(n=>n!==r).map(n=>n.actor.root)));
  environment?.setVisible(true);
  if(controls){
    controls.enabled=false;controls.enableRotate=false;controls.enableZoom=false;controls.enableDamping=false;controls.maxDistance=Infinity;
    canvas.style.touchAction='pan-y';controls.update();
  }
  needsRender=true;
}
function setView(position,target,caption){
  // The main aquarium camera only changes for initial framing / viewport resize.
  camera.position.copy(position);controls.target.copy(target);controls.update();
  $('viewCaption').textContent=caption;needsRender=true;
}
function resetView(){
  closeInspection();updateVisibility();
   frameTank();
  if(ready) updateStatus();
}
function frameTank(){
  const narrow=document.documentElement.clientWidth<=1100;
  const target=new THREE.Vector3(0,viewFromAbove?-.05:narrow?-.12:.3,0), position=viewFromAbove?new THREE.Vector3(.1,8.3,.35):new THREE.Vector3(narrow?5.5:1.15,narrow?2.7:.7,narrow?15:9.4);
  if(narrow||viewFromAbove)position.sub(target).multiplyScalar(Math.max(1,(viewFromAbove?1.35:.76)/camera.aspect)).add(target);
  setView(position,target,viewFromAbove?'从上方观察':night?'夜色下的鱼缸':'夕光落入水中');
}
function focusFish(id){
  const resident=residents.find(r=>r.id===id);if(!resident)return;
  selected=id;detail=true;armed=false;updateVisibility();inspection.open(resident);updateStatus();
}
function closeInspection(){detail=false;inspection?.close();if(ready)updateStatus();}
function setNight(value){
  night=Boolean(value);document.body.dataset.light=night?'night':'sunset';
  $('nightMode').setAttribute('aria-pressed',String(night));$('sunsetMode').setAttribute('aria-pressed',String(!night));
  environment?.setNight(night);
  inspection?.setNight(night);
  if($('lightState'))$('lightState').textContent=night?'夜色 · 月白缸灯':'夕阳 · 暖光缸灯';
  if($('statusWaterTime'))$('statusWaterTime').textContent=night?'夜色':'夕阳';
  if(!detail)$('viewCaption').textContent=night?'夜色下的鱼缸':'夕光落入水中';
  if(ready)updateStatus();needsRender=true;
}
function updateLight(dt){
  nightAmount=THREE.MathUtils.damp(nightAmount,night?1:0,3,dt);
  sun.color.copy(warmSun).lerp(coolSun,nightAmount);
  sun.intensity=THREE.MathUtils.lerp(1.9,.22,nightAmount);
  hemisphere.intensity=THREE.MathUtils.lerp(.55,.24,nightAmount);
  fill.intensity=THREE.MathUtils.lerp(.3,.55,nightAmount);
  lamp.intensity=THREE.MathUtils.lerp(.15,3.4,nightAmount);
  scene.environmentIntensity=THREE.MathUtils.lerp(.42,.27,nightAmount);
  renderer.toneMappingExposure=THREE.MathUtils.lerp(.96,.8,nightAmount);
}
function render(){scene.updateMatrixWorld(true);renderer.render(scene,camera);frameCount++;needsRender=false;}

const grainGeometry=new THREE.SphereGeometry(.027,7,5);
const grainMaterial=new THREE.MeshStandardMaterial({color:0x9c6637,roughness:.9});
function addFood(position,count=6){
  if(!ready)return;
  if(food.filter(p=>p.active).length>=18){toast('水中还有食物，先慢慢观察它们。');return;}
  const center=position.clone();center.x=THREE.MathUtils.clamp(center.x,-1.8,1.8);center.z=THREE.MathUtils.clamp(center.z,-.46,.46);
  for(let i=0;i<count;i++){
    const mesh=new THREE.Mesh(grainGeometry,grainMaterial);mesh.position.copy(center);
    mesh.position.x=THREE.MathUtils.clamp(center.x+(Math.random()-.5)*.28,-1.85,1.85);
    mesh.position.z=THREE.MathUtils.clamp(center.z+(Math.random()-.5)*.2,-.5,.5);
    mesh.position.y=center.y+(Math.random()-.5)*.05;scene.add(mesh);
    food.push({id:++nextFoodId,mesh,position:mesh.position,active:true,born:elapsed,drift:Math.random()*Math.PI*2,sink:.037+Math.random()*.016});
  }
  environment?.addRipple(center);armed=false;feedTimes++;
  if($('statusFeedCount'))$('statusFeedCount').textContent=`${feedTimes} 次`;
  toast(`投下 ${count} 粒食物，看看谁先游过来。`);updateStatus();needsRender=true;
}
function clearFood(){for(const pellet of food)scene.remove(pellet.mesh);food.length=0;residents.forEach(r=>r.swimmer.setFoodTarget(null));}
function step(dt){
  if(!ready||dt<=0)return;
  elapsed+=dt;
  const active=activeResidents();
  for(const pellet of food){
    if(!pellet.active)continue;
    pellet.position.y-=pellet.sink*dt;
    pellet.position.x+=Math.sin(elapsed*.65+pellet.drift)*.006*dt;
    if(elapsed-pellet.born>35||pellet.position.y<-1.3){pellet.active=false;scene.remove(pellet.mesh);}
  }
  for(const resident of active){
    const root=resident.actor.root;
    const mouth=resident.actor.mouthPosition(new THREE.Vector3());
    const available=food.filter(p=>p.active&&elapsed-p.born>(1.3-resident.profile.curiosity)*1.6);
    const nearest=available.sort((a,b)=>mouth.distanceToSquared(a.position)-mouth.distanceToSquared(b.position))[0];
    resident.swimmer.setFoodTarget(nearest?.position||null);
    resident.swimmer.update(dt);
    const movement=resident.swimmer.getState();
    const biteAge=elapsed-resident.lastBite;
    const bite=biteAge>=0&&biteAge<1.35?Math.sin(biteAge/1.35*Math.PI)*Math.sin(biteAge/1.35*Math.PI):0;
    resident.actor.updateAnimation(dt,movement,{bite});
  }
  scene.updateMatrixWorld(true);
  for(const resident of active){
    if(elapsed-resident.lastBite<.9)continue;
    const mouth=resident.actor.mouthPosition(new THREE.Vector3());
    const pellet=food.find(p=>p.active&&mouth.distanceTo(p.position)<.16);
    if(!pellet)continue;
    pellet.active=false;scene.remove(pellet.mesh);resident.lastBite=elapsed;resident.meals++;
    consumed.push({grainId:pellet.id,fishId:resident.id,time:elapsed,mouth:mouth.toArray(),food:pellet.position.toArray()});
    if(consumed.length>200)consumed.shift();
    lastMeal=`${resident.profile.name} 找到了食物`;toast(lastMeal);
    const badge=$('fishList').querySelector(`[data-fish="${resident.id}"] small`);
    if(badge)badge.textContent=`${resident.profile.habit} · ${resident.meals} 粒`;
  }
  if(food.length>50){for(let i=food.length-1;i>=0;i--)if(!food[i].active)food.splice(i,1);}
  environment.update(dt,elapsed);
}
function animate(time){
  const dt=Math.min(Math.max((time-lastFrame)/1000,0),.1);lastFrame=time;
  if(document.hidden||embeddedSuspended)return;
  updateLight(dt);if(!paused)step(dt);
  const movingCamera=Boolean(transition);
  if(transition){
    const t=THREE.MathUtils.clamp((time-transition.start)/650,0,1), blend=t*t*(3-2*t);
    camera.position.lerpVectors(transition.from,transition.to,blend);controls.target.lerpVectors(transition.fromTarget,transition.target,blend);
    if(t===1)transition=null;
  }
  const changed=controls.update(dt);
  if(!paused||movingCamera||changed||needsRender||Math.abs(nightAmount-(night?1:0))>.002)render();
  inspection?.update(dt,paused);
}

function fillCatalog(){
  $('fishList').innerHTML=FISH_PROFILES.map(p=>`<div class="fish-row" style="--fish-accent:${p.accent}"><button class="fish-observe" type="button" data-fish="${p.id}" aria-pressed="${p.id===selected}"><img class="fish-portrait" data-portrait="${p.id}" alt="${p.name}的三维模型近景" width="64" height="64" hidden><span class="fish-copy"><strong>${p.name}</strong><small>${p.habit}</small></span></button><button class="fish-favorite" data-favorite="${p.id}" type="button" aria-label="收藏${p.name}" aria-pressed="${favorites.includes(p.id)}"><img class="cinematic-icon" src="assets/aquarium/icons/heart.svg" width="25" height="25" alt=""></button></div>`).join('');
  $('atlasCards').innerHTML=FISH_PROFILES.map((p,i)=>`<article style="--fish-accent:${p.accent}"><span class="aquarium-atlas-number">0${i+1} / ${p.habit}</span><h3>${p.name}<small>${p.breed}</small></h3><p>${p.description}</p><p class="aquarium-atlas-note">${p.note}</p><button type="button" data-observe="${p.id}">观察 ${p.name} ↗</button></article>`).join('');
  $('fishList').addEventListener('click',event=>{
    const favorite=event.target.closest('[data-favorite]');
    if(favorite){const id=favorite.dataset.favorite;if(favorites.includes(id))favorites=favorites.filter(value=>value!==id);else favorites.push(id);favorite.setAttribute('aria-pressed',String(favorites.includes(id)));try{localStorage.setItem('wz-aquarium-favorites',JSON.stringify(favorites));}catch{}return;}
    const button=event.target.closest('[data-fish]');if(button&&ready)focusFish(button.dataset.fish);
  });
  $('atlasCards').addEventListener('click',event=>{const button=event.target.closest('[data-observe]');if(button){$('fishAtlas').close();focusFish(button.dataset.observe);}});
}
async function createFishPortraits(){
  const portraitScene=new THREE.Scene();portraitScene.background=new THREE.Color(0x3f3a2c);portraitScene.environment=scene.environment;portraitScene.environmentIntensity=.42;
  portraitScene.add(new THREE.HemisphereLight(0xffeed6,0x3b3526,.8));
  const light=new THREE.DirectionalLight(0xffdcab,1.7);light.position.set(-2,4,3);portraitScene.add(light);
  const portraitCamera=new THREE.PerspectiveCamera(32,1,.05,20);
  const target=new THREE.WebGLRenderTarget(192,192);target.texture.colorSpace=THREE.SRGBColorSpace;
  const raw=new Uint8Array(192*192*4),flipped=new Uint8ClampedArray(raw.length),imageCanvas=document.createElement('canvas');imageCanvas.width=imageCanvas.height=192;
  const context=imageCanvas.getContext('2d');
  try{
    for(const profile of FISH_PROFILES){
      await new Promise(resolve=>setTimeout(resolve,50));
      const actor=createGoldfishActor(THREE,templates[profile.model],profile);portraitScene.add(actor.root);
      portraitCamera.position.set(1.6,.38,1.7).multiplyScalar(profile.length/1.1);portraitCamera.lookAt(0,0,0);
      portraitScene.updateMatrixWorld(true);renderer.setRenderTarget(target);renderer.render(portraitScene,portraitCamera);renderer.readRenderTargetPixels(target,0,0,192,192,raw);
      for(let y=0;y<192;y++)flipped.set(raw.subarray((191-y)*192*4,(192-y)*192*4),y*192*4);
      context.putImageData(new ImageData(flipped,192,192),0,0);
      const image=$('fishList').querySelector(`[data-portrait="${profile.id}"]`);if(image){image.src=imageCanvas.toDataURL('image/webp',.9);image.hidden=false;}
      actor.dispose();renderer.setRenderTarget(null);needsRender=true;
    }
  }finally{renderer.setRenderTarget(null);target.dispose();}
  needsRender=true;
}
async function initialize(){
  renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,document.documentElement.clientWidth<=1100?1.25:1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.setClearColor(0x111719,0);
  renderer.shadowMap.enabled=document.documentElement.clientWidth>1100;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(32,1,.05,80);camera.position.set(1.15,.6,9.5);
  controls=new OrbitControls(camera,canvas);controls.target.set(0,-.12,0);controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=false;
  controls.minDistance=1.15;controls.maxDistance=18;controls.minPolarAngle=.08;controls.maxPolarAngle=Math.PI*.83;
  controls.addEventListener('start',()=>transition=null);
  const pmrem=new THREE.PMREMGenerator(renderer), room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.035).texture;room.dispose();pmrem.dispose();
  hemisphere=new THREE.HemisphereLight(0xd5ebef,0x453c2b,.85);scene.add(hemisphere);
  sun=new THREE.DirectionalLight(0xffd0a0,1.9);sun.position.set(-4,6,4);sun.castShadow=renderer.shadowMap.enabled;sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:18});sun.shadow.bias=-.0004;sun.shadow.normalBias=.025;scene.add(sun);
  fill=new THREE.DirectionalLight(0xc3dce7,.65);fill.position.set(3,2,-4);scene.add(fill);
  lamp=new THREE.PointLight(0xffc17e,.15,9,2);lamp.position.set(-3.2,1.2,1.4);scene.add(lamp);
  environment=createAquariumEnvironment(THREE,scene,renderer);
  environment.group.traverse(object=>{if(object.isMesh){object.receiveShadow=true;object.castShadow=!object.material.transparent;}});
  let lastNarrowLayout, lastFrameAspect;
  const resize=()=>{
    renderer.setSize(frame.clientWidth,frame.clientHeight,false);camera.aspect=frame.clientWidth/frame.clientHeight;camera.updateProjectionMatrix();needsRender=true;
    const nextNarrowLayout=document.documentElement.clientWidth<=1100;
    if(ready&&frame.clientWidth>0&&frame.clientHeight>0&&lastNarrowLayout!==undefined&&(nextNarrowLayout!==lastNarrowLayout||Math.abs(camera.aspect-lastFrameAspect)>.001))frameTank();
    lastNarrowLayout=nextNarrowLayout;lastFrameAspect=camera.aspect;
  };
  new ResizeObserver(resize).observe(frame);resize();updateLight(0);resetView();fillCatalog();
  renderer.setAnimationLoop(animate);
  [templates]=await Promise.all([loadGoldfishModels(progress=>$('loadMessage').textContent=`加载金鱼与材质… ${Math.round(progress*100)}%`),environment.ready]);
  for(const profile of FISH_PROFILES){
    const actor=createGoldfishActor(THREE,templates[profile.model],profile);scene.add(actor.root);scene.updateMatrixWorld(true);
    const mouthLocal=actor.root.worldToLocal(actor.mouthPosition(new THREE.Vector3())).toArray();
    actor.meshes.forEach(mesh=>{mesh.userData.fishId=profile.id;mesh.castShadow=true;});
    const swimmer=createSwimmer(THREE,actor.root,{...profile,bodyLength:profile.length,mouthOffset:mouthLocal});
    residents.push({id:profile.id,profile,actor,swimmer,meals:0,lastBite:-100});
  }
  residents.forEach(r=>r.swimmer.setNeighbors(residents.filter(n=>n!==r).map(n=>n.actor.root)));
  inspection=createFishInspection(THREE,templates);
  $('modelCredits').innerHTML=`<p><a href="${MODEL_SOURCES.comet.url}" target="_blank" rel="noopener">Comet goldfish</a> 与 <a href="${MODEL_SOURCES.tosakin.url}" target="_blank" rel="noopener">Tosakin goldfish</a>，作者 <a href="https://sketchfab.com/somitsu" target="_blank" rel="noopener">somitsu</a>，均采用 <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>。由 <a href="https://objaverse.allenai.org/" target="_blank" rel="noopener">Ai2 / Objaverse</a> 公开数据集取得，原始 GLB 字节保留。本网站调整材质、光照、模型比例、动画过渡与骨骼缓动，并加入游动、投喂及进食控制；原作者不为本网站背书。</p><p>五尾金鱼来自两种实体模型，各自拥有独立骨骼与动画时钟。本次氛围升级保留金鱼模型、材质与游动控制。鱼缸、水草和岩石为三维几何；岩石和底砂使用 <a href="https://polyhaven.com/license" target="_blank" rel="noopener">Poly Haven CC0</a> 摄影纹理，作者 Rob Tuytel。客厅背景与叶面纹理由 AI 生成；背景不包含鱼或鱼缸。个体头像来自真实模型的渲染，没有用二维鱼图替代游动模型。图标为本地 Phosphor Icons（MIT）。</p>`;
  $('modelFacts').innerHTML=[['金鱼','五尾 / 两种实体模型'],['Comet','47 骨骼 / 10,916 三角面'],['Tosakin','64 骨骼 / 19,560 三角面'],['材质','本地 PBR / 透明鱼鳍'],['渲染','Three.js r180 / WebGL 2']].map(([t,v])=>`<div><dt>${t}</dt><dd>${v}</dd></div>`).join('');
  createFishPortraits().catch(error=>console.warn('Fish portrait:',error));ready=true;updateVisibility();updateStatus();$('aquariumLoading').hidden=true;$('statusDot').classList.add('is-ready');
  document.querySelectorAll('.aquarium-buttons button').forEach(button=>button.disabled=false);
  setNight(query.has('night'));
  if(query.has('debug'))installDebug();
}

function installDebug(){
  window.aquariumDebug={
    snapshot:()=>({ready,paused,single,detail,night,immersive,armed,elapsed,frameCount,selected,cameraTransition:Boolean(transition),visibility:document.visibilityState,camera:camera.position.toArray(),renderer:{...renderer.info.render},environmentObjects:environment.group.children.length,
      fish:residents.map(r=>({id:r.id,model:r.profile.model,visible:r.actor.root.visible,profile:r.profile.habit,metrics:r.actor.metrics,position:r.actor.root.position.toArray(),quaternion:r.actor.root.quaternion.toArray(),mouth:r.actor.mouthPosition(new THREE.Vector3()).toArray(),motion:r.swimmer.getState(),meals:r.meals,animation:r.actor.animationState(),jaw:r.actor.bones.filter(b=>/Jaw|Mouth/i.test(b.name)).map(b=>({name:b.name,q:b.quaternion.toArray(),p:b.position.toArray()}))})),food:food.filter(p=>p.active).map(p=>({id:p.id,p:p.position.toArray()})),consumed:[...consumed]}),
    setPaused:value=>{paused=Boolean(value);updateStatus();},
    setFishVisible:(id,value)=>{if(typeof id==='boolean')residents.forEach(r=>r.actor.root.visible=id);else residents.find(r=>r.id===id).actor.root.visible=value;render();},
    tick:dt=>{step(dt);render();},simulate:dt=>{step(dt);scene.updateMatrixWorld(true);},
    addFood:(point,count=6)=>addFood(new THREE.Vector3(...point),count),clearFood,
    capturePixels:()=>{const target=new THREE.WebGLRenderTarget(512,320);renderer.setRenderTarget(target);renderer.render(scene,camera);const pixels=new Uint8Array(512*320*4);renderer.readRenderTargetPixels(target,0,0,512,320,pixels);renderer.setRenderTarget(null);target.dispose();render();return Array.from(pixels);}
  };
}

function armFeed(){
  if(!ready)return;
  closeInspection();armed=!armed;
  if(armed)paused=false;updateStatus();
}
async function toggleWaterSound(){
  if(!waterSound){
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass){toast('此浏览器暂不支持水声。');return;}
    const context=new AudioContextClass(),buffer=context.createBuffer(1,context.sampleRate*5,context.sampleRate),samples=buffer.getChannelData(0);
    let brown=0;
    for(let i=0;i<samples.length;i++){brown=(brown+(Math.random()*2-1)*.035)/1.02;samples[i]=brown*(.66+.12*Math.sin(i/context.sampleRate*2.1));}
    const source=context.createBufferSource();source.buffer=buffer;source.loop=true;
    const filter=context.createBiquadFilter();filter.type='bandpass';filter.frequency.value=760;filter.Q.value=.38;
    const gain=context.createGain();gain.gain.value=0;source.connect(filter).connect(gain).connect(context.destination);source.start();waterSound={context,gain};
  }
  soundEnabled=!soundEnabled;
  try{await waterSound.context.resume();waterSound.gain.gain.setTargetAtTime(soundEnabled ? .22 : 0,waterSound.context.currentTime,.12);}catch{soundEnabled=false;toast('请再次点击开启水声。');}
  $('soundWater').setAttribute('aria-pressed',String(soundEnabled));$('soundState').textContent=soundEnabled?'开启 · 轻柔流水':'关闭 · 点击开启';
}
function syncWaterSound(){
  if(!waterSound)return;
  if(document.hidden||embeddedSuspended)waterSound.context.suspend().catch(()=>{});else if(soundEnabled)waterSound.context.resume().catch(()=>{});
}
function rayAtCanvasPoint(event){
  const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height*2-1)),camera);
}
function hitFish(){
  const meshes=residents.filter(r=>r.actor.root.visible).flatMap(r=>r.actor.meshes);
  return raycaster.intersectObjects(meshes,false).find(hit=>hit.object.userData.fishId);
}
function onCanvasClick(event){
  if(!ready||!pointerStart||Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>7)return;
  rayAtCanvasPoint(event);
  if(armed){
    let point=raycaster.ray.intersectPlane(feedingPlane,new THREE.Vector3());
    if(!point){point=raycaster.ray.intersectPlane(feedingFrontPlane,new THREE.Vector3());if(point&&(Math.abs(point.x)>3||point.y<-1.4||point.y>1.5))point=null;}
    if(point){point.y=1.25;addFood(point);}else toast('请点击缸内水域，或按 Enter 在中央投喂。');return;
  }
  const hit=hitFish();if(hit)focusFish(hit.object.userData.fishId);
}
canvas.addEventListener('pointerdown',event=>pointerStart={x:event.clientX,y:event.clientY});canvas.addEventListener('pointerup',onCanvasClick);
canvas.addEventListener('wheel',event=>{
  if(!ready||armed||event.ctrlKey||!event.deltaY)return;
  rayAtCanvasPoint(event);const hit=hitFish();if(!hit)return;
  event.preventDefault();
  const opening=!detail||selected!==hit.object.userData.fishId;
  if(opening)focusFish(hit.object.userData.fishId);
  inspection.zoom(opening?Math.sign(event.deltaY)*60:event.deltaY,opening?0:event.deltaMode);
},{passive:false});
$('closeInspection').addEventListener('click',closeInspection);
$('feedFish').addEventListener('click',armFeed);
$('soundWater')?.addEventListener('click',toggleWaterSound);
$('pauseFish').addEventListener('click',()=>{paused=!paused;if(paused)armed=false;updateStatus();});
$('detailView').addEventListener('click',()=>detail?closeInspection():focusFish(selected));
$('resetView').addEventListener('click',resetView);
$('topView').addEventListener('click',()=>{closeInspection();updateVisibility();viewFromAbove=true;frameTank();updateStatus();});
$('singleFish').addEventListener('click',()=>{single=!single;clearFood();resetView();updateStatus();});
$('nightMode').addEventListener('click',()=>setNight(!night));$('sunsetMode').addEventListener('click',()=>setNight(false));
$('openAtlas').addEventListener('click',()=>$('fishAtlas').showModal());$('closeAtlas').addEventListener('click',()=>$('fishAtlas').close());
$('fishAtlas').addEventListener('click',event=>{if(event.target===$('fishAtlas')){const rect=$('fishAtlas').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$('fishAtlas').close();}});
function setImmersive(value){
  immersive=Boolean(value);document.body.classList.toggle('aq-immersive',immersive);$('immersiveButton').setAttribute('aria-pressed',String(immersive));
  const immersiveLabel=$('immersiveButton').querySelector('[data-immersive-label]');if(immersiveLabel)immersiveLabel.textContent=immersive?'退出观察':'观察模式';else $('immersiveButton').textContent=immersive?'退出沉浸 ×':'沉浸观察 ↗';needsRender=true;
  if(embedded)parent.postMessage({type:'wz-aquarium-immersive',active:immersive},location.origin);
}
function exitNativeFullscreen(){
  if(!document.fullscreenElement)return;
  expectedFullscreenExit=true;
  document.exitFullscreen().catch(()=>expectedFullscreenExit=false);
}
$('immersiveButton').addEventListener('click',()=>{
  if(immersive){setImmersive(false);exitNativeFullscreen();return;}
  // Keep the observation view inside the browser viewport. Native fullscreen
  // can replace its viewport mid-transition and crop the persistent controls.
  setImmersive(true);
});
document.addEventListener('fullscreenchange',()=>{
  if(document.fullscreenElement===observatory){fullscreenConfirmed=true;return;}
  const expected=expectedFullscreenExit;expectedFullscreenExit=false;
  if(fullscreenConfirmed){fullscreenConfirmed=false;if(!expected)setImmersive(false);}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('fishAtlas').open){if(armed){armed=false;updateStatus();}else if(detail){closeInspection();}else if(immersive){setImmersive(false);exitNativeFullscreen();}}});
canvas.addEventListener('keydown',event=>{
  if(!ready)return;
  if(event.key==='Enter'&&armed){event.preventDefault();addFood(new THREE.Vector3(0,1.25,0));return;}
});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();ready=false;renderer?.setAnimationLoop(null);fail(new Error('WebGL context lost'));});
document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();syncWaterSound();});
if(embedded)addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='wz-aquarium-visibility')return;
  embeddedSuspended=!event.data.visible;lastFrame=performance.now();needsRender=true;syncWaterSound();
});
initialize().catch(fail);
