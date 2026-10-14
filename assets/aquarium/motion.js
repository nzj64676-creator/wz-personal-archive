// The wrapper faces local +Z; the imported, skinned model is calibrated below it.
// Steering changes orientation and speed continuously. Position is never reset
// or clamped, including at the glass, during feeding, and after a paused tab.
export function createSwimmer(THREE, root, options = {}) {
  const random = options.random || Math.random;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smoothstep = v => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };
  const range = (a, b) => a + (b - a) * random();
  const pair = (value, fallback, min, max) => {
    const valid = Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
    return (valid ? value : fallback).map(v => clamp(v, min, max)).sort((a, b) => a - b);
  };
  const copyPoint = (out, value) => {
    if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(Number.isFinite)) out.fromArray(value);
    else if (value && [value.x, value.y, value.z].every(Number.isFinite)) out.copy(value);
    else return false;
    return true;
  };
  const speedRange = pair(options.speedRange, [.22, .31], .12, .40);
  const depthRange = pair(options.depthRange, [-.55, .55], -.70, .70);
  const heightRange = pair(options.heightRange, [-.60, .60], -.92, .86);
  const curiosity = clamp(Number.isFinite(options.curiosity) ? options.curiosity : .65, 0, 1);
  const maxTurnRate = clamp(Number.isFinite(options.turnRate) ? options.turnRate : .90, .65, 1.15);
  const bodyLength = clamp(Number.isFinite(options.bodyLength) ? options.bodyLength : 1.35, .85, 1.40);
  const maxAcceleration = .105;
  const forward = new THREE.Vector3(0, 0, 1);
  const worldUp = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3(1, .04, -.1).normalize();
  const desiredDirection = direction.clone();
  const targetDirection = new THREE.Vector3();
  const avoidance = new THREE.Vector3();
  const separation = new THREE.Vector3();
  const predicted = new THREE.Vector3();
  const delta = new THREE.Vector3();
  const relative = new THREE.Vector3();
  const futureDelta = new THREE.Vector3();
  const yieldSide = new THREE.Vector3();
  const target = new THREE.Vector3();
  const foodTarget = new THREE.Vector3();
  const safeFoodTarget = new THREE.Vector3();
  const foodApproach = new THREE.Vector3();
  const approachRight = new THREE.Vector3();
  const approachUp = new THREE.Vector3();
  const previousFood = new THREE.Vector3();
  const mouth = new THREE.Vector3();
  const mouthOffset = new THREE.Vector3(0, 0, bodyLength * .32);
  copyPoint(mouthOffset, options.mouthOffset);
  const velocity = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const desiredQuaternion = new THREE.Quaternion();
  const bankQuaternion = new THREE.Quaternion();
  const previousQuaternion = new THREE.Quaternion();
  const steeringQuaternion = new THREE.Quaternion();
  // Glass is x ±3, z ±1.5; sand is y -1.575 and waterline is y 1.43.
  // Leave room for the complete long tail while making depth visible.
  const bounds = { x: 2.08, yMin: -1.12, yMax: 1.08, z: .84 };
  const margins = { x: .84, y: .37, z: .57 };
  const weights = { x: 1.85, y: 1.65, z: 2.25 };
  let neighbors = [], obstacles = [];
  let elapsed = 0, nextTargetAt = 0, nextPaceAt = 0;
  let speed = (speedRange[0] + speedRange[1]) / 2, pace = speed;
  let bank = 0, turning = 0, angularSpeed = 0, angularPace = 0;
  let isPaused = false, feeding = false, targetCount = 0;
  let avoidancePressure = 0, neighborPressure = 0;

  if (!copyPoint(root.position, options.start)) root.position.set(-.92, -.15, .04);
  if (copyPoint(direction, options.heading) && direction.lengthSq() > .0001) direction.normalize();
  else direction.set(1, .04, -.1).normalize();
  right.crossVectors(worldUp, direction).normalize();
  up.crossVectors(direction, right).normalize();
  matrix.makeBasis(right, up, direction);
  root.quaternion.setFromRotationMatrix(matrix);
  steeringQuaternion.copy(root.quaternion);

  function limitPitch(vector, limit) {
    vector.normalize();
    const y = clamp(vector.y, -limit, limit);
    let horizontal = Math.hypot(vector.x, vector.z);
    if (horizontal < .00001) {
      vector.x = direction.x;
      vector.z = direction.z;
      horizontal = Math.hypot(vector.x, vector.z) || 1;
    }
    const scale = Math.sqrt(1 - y * y) / horizontal;
    vector.set(vector.x * scale, y, vector.z * scale);
  }

  function chooseTarget() {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      target.set(range(-1.83, 1.83), range(...heightRange), range(...depthRange));
      if (target.distanceTo(root.position) > .75) break;
    }
    nextTargetAt = elapsed + range(8.0, 15.5) * (1.2 - curiosity * .45);
    targetCount += 1;
  }
  chooseTarget();

  function avoidGlass() {
    const anticipation = 2.35 + (1.0 - maxTurnRate) * 1.2;
    predicted.copy(root.position).addScaledVector(direction, Math.max(speed, .16) * anticipation);
    avoidance.set(0, 0, 0);
    let pressure = 0;
    for (const axis of ['x', 'y', 'z']) {
      const lower = axis === 'y' ? bounds.yMin : -bounds[axis];
      const upper = axis === 'y' ? bounds.yMax : bounds[axis];
      let fromPositive = Math.max(
        smoothstep((margins[axis] - (upper - predicted[axis])) / margins[axis]),
        smoothstep((margins[axis] - (upper - root.position[axis])) / margins[axis]),
      );
      let fromNegative = Math.max(
        smoothstep((margins[axis] - (predicted[axis] - lower)) / margins[axis]),
        smoothstep((margins[axis] - (root.position[axis] - lower)) / margins[axis]),
      );
      // Surface grains sit above cruising height. Soften only early pressure:
      // the final safety margin still prevents the fish leaving the water.
      if (feeding && axis === 'y' && foodTarget.y > root.position.y && root.position.y < .97) fromPositive *= .25;
      avoidance[axis] = (fromNegative - fromPositive) * weights[axis];
      pressure = Math.max(pressure, fromPositive, fromNegative);
    }
    return pressure;
  }

  function avoidNeighbors() {
    separation.set(0, 0, 0);
    neighborPressure = 0;
    const ownRadius = .16 + bodyLength * .15;
    for (const other of neighbors) {
      if (!other || other === root || !other.position) continue;
      delta.subVectors(root.position, other.position);
      const distance = delta.length();
      if (distance > 1.6) continue;
      relative.copy(forward).applyQuaternion(other.quaternion).multiplyScalar(speed);
      relative.sub(velocity);
      const futureDistance = futureDelta.copy(delta).addScaledVector(relative, -.95).length();
      const safeDistance = ownRadius + .29;
      const pressure = smoothstep((1.24 - Math.min(distance, futureDistance)) / (1.24 - safeDistance));
      if (pressure <= 0) continue;
      if (distance < .00001) delta.copy(right);
      else delta.multiplyScalar(1 / distance);
      separation.addScaledVector(delta, pressure * 1.25);
      // Always yield to local starboard in a close forward encounter. For two
      // opposing headings those directions are opposite, avoiding the symmetry
      // of two fish both steering backwards along the same collision line.
      const ahead = Math.max(0, -delta.dot(direction));
      yieldSide.crossVectors(worldUp, direction).normalize();
      separation.addScaledVector(yieldSide, pressure * smoothstep(ahead) * 1.20);
      neighborPressure = Math.max(neighborPressure, pressure);
    }
    if (separation.lengthSq() > 2.0 * 2.0) separation.setLength(2.0);
    return separation;
  }

  function avoidScenery() {
    for (const obstacle of obstacles) {
      if (!obstacle || !copyPoint(delta, obstacle.position)) continue;
      const radius = Number.isFinite(obstacle.radius) ? Math.max(.05, obstacle.radius) : .3;
      relative.subVectors(predicted, delta);
      const distance = relative.length();
      const safe = radius + .28;
      const pressure = smoothstep((safe + .40 - distance) / .40);
      if (pressure > 0) {
        if (distance > .00001) relative.multiplyScalar(1 / distance);
        else relative.copy(right);
        avoidance.addScaledVector(relative, pressure * 1.25);
        avoidancePressure = Math.max(avoidancePressure, pressure);
      }
    }
  }

  function step(dt) {
    elapsed += dt;
    direction.copy(forward).applyQuaternion(root.quaternion).normalize();
    if (!feeding && (elapsed >= nextTargetAt || root.position.distanceTo(target) < .35)) chooseTarget();
    if (elapsed >= nextPaceAt) {
      pace = range(...speedRange);
      nextPaceAt = elapsed + range(4.5, 10.5);
    }
    avoidancePressure = avoidGlass();
    avoidScenery();
    avoidNeighbors();

    let targetDistance;
    if (feeding) {
      // Aim the mouth, rather than orbiting with the fish's centre at the grain.
      // Keep an approach direction for this grain as it sinks through the water.
      approachRight.crossVectors(worldUp, foodApproach).normalize();
      approachUp.crossVectors(foodApproach, approachRight).normalize();
      safeFoodTarget.copy(foodTarget).addScaledVector(foodApproach, -mouthOffset.z)
        .addScaledVector(approachUp, -mouthOffset.y).addScaledVector(approachRight, -mouthOffset.x);
      safeFoodTarget.x = clamp(safeFoodTarget.x, -1.93, 1.93);
      safeFoodTarget.y = clamp(safeFoodTarget.y, -1.02, 1.075);
      safeFoodTarget.z = clamp(safeFoodTarget.z, -.66, .66);
      targetDirection.subVectors(safeFoodTarget, root.position);
      targetDistance = targetDirection.length();
    } else {
      targetDirection.subVectors(target, root.position);
      targetDistance = targetDirection.length();
    }
    if (targetDistance > .00001) targetDirection.multiplyScalar(1 / targetDistance);
    else targetDirection.copy(direction);
    if (feeding) targetDirection.lerp(foodApproach, smoothstep((.31 - targetDistance) / .26) * .82).normalize();
    targetDirection.multiplyScalar((feeding ? 1.15 : .76) * (1 - avoidancePressure * .58))
      .add(avoidance).addScaledVector(separation, feeding ? .60 : .82);
    if (targetDirection.lengthSq() < .0001) targetDirection.copy(direction);
    limitPitch(targetDirection, feeding ? .34 : .28);
    desiredDirection.copy(targetDirection);

    const signedTurn = direction.z * desiredDirection.x - direction.x * desiredDirection.z;
    const bankTarget = clamp(-signedTurn * .16, -.11, .11);
    bank += (bankTarget - bank) * (1 - Math.exp(-dt * 2.5));
    right.crossVectors(worldUp, desiredDirection).normalize();
    up.crossVectors(desiredDirection, right).normalize();
    matrix.makeBasis(right, up, desiredDirection);
    desiredQuaternion.setFromRotationMatrix(matrix);
    bankQuaternion.setFromAxisAngle(forward, bank);
    desiredQuaternion.multiply(bankQuaternion);
    steeringQuaternion.rotateTowards(desiredQuaternion, maxTurnRate * 1.4 * dt);
    const requestedAngularPace = Math.min(maxTurnRate, root.quaternion.angleTo(steeringQuaternion) * 3.2);
    angularPace += clamp(requestedAngularPace - angularPace, -1.5 * dt, 1.5 * dt);
    previousQuaternion.copy(root.quaternion);
    root.quaternion.rotateTowards(steeringQuaternion, angularPace * dt);
    angularSpeed = previousQuaternion.angleTo(root.quaternion) / dt;

    const alignment = clamp(direction.dot(desiredDirection), -1, 1);
    const turnSlowdown = .66 + .34 * smoothstep((alignment + 1) / 2);
    const wallSlowdown = 1 - avoidancePressure * .65;
    const neighborSlowdown = 1 - neighborPressure * .68;
    const feedPace = feeding ? Math.max(pace, .27) : pace;
    // Slow approach lets the actual animated mouth meet a grain.
    mouth.copy(mouthOffset).applyQuaternion(root.quaternion).add(root.position);
    const mouthDistance = mouth.distanceTo(foodTarget);
    const arrival = feeding ? .30 + .70 * smoothstep((mouthDistance - .10) / .65) : 1;
    const minimumSpeed = feeding ? .045 : .085 - neighborPressure * .043;
    const requestedSpeed = Math.max(minimumSpeed, feedPace * turnSlowdown * wallSlowdown * neighborSlowdown * arrival);
    speed += clamp(requestedSpeed - speed, -maxAcceleration * dt, maxAcceleration * dt);
    direction.copy(forward).applyQuaternion(root.quaternion).normalize();
    velocity.copy(direction).multiplyScalar(speed);
    root.position.addScaledVector(velocity, dt);
    turning += (signedTurn - turning) * (1 - Math.exp(-dt * 3));
  }

  return {
    update(dt, environment) {
      if (environment?.neighbors) neighbors = environment.neighbors;
      if (environment?.obstacles) obstacles = environment.obstacles;
      if (isPaused || !Number.isFinite(dt) || dt <= 0) return;
      let remaining = Math.min(dt, .10);
      while (remaining > .000001) {
        const substep = Math.min(remaining, 1 / 60);
        step(substep);
        remaining -= substep;
      }
    },
    setNeighbors(value) { neighbors = Array.isArray(value) ? value : []; },
    setObstacles(value) { obstacles = Array.isArray(value) ? value : []; },
    setFoodTarget(value) {
      const wasFeeding = feeding;
      previousFood.copy(foodTarget);
      feeding = copyPoint(foodTarget, value);
      if (feeding && (!wasFeeding || foodTarget.distanceTo(previousFood) > .28)) {
        foodApproach.subVectors(foodTarget, root.position);
        if (foodApproach.lengthSq() < .0001) foodApproach.copy(direction);
        limitPitch(foodApproach, .34);
      }
      if (wasFeeding && !feeding) nextTargetAt = Math.min(nextTargetAt, elapsed + 1.5);
    },
    pause(value = true) { isPaused = Boolean(value); },
    getState() {
      return {
        id: options.id || 'goldfish',
        time: elapsed,
        position: root.position.toArray(),
        quaternion: root.quaternion.toArray(),
        velocity: velocity.toArray(),
        target: (feeding ? foodTarget : target).toArray(),
        targetCount,
        speed,
        speedNormalized: clamp((speed - .08) / .28, 0, 1),
        turning: clamp(turning, -1, 1),
        angularSpeed,
        feeding,
        feedingDistance: feeding ? root.position.distanceTo(foodTarget) : null,
        avoidancePressure,
        neighborPressure,
        paused: isPaused,
      };
    },
  };
}
