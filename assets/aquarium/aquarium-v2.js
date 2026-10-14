import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createSwimmer } from './motion.js';
import { loadGoldfishModels, createGoldfishActor } from './fish.js';
import { createAquariumEnvironment } from './environment.js';
import { FISH_PROFILES, MODEL_SOURCES } from './catalog.js';

const $=id=>document.getElementById(id);
const canvas=$('aquariumCanvas'), frame=$('aquariumScene'), observatory=document.querySelector('.aquarium-observatory');
const query=new URLSearchParams(location.search), embedded=query.has('embedded');
if(embedded) document.body.classList.add('aquarium-embedded');
const residents=[], food=[], consumed=[], raycaster=new THREE.Raycaster();
const feedingPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-1.25);
let renderer,scene,camera,controls,environment,templates,sun,fill,hemisphere,lamp;
let ready=false, paused=matchMedia('(prefers-reduced-motion: reduce)').matches, selected='dawn';
let single=query.has('single'), detail=false, night=false, immersive=false, fullscreenConfirmed=false, expectedFullscreenExit=false;
let armed=false, elapsed=0, lastFrame=0, frameCount=0, needsRender=true, transition=null, nightAmount=0, nextFoodId=0;
let pointerStart=null, toastTimer=0, lastMeal='', embeddedSuspended=false;
const warmSun=new THREE.Color(0xffd0a0), coolSun=new THREE.Color(0x91b5df);
const normalHint='拖动环绕 · 滚轮拉近 · 点选一条金鱼';
const activeResidents=()=>residents.filter(r=>(!single&&!detail) || r.id===selected);
const currentResident=()=>residents.find(r=>r.id===selected)||residents[0];

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
  $('gestureHint').textContent=armed?'轻点缸内投喂 · Enter 在中央投喂 · Esc 取消':normalHint;
  $('aquariumStatus').textContent=armed?'选择一个投喂位置':paused?'暂停 · 自由观察':detail?`正在近看 ${currentResident()?.profile.name||''}`:`${single?'一':'五'}尾金鱼 · ${night?'夜色中的':'夕阳下的'}日常`;
  document.querySelectorAll('[data-fish]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.fish===selected)));
}
function updateVisibility(){
  residents.forEach(r=>r.actor.root.visible=(!single||r.id===selected)&&(!detail||r.id===selected));
  const active=activeResidents();residents.forEach(r=>r.swimmer.setNeighbors(active.filter(n=>n!==r).map(n=>n.actor.root)));
  environment?.setVisible(!detail);
  needsRender=true;
}
function setView(position,target,caption){
  transition={from:camera.position.clone(),fromTarget:controls.target.clone(),to:position.clone(),target:target.clone(),start:performance.now()};
  $('viewCaption').textContent=caption;needsRender=true;
}
function resetView(){
  detail=false;updateVisibility();
  const narrow=frame.clientWidth<650;
  setView(new THREE.Vector3(narrow?6.4:4.5,narrow?3.1:2.1,narrow?11.5:7.7),new THREE.Vector3(0,-.12,0),night?'夜色下的鱼缸':'夕光落入水中');
  if(ready) updateStatus();
}
function focusFish(id){
  const resident=residents.find(r=>r.id===id);if(!resident)return;
  selected=id;detail=true;armed=false;updateVisibility();
  const target=resident.actor.root.position.clone(), distance=resident.profile.length/1.1;
  setView(target.clone().add(new THREE.Vector3(1.65,.62,.98).multiplyScalar(distance)),target,`${resident.profile.name} · ${resident.profile.breed}`);
  updateStatus();
}
function setNight(value){
  night=Boolean(value);document.body.dataset.light=night?'night':'sunset';
  $('nightMode').setAttribute('aria-pressed',String(night));$('sunsetMode').setAttribute('aria-pressed',String(!night));
  environment?.setNight(night);
  if(!detail)$('viewCaption').textContent=night?'夜色下的鱼缸':'夕光落入水中';
  if(ready)updateStatus();needsRender=true;
}
function updateLight(dt){
  nightAmount=THREE.MathUtils.damp(nightAmount,night?1:0,3,dt);
  sun.color.copy(warmSun).lerp(coolSun,nightAmount);
  sun.intensity=THREE.MathUtils.lerp(1.9,.22,nightAmount);
  hemisphere.intensity=THREE.MathUtils.lerp(.85,.42,nightAmount);
  fill.intensity=THREE.MathUtils.lerp(.65,1.05,nightAmount);
  lamp.intensity=THREE.MathUtils.lerp(.15,3.4,nightAmount);
  scene.environmentIntensity=THREE.MathUtils.lerp(.48,.3,nightAmount);
  renderer.toneMappingExposure=THREE.MathUtils.lerp(.88,.86,nightAmount);
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
  environment?.addRipple(center);armed=false;
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
  }else if(detail&&ready){
    const delta=currentResident().actor.root.position.clone().sub(controls.target).multiplyScalar(1-Math.exp(-2*dt));
    controls.target.add(delta);camera.position.add(delta);
  }
  const changed=controls.update(dt);
  if(!paused||movingCamera||changed||needsRender||Math.abs(nightAmount-(night?1:0))>.002)render();
}

function fillCatalog(){
  $('fishList').innerHTML=FISH_PROFILES.map(p=>`<button type="button" data-fish="${p.id}" aria-pressed="${p.id===selected}" style="--fish-accent:${p.accent}"><span class="fish-marker"></span><strong>${p.name}</strong><small>${p.habit}</small><span class="fish-card-arrow">↗</span></button>`).join('');
  $('atlasCards').innerHTML=FISH_PROFILES.map((p,i)=>`<article style="--fish-accent:${p.accent}"><span class="aquarium-atlas-number">0${i+1} / ${p.habit}</span><h3>${p.name}<small>${p.breed}</small></h3><p>${p.description}</p><p class="aquarium-atlas-note">${p.note}</p><button type="button" data-observe="${p.id}">观察 ${p.name} ↗</button></article>`).join('');
  $('fishList').addEventListener('click',event=>{const button=event.target.closest('[data-fish]');if(button&&ready)focusFish(button.dataset.fish);});
  $('atlasCards').addEventListener('click',event=>{const button=event.target.closest('[data-observe]');if(button){$('fishAtlas').close();focusFish(button.dataset.observe);}});
}
async function initialize(){
  renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,frame.clientWidth<650?1.25:1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.setClearColor(0x111719,0);
  renderer.shadowMap.enabled=frame.clientWidth>650;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,1,.05,80);camera.position.set(5.6,2.65,9.2);
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
  const resize=()=>{renderer.setSize(frame.clientWidth,frame.clientHeight,false);camera.aspect=frame.clientWidth/frame.clientHeight;camera.updateProjectionMatrix();needsRender=true;};
  new ResizeObserver(resize).observe(frame);resize();updateLight(0);resetView();fillCatalog();
  renderer.setAnimationLoop(animate);
  templates=await loadGoldfishModels(progress=>$('loadMessage').textContent=`加载金鱼与材质… ${Math.round(progress*100)}%`);
  for(const profile of FISH_PROFILES){
    const actor=createGoldfishActor(THREE,templates[profile.model],profile);scene.add(actor.root);scene.updateMatrixWorld(true);
    const mouthLocal=actor.root.worldToLocal(actor.mouthPosition(new THREE.Vector3())).toArray();
    actor.meshes.forEach(mesh=>{mesh.userData.fishId=profile.id;mesh.castShadow=true;});
    const swimmer=createSwimmer(THREE,actor.root,{...profile,bodyLength:profile.length,mouthOffset:mouthLocal});
    residents.push({id:profile.id,profile,actor,swimmer,meals:0,lastBite:-100});
  }
  residents.forEach(r=>r.swimmer.setNeighbors(residents.filter(n=>n!==r).map(n=>n.actor.root)));
  $('modelCredits').innerHTML=`<p><a href="${MODEL_SOURCES.comet.url}" target="_blank" rel="noopener">Comet goldfish</a> 与 <a href="${MODEL_SOURCES.tosakin.url}" target="_blank" rel="noopener">Tosakin goldfish</a>，作者 <a href="https://sketchfab.com/somitsu" target="_blank" rel="noopener">somitsu</a>，均采用 <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>。由 <a href="https://objaverse.allenai.org/" target="_blank" rel="noopener">Ai2 / Objaverse</a> 公开数据集取得，原始 GLB 字节保留。本网站调整材质、光照、模型比例、动画过渡与骨骼缓动，并加入游动、投喂及进食控制；原作者不为本网站背书。</p><p>五尾金鱼来自两种实体模型，各自拥有独立的骨骼与动画时钟。鱼缸景物和纹理由本站生成；没有用二维鱼图替代模型。</p>`;
  $('modelFacts').innerHTML=[['金鱼','五尾 / 两种实体模型'],['Comet','47 骨骼 / 10,916 三角面'],['Tosakin','64 骨骼 / 19,560 三角面'],['材质','本地 PBR / 透明鱼鳍'],['渲染','Three.js r180 / WebGL 2']].map(([t,v])=>`<div><dt>${t}</dt><dd>${v}</dd></div>`).join('');
  ready=true;updateVisibility();updateStatus();$('aquariumLoading').hidden=true;$('statusDot').classList.add('is-ready');
  document.querySelectorAll('.aquarium-buttons button').forEach(button=>button.disabled=false);
  if(query.has('night'))setNight(true);
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
  if(detail)resetView();armed=!armed;
  if(armed)paused=false;updateStatus();
}
function onCanvasClick(event){
  if(!ready||!pointerStart||Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>7)return;
  const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height*2-1)),camera);
  if(armed){const point=raycaster.ray.intersectPlane(feedingPlane,new THREE.Vector3());if(point){point.y=1.25;addFood(point);}return;}
  const meshes=residents.filter(r=>r.actor.root.visible).flatMap(r=>r.actor.meshes);
  const hit=raycaster.intersectObjects(meshes,false).find(hit=>hit.object.userData.fishId);if(hit)focusFish(hit.object.userData.fishId);
}
canvas.addEventListener('pointerdown',event=>pointerStart={x:event.clientX,y:event.clientY});canvas.addEventListener('pointerup',onCanvasClick);
$('feedFish').addEventListener('click',armFeed);
$('pauseFish').addEventListener('click',()=>{paused=!paused;if(paused)armed=false;updateStatus();});
$('detailView').addEventListener('click',()=>detail?resetView():focusFish(selected));
$('resetView').addEventListener('click',resetView);
$('topView').addEventListener('click',()=>{detail=false;updateVisibility();const target=new THREE.Vector3(0,-.05,0);setView(new THREE.Vector3(.1,8.3,.35),target,'从上方观察');updateStatus();});
$('singleFish').addEventListener('click',()=>{single=!single;if(single)selected='dawn';clearFood();resetView();updateStatus();});
$('nightMode').addEventListener('click',()=>setNight(true));$('sunsetMode').addEventListener('click',()=>setNight(false));
$('openAtlas').addEventListener('click',()=>$('fishAtlas').showModal());$('closeAtlas').addEventListener('click',()=>$('fishAtlas').close());
$('fishAtlas').addEventListener('click',event=>{if(event.target===$('fishAtlas')){const rect=$('fishAtlas').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$('fishAtlas').close();}});
function setImmersive(value){
  immersive=Boolean(value);document.body.classList.toggle('aq-immersive',immersive);$('immersiveButton').setAttribute('aria-pressed',String(immersive));$('immersiveButton').textContent=immersive?'退出沉浸 ×':'沉浸观察 ↗';needsRender=true;
  if(embedded)parent.postMessage({type:'wz-aquarium-immersive',active:immersive},location.origin);
}
function exitNativeFullscreen(){
  if(!document.fullscreenElement)return;
  expectedFullscreenExit=true;
  document.exitFullscreen().catch(()=>expectedFullscreenExit=false);
}
$('immersiveButton').addEventListener('click',()=>{
  if(immersive){setImmersive(false);exitNativeFullscreen();return;}
  setImmersive(true);observatory.requestFullscreen?.().then(()=>{
    if(!immersive&&document.fullscreenElement===observatory)exitNativeFullscreen();
  }).catch(()=>{});
});
document.addEventListener('fullscreenchange',()=>{
  if(document.fullscreenElement===observatory){fullscreenConfirmed=true;return;}
  const expected=expectedFullscreenExit;expectedFullscreenExit=false;
  if(fullscreenConfirmed){fullscreenConfirmed=false;if(!expected)setImmersive(false);}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('fishAtlas').open){if(armed){armed=false;updateStatus();}else if(immersive){setImmersive(false);exitNativeFullscreen();}}});
canvas.addEventListener('keydown',event=>{
  if(!ready)return;
  if(event.key==='Enter'&&armed){event.preventDefault();addFood(new THREE.Vector3(0,1.25,0));return;}
  const offset=camera.position.clone().sub(controls.target), spherical=new THREE.Spherical().setFromVector3(offset);
  if(event.key==='ArrowLeft')spherical.theta-=.12;else if(event.key==='ArrowRight')spherical.theta+=.12;else if(event.key==='ArrowUp')spherical.phi-=.1;else if(event.key==='ArrowDown')spherical.phi+=.1;else if(event.key==='+'||event.key==='=')spherical.radius*=.9;else if(event.key==='-')spherical.radius*=1.1;else return;
  event.preventDefault();transition=null;spherical.radius=THREE.MathUtils.clamp(spherical.radius,controls.minDistance,controls.maxDistance);spherical.phi=THREE.MathUtils.clamp(spherical.phi,controls.minPolarAngle,controls.maxPolarAngle);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();needsRender=true;
});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();ready=false;renderer?.setAnimationLoop(null);fail(new Error('WebGL context lost'));});
document.addEventListener('visibilitychange',()=>lastFrame=performance.now());
if(embedded)addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='wz-aquarium-visibility')return;
  embeddedSuspended=!event.data.visible;lastFrame=performance.now();needsRender=true;
});
initialize().catch(fail);
