import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const SOURCES = {
  comet: {
    title: 'Comet goldfish',
    sourceUrl: 'https://sketchfab.com/3d-models/comet-goldfish-5adcbf784df540a0b46dae8950bd3ec6',
    file: 'comet-goldfish.glb'
  },
  tosakin: {
    title: 'Tosakin goldfish',
    sourceUrl: 'https://sketchfab.com/3d-models/tosakin-goldfish-b2f0681c1e2145bcb0289f03ed75ea37',
    file: 'tosakin-goldfish.glb'
  }
};

function getMaterials(mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/** Load each authored GLB once; all instances share geometry and texture data. */
export async function loadGoldfishModels(onProgress) {
  const loader = new GLTFLoader();
  const templates = {};
  const progress = { comet: 0, tosakin: 0 };
  await Promise.all(Object.entries(SOURCES).map(async ([id, source]) => {
    const gltf = await loader.loadAsync(new URL(`./models/${source.file}`, import.meta.url).href, event => {
      if (event.total) progress[id] = event.loaded / event.total;
      onProgress?.((progress.comet + progress.tosakin) / 2, id);
    });
    const meshes = [], bones = [];
    gltf.scene.traverse(object => {
      if (object.isMesh) {
        const association = gltf.parser.associations.get(object);
        object.userData.sourceMeshName = gltf.parser.json.meshes[association?.meshes]?.name || object.name;
        meshes.push(object);
      }
      if (object.isBone) bones.push(object);
    });
    if (!meshes.some(mesh => mesh.isSkinnedMesh) || bones.length < 10 || !gltf.animations.length) {
      throw new Error(`${source.title} does not contain the required skinned geometry and animation.`);
    }
    const textures = new Set(meshes.flatMap(mesh => getMaterials(mesh).flatMap(material => [
      material.map, material.normalMap, material.roughnessMap, material.metalnessMap, material.transmissionMap
    ].filter(Boolean))));
    templates[id] = {
      id,
      ...source,
      scene: gltf.scene,
      animations: gltf.animations,
      metrics: {
        model: source.title, creator: 'somitsu', license: 'CC BY 4.0',
        meshes: meshes.length,
        skinnedMeshes: meshes.filter(mesh => mesh.isSkinnedMesh).length,
        bones: bones.length,
        triangles: meshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3, 0),
        animations: gltf.animations.map(clip => ({name: clip.name, duration: clip.duration, tracks: clip.tracks.length})),
        textures: textures.size
      }
    };
    progress[id] = 1;
    onProgress?.((progress.comet + progress.tosakin) / 2, id);
  }));
  return templates;
}

/**
 * Clone real weighted bones for each individual. The original GLBs are never
 * rewritten. The parent owns navigation and moves the returned +Z-facing root.
 */
export function createGoldfishActor(THREE, template, profile = {}) {
  if (!template?.scene) throw new Error('A loaded goldfish template is required.');
  const root = new THREE.Group();
  root.name = `goldfish-${profile.id || template.id}`;
  const calibration = new THREE.Group();
  const model = cloneSkeleton(template.scene);
  calibration.add(model);
  root.add(calibration);
  const meshes = [], bones = [], ownedMaterials = new Set();
  model.traverse(object => {
    if (object.isBone) bones.push(object);
    if (!object.isMesh) return;
    meshes.push(object);
    object.frustumCulled = false;
    // Independent materials keep future individual changes isolated. Embedded
    // maps and all original topology/skin weights are shared without alteration.
    const cloned = getMaterials(object).map(material => {
      const result = material.clone();
      ownedMaterials.add(result);
      const assetName = object.userData.sourceMeshName || object.name;
      if (/^body_/.test(assetName)) {
        result.transparent = false;
        result.opacity = 1;
        result.depthWrite = true;
      }
      if (/^eye_/.test(assetName)) {
        // Same optical correction verified in phase one: keep the actual eye
        // geometry but remove the exported white/transmissive pupil artifact.
        result.transmission = 0;
        result.map = null;
        result.normalMap = null;
        result.color.set(0x080a0c);
        result.metalness = 0;
        result.roughness = .17;
        result.roughnessMap = null;
        result.ior = 1.38;
        result.specularIntensity = .45;
        result.transparent = false;
        result.opacity = 1;
        result.depthWrite = true;
      }
      result.envMapIntensity = .7;
      if (result.transparent) result.depthWrite = false;
      return result;
    });
    object.material = Array.isArray(object.material) ? cloned : cloned[0];
  });

  const head = bones.find(bone => /DEF_Head/.test(bone.name));
  const tail = bones.find(bone => /DEF_Spine5/.test(bone.name));
  root.updateMatrixWorld(true);
  if (head && tail) {
    const forward = head.getWorldPosition(new THREE.Vector3()).sub(tail.getWorldPosition(new THREE.Vector3()));
    calibration.rotation.y = -Math.atan2(forward.x, forward.z);
  }
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(calibration, true);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const length = profile.length || 1.35;
  const scale = length / Math.max(size.x, size.y, size.z);
  calibration.scale.setScalar(scale);
  calibration.position.copy(center.multiplyScalar(-scale));
  root.updateMatrixWorld(true);

  const mixer = new THREE.AnimationMixer(model);
  const originalClip = template.animations[0];
  const duplicateClip = originalClip.clone();
  duplicateClip.name = `${originalClip.name}-overlap-${profile.id || template.id}`;
  let swimAction = mixer.clipAction(originalClip);
  let standbyAction = mixer.clipAction(duplicateClip);
  const clipDuration = originalClip.duration;
  const overlapDuration = Math.min(template.id === 'tosakin' ? 1.0 : .8, clipDuration * .2);
  swimAction.setLoop(THREE.LoopOnce, 1);
  swimAction.clampWhenFinished = true;
  swimAction.play();
  const phase = Number.isFinite(profile.phase) ? profile.phase : 0;
  swimAction.time = Math.max(0, phase) % Math.max(.1, clipDuration - overlapDuration - .1);
  mixer.update(0);
  root.updateMatrixWorld(true);
  const smoothedPoses = new Map();
  const spine = bones.filter(bone => /DEF_Spine[1-4]_/.test(bone.name));
  const lowerJaw = bones.find(bone => /DEF_(MouthB|Jaw)_/.test(bone.name));
  const upperJaw = bones.find(bone => /DEF_MouthT/.test(bone.name));
  const gills = bones.filter(bone => /DEF_Gill_[LR]_/.test(bone.name));
  const localAxis = new THREE.Vector3(), inverseWorld = new THREE.Quaternion(), addition = new THREE.Quaternion();
  const worldUp = new THREE.Vector3(0, 1, 0), worldRight = new THREE.Vector3();
  let loopBlend = null, biteAmount = 0, elapsed = 0, loopCount = 0;

  // Contact is measured at an actual jaw-weighted lip vertex, rather than at
  // the jaw hinge or an assumed distance in front of the fish's center.
  let mouthSurface = null, foremostLip = -Infinity;
  const surfacePoint = new THREE.Vector3();
  for (const mesh of meshes.filter(object => object.isSkinnedMesh && /^body_/.test(object.userData.sourceMeshName))) {
    const jawIndices = [lowerJaw, upperJaw].filter(Boolean).map(bone => mesh.skeleton.bones.indexOf(bone)).filter(index => index >= 0);
    const indices = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
    mesh.skeleton.update();
    for (let index = 0; index < mesh.geometry.attributes.position.count; index++) {
      const joints = [indices.getX(index), indices.getY(index), indices.getZ(index), indices.getW(index)];
      const influence = [weights.getX(index), weights.getY(index), weights.getZ(index), weights.getW(index)];
      if (!joints.some((joint, i) => jawIndices.includes(joint) && influence[i] > .15)) continue;
      mesh.getVertexPosition(index, surfacePoint);
      mesh.localToWorld(surfacePoint);
      if (surfacePoint.z > foremostLip) {
        foremostLip = surfacePoint.z;
        mouthSurface = {mesh, index};
      }
    }
  }

  function rotateInWorldAxis(bone, axis, angle) {
    inverseWorld.copy(bone.getWorldQuaternion(inverseWorld)).invert();
    localAxis.copy(axis).applyQuaternion(inverseWorld).normalize();
    bone.quaternion.multiply(addition.setFromAxisAngle(localAxis, angle));
  }

  function updateAnimation(dt, movement = {}, feeding = {}) {
    dt = Math.min(Math.max(dt, 0), .1);
    if (!dt) return;
    elapsed += dt;
    const speed = THREE.MathUtils.clamp(movement.speedNormalized || 0, 0, 1);
    const cadence = (.58 + speed * .55) * (profile.cadence || 1);
    swimAction.setEffectiveTimeScale(cadence);
    standbyAction.setEffectiveTimeScale(cadence);
    // Authored caudal/pectoral animation is not a seamless loop. Two actions
    // overlap to avoid a hard reset, independently for every cloned skeleton.
    if (!loopBlend && swimAction.time >= clipDuration - overlapDuration) {
      standbyAction.reset().setLoop(THREE.LoopOnce, 1);
      standbyAction.clampWhenFinished = true;
      standbyAction.setEffectiveTimeScale(cadence).setEffectiveWeight(0).play();
      loopBlend = {progress: 0};
    }
    if (loopBlend) {
      loopBlend.progress = Math.min(1, loopBlend.progress + dt * cadence / overlapDuration);
      const t = loopBlend.progress, blend = t * t * (3 - 2 * t);
      swimAction.setEffectiveWeight(1 - blend);
      standbyAction.setEffectiveWeight(blend);
      if (t >= 1) {
        swimAction.stop();
        [swimAction, standbyAction] = [standbyAction, swimAction];
        loopBlend = null;
        loopCount++;
      }
    }
    mixer.update(dt);
    root.updateMatrixWorld(true);
    const turn = THREE.MathUtils.clamp(movement.turning || 0, -1.5, 1.5);
    for (const bone of spine) rotateInWorldAxis(bone, worldUp, turn * .045);

    // Food-contact envelope is supplied by the feeding system. Opening is an
    // additive pose on the original weighted jaw bones, never a fake mouth mesh.
    const biteTarget = THREE.MathUtils.clamp(typeof feeding === 'number' ? feeding : feeding.bite || 0, 0, 1);
    biteAmount += (biteTarget - biteAmount) * (1 - Math.exp(-dt / .055));
    worldRight.set(1, 0, 0).applyQuaternion(root.quaternion).normalize();
    if (lowerJaw) rotateInWorldAxis(lowerJaw, worldRight, biteAmount * .23);
    if (upperJaw) rotateInWorldAxis(upperJaw, worldRight, -biteAmount * .055);
    for (const gill of gills) {
      const side = /Gill_L/.test(gill.name) ? -1 : 1;
      rotateInWorldAxis(gill, worldUp, side * biteAmount * .023);
    }

    // Preserve the imported animation while softening abrupt source keyframes.
    const damping = 1 - Math.exp(-dt / .045);
    for (const bone of bones) {
      let pose = smoothedPoses.get(bone);
      if (!pose) {
        pose = {q: bone.quaternion.clone(), p: bone.position.clone(), s: bone.scale.clone()};
        smoothedPoses.set(bone, pose);
      }
      pose.q.slerp(bone.quaternion, damping);
      pose.p.lerp(bone.position, damping);
      pose.s.lerp(bone.scale, damping);
      bone.quaternion.copy(pose.q);
      bone.position.copy(pose.p);
      bone.scale.copy(pose.s);
    }
    root.updateMatrixWorld(true);
  }

  const metrics = {...template.metrics, originalBounds: size.toArray(), length};
  return {
    id: profile.id || template.id,
    model: template.id,
    profile,
    root,
    meshes,
    bones,
    metrics,
    updateAnimation,
    mouthPosition(target = new THREE.Vector3()) {
      root.updateMatrixWorld(true);
      if (mouthSurface) {
        mouthSurface.mesh.skeleton.update();
        mouthSurface.mesh.getVertexPosition(mouthSurface.index, target);
        return mouthSurface.mesh.localToWorld(target);
      }
      if (upperJaw && lowerJaw) {
        upperJaw.getWorldPosition(target);
        const bottom = lowerJaw.getWorldPosition(localAxis);
        return target.add(bottom).multiplyScalar(.5);
      }
      if (lowerJaw) return lowerJaw.getWorldPosition(target);
      if (head) return head.getWorldPosition(target);
      return root.getWorldPosition(target);
    },
    animationState: () => ({time: swimAction.time, cadence: swimAction.getEffectiveTimeScale(), elapsed, bite: biteAmount, loopCount}),
    setAnimationTime(time) {
      loopBlend = null;
      standbyAction.stop();
      swimAction.reset().setLoop(THREE.LoopOnce, 1);
      swimAction.clampWhenFinished = true;
      swimAction.setEffectiveWeight(1).play();
      swimAction.time = Math.max(0, time) % clipDuration;
      mixer.update(0);
      smoothedPoses.clear();
      root.updateMatrixWorld(true);
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      ownedMaterials.forEach(material => material.dispose());
      meshes.filter(mesh => mesh.isSkinnedMesh).forEach(mesh => mesh.skeleton.dispose());
      root.removeFromParent();
    }
  };
}
