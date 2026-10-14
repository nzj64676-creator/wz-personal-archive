// The fish wrapper faces local +Z. The imported model is calibrated beneath it.
// Distances are metres; steering stays continuous and never clamps position.
export function createSwimmer(THREE, root, options = {}) {
  const random = options.random || Math.random;
  const forward = new THREE.Vector3(0, 0, 1);
  const worldUp = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3(1, 0.04, -0.1).normalize();
  const desiredDirection = direction.clone();
  const targetDirection = new THREE.Vector3();
  const avoidance = new THREE.Vector3();
  const predicted = new THREE.Vector3();
  const target = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const desiredQuaternion = new THREE.Quaternion();
  const bankQuaternion = new THREE.Quaternion();
  const previousQuaternion = new THREE.Quaternion();
  const steeringQuaternion = new THREE.Quaternion();
  const bounds = { x: 1.65, y: 1.00, z: 0.40 };
  const margins = { x: 0.85, y: 0.43, z: 0.39 };
  const weights = { x: 1.45, y: 1.35, z: 2.3 };
  const maxTurnRate = 0.95;
  const maxAcceleration = 0.075;
  let elapsed = 0;
  let nextTargetAt = 0;
  let nextPaceAt = 0;
  let speed = 0.25;
  let pace = speed;
  let bank = 0;
  let turning = 0;
  let angularSpeed = 0;
  let angularPace = 0;
  let isPaused = false;
  let targetCount = 0;

  root.position.set(-0.92, -0.15, 0.04);
  right.crossVectors(worldUp, direction).normalize();
  up.crossVectors(direction, right).normalize();
  matrix.makeBasis(right, up, direction);
  root.quaternion.setFromRotationMatrix(matrix);
  steeringQuaternion.copy(root.quaternion);

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smoothstep = (v) => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };
  const range = (a, b) => a + (b - a) * random();

  function limitPitch(vector) {
    vector.normalize();
    const y = clamp(vector.y, -0.28, 0.28);
    let horizontal = Math.hypot(vector.x, vector.z);
    if (horizontal < 0.00001) {
      vector.x = direction.x;
      vector.z = direction.z;
      horizontal = Math.hypot(vector.x, vector.z) || 1;
    }
    const scale = Math.sqrt(1 - y * y) / horizontal;
    vector.set(vector.x * scale, y, vector.z * scale);
  }

  function chooseTarget() {
    // Different depth and height each time. Avoid choosing a new point directly
    // beside the fish; there is no periodic path or position reset.
    for (let attempt = 0; attempt < 12; attempt += 1) {
      target.set(range(-1.67, 1.67), range(-0.55, 0.55), range(-0.23, 0.23));
      if (target.distanceTo(root.position) > 0.85) break;
    }
    nextTargetAt = elapsed + range(7.5, 14.5);
    targetCount += 1;
  }
  chooseTarget();

  function step(dt) {
    elapsed += dt;
    direction.copy(forward).applyQuaternion(root.quaternion).normalize();
    if (elapsed >= nextTargetAt || root.position.distanceTo(target) < 0.35) chooseTarget();
    if (elapsed >= nextPaceAt) {
      pace = range(0.22, 0.32);
      nextPaceAt = elapsed + range(4.5, 10.5);
    }

    // Anticipate a wall, then steer smoothly back into the water. The soft
    // pressure starts early enough to fit a turning arc inside the glass.
    predicted.copy(root.position).addScaledVector(direction, Math.max(speed, 0.20) * 1.8);
    avoidance.set(0, 0, 0);
    let boundaryPressure = 0;
    for (const axis of ['x', 'y', 'z']) {
      const positiveDistance = bounds[axis] - predicted[axis];
      const negativeDistance = bounds[axis] + predicted[axis];
      const fromPositive = Math.max(
        smoothstep((margins[axis] - positiveDistance) / margins[axis]),
        smoothstep((margins[axis] - (bounds[axis] - root.position[axis])) / margins[axis]),
      );
      const fromNegative = Math.max(
        smoothstep((margins[axis] - negativeDistance) / margins[axis]),
        smoothstep((margins[axis] - (bounds[axis] + root.position[axis])) / margins[axis]),
      );
      avoidance[axis] = (fromNegative - fromPositive) * weights[axis];
      boundaryPressure = Math.max(boundaryPressure, fromPositive, fromNegative);
    }

    targetDirection.subVectors(target, root.position).normalize()
      .multiplyScalar(0.75 * (1 - boundaryPressure * 0.60)).add(avoidance);
    // A goldfish rises and descends gently; steep pitch is unnecessary here.
    if (targetDirection.lengthSq() < 0.0001) targetDirection.copy(direction);
    limitPitch(targetDirection);
    // Quaternion steering handles a goal directly behind the fish; normalized
    // vector lerp would stall indefinitely when two directions are opposite.
    desiredDirection.copy(targetDirection);

    // Roll is a small response to a turn, never a full roll or sudden flip.
    const signedTurn = direction.z * desiredDirection.x - direction.x * desiredDirection.z;
    const bankTarget = clamp(-signedTurn * 0.19, -0.12, 0.12);
    bank += (bankTarget - bank) * (1 - Math.exp(-dt * 2.5));
    right.crossVectors(worldUp, desiredDirection).normalize();
    up.crossVectors(desiredDirection, right).normalize();
    matrix.makeBasis(right, up, desiredDirection);
    desiredQuaternion.setFromRotationMatrix(matrix);
    bankQuaternion.setFromAxisAngle(forward, bank);
    desiredQuaternion.multiply(bankQuaternion);
    steeringQuaternion.rotateTowards(desiredQuaternion, maxTurnRate * 1.4 * dt);
    const requestedAngularPace = Math.min(maxTurnRate, root.quaternion.angleTo(steeringQuaternion) * 3.2);
    angularPace += clamp(requestedAngularPace - angularPace, -1.6 * dt, 1.6 * dt);
    previousQuaternion.copy(root.quaternion);
    root.quaternion.rotateTowards(steeringQuaternion, angularPace * dt);
    angularSpeed = previousQuaternion.angleTo(root.quaternion) / dt;

    const alignment = clamp(direction.dot(desiredDirection), -1, 1);
    const turnSlowdown = 0.74 + 0.26 * smoothstep((alignment + 1) / 2);
    const wallSlowdown = 1 - boundaryPressure * 0.45;
    const requestedSpeed = Math.max(0.14, pace * turnSlowdown * wallSlowdown);
    speed += clamp(requestedSpeed - speed, -maxAcceleration * dt, maxAcceleration * dt);
    direction.copy(forward).applyQuaternion(root.quaternion).normalize();
    velocity.copy(direction).multiplyScalar(speed);
    root.position.addScaledVector(velocity, dt);
    turning += (signedTurn - turning) * (1 - Math.exp(-dt * 3));
  }

  return {
    update(dt) {
      if (isPaused || !Number.isFinite(dt) || dt <= 0) return;
      // A background-tab return must not create one giant visible step.
      let remaining = Math.min(dt, 0.10);
      while (remaining > 0.000001) {
        const substep = Math.min(remaining, 1 / 60);
        step(substep);
        remaining -= substep;
      }
    },
    pause(value = true) { isPaused = Boolean(value); },
    getState() {
      return {
        time: elapsed,
        position: root.position.toArray(),
        quaternion: root.quaternion.toArray(),
        velocity: velocity.toArray(),
        target: target.toArray(),
        targetCount,
        speed,
        speedNormalized: clamp((speed - 0.14) / 0.18, 0, 1),
        turning: clamp(turning, -1, 1),
        angularSpeed,
        paused: isPaused,
      };
    },
  };
}
