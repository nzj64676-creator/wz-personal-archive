// Aquarium scenery is authored locally. No remote textures, sprites or models.
// Coordinate system: 6 × 3.3 × 3 m tank, gravel -1.60 m, water surface 1.43 m.
export function createAquariumEnvironment(THREE, scene, renderer) {
  const group = new THREE.Group();
  group.name = 'aquarium-environment';
  scene.add(group);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const plants = [], ripples = [];
  const animated = {time: {value: 0}, night: {value: 0}};
  let night = false, disposed = false;
  const random = seededRandom(271828);

  function seededRandom(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let n = Math.imul(seed ^ seed >>> 15, 1 | seed);
      n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n;
      return ((n ^ n >>> 14) >>> 0) / 4294967296;
    };
  }
  function keepGeometry(value) {geometries.add(value); return value;}
  function keepMaterial(value) {materials.add(value); return value;}
  function mesh(geometry, material, parent = group) {
    const object = new THREE.Mesh(keepGeometry(geometry), material);
    parent.add(object);
    return object;
  }
  function texture(kind, size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    const pixels = context.createImageData(size, size);
    const textureRandom = seededRandom(kind === 'sand' ? 2098 : 6131);
    const bases = kind === 'sand' ? [166, 155, 134] : [111, 109, 91];
    // A periodic noise field avoids visible joins when the gravel map repeats.
    const cells = Array.from({length: 32 * 32}, () => textureRandom());
    const smooth = t => t * t * (3 - 2 * t);
    function noise(x, y, scale) {
      x = x * scale / size; y = y * scale / size;
      const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
      const at = (xx, yy) => cells[((yy % 32 + 32) % 32) * 32 + ((xx % 32 + 32) % 32)];
      const a = at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx;
      const b = at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx;
      return a * (1 - fy) + b * fy;
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const grain = textureRandom();
      const broad = noise(x, y, 8), fine = noise(x, y, 32);
      const detail = kind === 'sand' ? (grain - .5) * 23 : (grain - .5) * 15;
      const shade = kind === 'sand'
        ? (broad - .5) * 8 + (fine - .5) * 7 + detail
        : (broad - .5) * 42 + (fine - .5) * 24 + detail;
      const i = (y * size + x) * 4;
      pixels.data[i] = bases[0] + shade;
      pixels.data[i + 1] = bases[1] + shade;
      pixels.data[i + 2] = bases[2] + shade;
      pixels.data[i + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    const value = new THREE.CanvasTexture(canvas);
    value.wrapS = value.wrapT = THREE.RepeatWrapping;
    value.colorSpace = THREE.SRGBColorSpace;
    value.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    textures.add(value);
    return value;
  }

  // Dark polished cabinet and inset bronze edge keep the tank within WZ's palette.
  const cabinetMaterial = keepMaterial(new THREE.MeshStandardMaterial({color: 0x121411, roughness: .27, metalness: .23}));
  const bronze = keepMaterial(new THREE.MeshStandardMaterial({color: 0x9f8652, roughness: .35, metalness: .83}));
  mesh(new THREE.BoxGeometry(6.32, .32, 3.32), cabinetMaterial).position.y = -1.93;
  mesh(new THREE.BoxGeometry(6.22, .027, 3.22), bronze).position.y = -1.754;
  mesh(new THREE.BoxGeometry(6.14, .13, 3.14), cabinetMaterial).position.y = -1.686;

  const sandMap = texture('sand');
  sandMap.repeat.set(9, 4.5);
  const sandMaterial = keepMaterial(new THREE.MeshStandardMaterial({
    color: 0xdfd3b7, map: sandMap, bumpMap: sandMap, bumpScale: .008, roughness: .96,
  }));
  const sandGeometry = new THREE.PlaneGeometry(5.96, 2.96, 90, 46);
  sandGeometry.rotateX(-Math.PI / 2);
  const sandPositions = sandGeometry.attributes.position;
  for (let i = 0; i < sandPositions.count; i++) {
    const x = sandPositions.getX(i), z = sandPositions.getZ(i);
    const rearSlope = .10 * Math.pow(Math.max(0, -z / 1.5), 2);
    sandPositions.setY(i, -.001 + rearSlope + .004 * Math.sin(x * 10 + z * 14) + .002 * Math.sin(x * 33 - z * 23));
  }
  sandGeometry.computeVertexNormals();
  mesh(sandGeometry, sandMaterial).position.y = -1.60;
  mesh(new THREE.BoxGeometry(5.95, .115, 2.95), sandMaterial).position.y = -1.675;

  const rockMap = texture('stone');
  rockMap.repeat.set(2, 2);
  const rockMaterial = keepMaterial(new THREE.MeshStandardMaterial({
    color: 0xa8a792, map: rockMap, bumpMap: rockMap, bumpScale: .026,
    roughness: .91, vertexColors: true,
  }));
  function rock(x, z, sx, sy, sz, seed) {
    const geometry = new THREE.SphereGeometry(1, 24, 14);
    const positions = geometry.attributes.position;
    const colours = [];
    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i), vy = positions.getY(i), vz = positions.getZ(i);
      const erosion = .085 * Math.sin(vx * 5.6 + seed) * Math.cos(vz * 6.1 - seed)
        + .045 * Math.sin(vy * 11 + vx * 8) * Math.sin(vz * 9 + seed);
      const profile = 1 + erosion + .09 * Math.sin(vy * 4 + seed);
      positions.setXYZ(i, vx * profile, vy * profile, vz * profile);
      const lichen = Math.max(0, Math.sin(vx * 6 + seed) * Math.cos(vz * 7 - seed)) * .08;
      const shade = .67 + (vy + 1) * .125;
      colours.push(shade - lichen * .5, shade + lichen, shade - lichen * .9);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    geometry.computeVertexNormals();
    const stone = mesh(geometry, rockMaterial);
    stone.scale.set(sx, sy, sz);
    stone.position.set(x, -1.60 + sy * .70, z);
    stone.rotation.set(.09, seed * .37, .05 * Math.sin(seed));
    return stone;
  }
  // Arrangement is low and behind the swimming volume, with no central obstacle.
  rock(-2.25, -.98, .62, .40, .43, 1.3);
  rock(-2.67, -.70, .32, .19, .26, 3.7);
  rock(-1.66, -1.18, .39, .24, .32, 5.1);
  rock(2.35, -1.06, .44, .32, .34, 7.1);
  rock(2.66, -.55, .25, .17, .20, 9.3);
  rock(1.86, -1.23, .32, .20, .24, 12.8);
  // Fine physical river gravel breaks up the flat sand without individual draws.
  const gravelMaterial = keepMaterial(new THREE.MeshStandardMaterial({
    color: 0xc4b69b, map: rockMap, roughness: .92,
  }));
  const gravelGeometry = keepGeometry(new THREE.IcosahedronGeometry(1, 1));
  const gravel = new THREE.InstancedMesh(gravelGeometry, gravelMaterial, 180);
  gravel.name = 'small-river-gravel';
  const gravelTransform = new THREE.Object3D();
  const gravelColour = new THREE.Color();
  for (let i = 0; i < gravel.count; i++) {
    const x = (random() - .5) * 5.65, z = (random() - .5) * 2.65;
    const radius = .009 + random() * .018;
    const sandHeight = -1.601 + .10 * Math.pow(Math.max(0, -z / 1.5), 2)
      + .004 * Math.sin(x * 10 + z * 14) + .002 * Math.sin(x * 33 - z * 23);
    gravelTransform.position.set(x, sandHeight + radius * .18, z);
    gravelTransform.scale.set(radius * (1.1 + random() * .7), radius * .52, radius);
    gravelTransform.rotation.set(random() * 3, random() * 6, random() * 2);
    gravelTransform.updateMatrix();
    gravel.setMatrixAt(i, gravelTransform.matrix);
    const brightness = .66 + random() * .32;
    gravelColour.setRGB(brightness, brightness * .98, brightness * .90);
    gravel.setColorAt(i, gravelColour);
  }
  gravel.instanceMatrix.needsUpdate = true;
  group.add(gravel);
  // Near-contact darkening gives the rocks weight without a costly shadow pass.
  const contactMaterial = keepMaterial(new THREE.MeshBasicMaterial({color: 0x29261c, transparent: true, opacity: .18, depthWrite: false}));
  for (const [x, z, rx, rz] of [[-2.25,-.98,.63,.46],[-1.66,-1.18,.4,.34],[2.35,-1.06,.46,.36]]) {
    const contact = mesh(new THREE.CircleGeometry(1, 32), contactMaterial);
    contact.rotation.x = -Math.PI / 2;
    contact.scale.set(rx, rz, 1);
    contact.position.set(x, -1.584, z);
  }

  const leafMaterial = keepMaterial(new THREE.MeshStandardMaterial({
    color: 0x587249, roughness: .62, metalness: 0, vertexColors: true,
    side: THREE.DoubleSide, transparent: true, opacity: .96,
  }));
  leafMaterial.onBeforeCompile = shader => {
    shader.uniforms.uAquariumTime = animated.time;
    shader.vertexShader = 'uniform float uAquariumTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float plantHeight = max(0.0, position.y);
      transformed.x += sin(uAquariumTime * 0.63 + plantHeight * 2.2) * plantHeight * plantHeight * 0.035;
      transformed.z += sin(uAquariumTime * 0.49 + plantHeight * 3.1) * plantHeight * 0.018;
    `);
  };
  leafMaterial.customProgramCacheKey = () => 'wz-aquatic-leaf-v1';
  function leafGeometry(height, width, bend, twist) {
    const positions = [], colours = [], uvs = [], indices = [];
    const rows = 19;
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      const taper = Math.pow(Math.sin(Math.PI * t), .7);
      const halfWidth = width * taper;
      const centreX = Math.sin(t * 1.7) * bend * t;
      const centreZ = .09 * Math.sin(t * 3 + twist) * t;
      for (let j = 0; j < 3; j++) {
        const lateral = j - 1;
        positions.push(centreX + lateral * halfWidth, t * height, centreZ + lateral * lateral * .015 * taper);
        const light = .70 + t * .26;
        // Visible curved midrib and darker sides form an actual blade cross-section.
        colours.push(light * (j === 1 ? .92 : .79), light, light * .69);
        uvs.push(j / 2, t);
        if (i < rows && j < 2) {
          const k = i * 3 + j;
          indices.push(k, k + 3, k + 1, k + 1, k + 3, k + 4);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  function plant(x, z, height, count, spread, seed) {
    const clump = new THREE.Group();
    clump.position.set(x, -1.56, z);
    clump.name = 'live-aquatic-plant';
    const mergedPositions = [], mergedColours = [], mergedUvs = [], mergedIndices = [];
    const leafTransform = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const h = height * (.48 + random() * .59);
      const geometry = leafGeometry(h, .022 + random() * .038, spread * (.55 + random() * .5), seed + i);
      leafTransform.rotation.set((random() - .5) * .14, i * 2.39996 + seed, (random() - .5) * .22);
      leafTransform.position.set((random() - .5) * .11, 0, (random() - .5) * .12);
      leafTransform.updateMatrix();
      geometry.applyMatrix4(leafTransform.matrix);
      const offset = mergedPositions.length / 3;
      mergedPositions.push(...geometry.attributes.position.array);
      mergedColours.push(...geometry.attributes.color.array);
      mergedUvs.push(...geometry.attributes.uv.array);
      for (const index of geometry.index.array) mergedIndices.push(index + offset);
      geometry.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(mergedPositions, 3));
    merged.setAttribute('color', new THREE.Float32BufferAttribute(mergedColours, 3));
    merged.setAttribute('uv', new THREE.Float32BufferAttribute(mergedUvs, 2));
    merged.setIndex(mergedIndices);
    merged.computeVertexNormals();
    mesh(merged, leafMaterial, clump);
    group.add(clump);
    plants.push({object: clump, phase: seed});
  }
  plant(-2.67, -1.14, 1.98, 20, .42, 1);
  plant(-2.02, -1.29, 1.21, 14, .34, 3);
  plant(2.55, -1.21, 1.82, 20, .41, 5);
  plant(1.78, -1.31, .94, 14, .29, 9);
  plant(-2.78, .38, .65, 10, .24, 12);
  plant(.87, -1.34, .44, 9, .23, 17);

  const sideGlassMaterial = keepMaterial(new THREE.MeshPhysicalMaterial({
    color: 0xd3e9df, roughness: .045, metalness: 0,
    transmission: .92, thickness: .027, ior: 1.5, transparent: true,
    opacity: .18, side: THREE.DoubleSide, depthWrite: false,
    clearcoat: .8, clearcoatRoughness: .04,
  }));
  const frontGlassMaterial = keepMaterial(new THREE.MeshPhysicalMaterial({
    color: 0xd4e5d9, roughness: .05, metalness: 0, clearcoat: 1,
    transparent: true, opacity: .022, side: THREE.DoubleSide,
    depthWrite: false, transmission: 0,
  }));
  for (const x of [-3, 3]) {
    const pane = mesh(new THREE.PlaneGeometry(3, 3.3), sideGlassMaterial);
    pane.rotation.y = Math.PI / 2;
    pane.position.x = x;
    pane.renderOrder = 10;
  }
  for (const z of [-1.5, 1.5]) {
    const pane = mesh(new THREE.PlaneGeometry(6, 3.3), frontGlassMaterial);
    pane.position.z = z;
    pane.renderOrder = 11;
  }
  const glassEdgeMaterial = keepMaterial(new THREE.LineBasicMaterial({color: 0xa9bbb0, transparent: true, opacity: .23}));
  const edges = new THREE.LineSegments(keepGeometry(new THREE.EdgesGeometry(new THREE.BoxGeometry(6, 3.3, 3))), glassEdgeMaterial);
  group.add(edges);

  // A thin reflecting surface avoids a solid translucent volume obscuring fins.
  const surfaceMaterial = keepMaterial(new THREE.MeshPhysicalMaterial({
    color: 0xa6c7bb, roughness: .095, metalness: .08,
    transmission: .32, thickness: .015, ior: 1.333, transparent: true,
    opacity: .08, side: THREE.DoubleSide, depthWrite: false,
    clearcoat: 1, clearcoatRoughness: .12,
  }));
  const surfaceGeometry = new THREE.PlaneGeometry(5.97, 2.97, 72, 36);
  surfaceGeometry.rotateX(-Math.PI / 2);
  const surface = mesh(surfaceGeometry, surfaceMaterial);
  surface.position.y = 1.43;
  surface.renderOrder = 12;
  const surfacePositions = surfaceGeometry.attributes.position;
  const surfaceOriginal = Float32Array.from(surfacePositions.array);
  const waterlineMaterial = keepMaterial(new THREE.LineBasicMaterial({color: 0xd8dfcd, transparent: true, opacity: .28}));
  const waterline = new THREE.LineSegments(keepGeometry(new THREE.EdgesGeometry(new THREE.BoxGeometry(5.97, .008, 2.97))), waterlineMaterial);
  waterline.position.y = 1.43;
  group.add(waterline);

  const causticMaterial = keepMaterial(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {uTime: animated.time, uNight: animated.night},
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform float uNight;
      void main(){
        vec2 p = vUv * vec2(10.0,5.0);
        p += vec2(sin(p.y*1.8+uTime*.35),cos(p.x*1.3-uTime*.28))*.30;
        float a = sin(p.x*3.4+p.y*1.3+uTime*.44);
        float b = sin(p.y*4.2-p.x*1.2-uTime*.32);
        float c = sin(p.x*2.1+p.y*2.8-uTime*.25);
        float light = pow(max(0.0,1.0-abs(a+b+c)*.65),18.0);
        vec3 warm = mix(vec3(.83,.76,.55),vec3(.39,.61,.76),uNight);
        gl_FragColor=vec4(warm,light*mix(.052,.034,uNight));
      }
    `,
  }));
  const caustics = mesh(new THREE.PlaneGeometry(5.86, 2.86), causticMaterial);
  caustics.rotation.x = -Math.PI / 2;
  caustics.position.y = -1.568;
  caustics.renderOrder = 1;

  // Small clustered bubbles have a three-dimensional reflective silhouette.
  // All 24 share one instanced draw call instead of many transparent objects.
  const bubbleMaterial = keepMaterial(new THREE.MeshPhysicalMaterial({
    color: 0xc9e4df, roughness: .06, metalness: 0, transparent: true,
    opacity: .23, clearcoat: 1, ior: 1.333, depthWrite: false,
  }));
  const bubbleGeometry = keepGeometry(new THREE.SphereGeometry(1, 10, 7));
  const bubbles = new THREE.InstancedMesh(bubbleGeometry, bubbleMaterial, 24);
  bubbles.name = 'aeration-bubbles';
  bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bubbles.renderOrder = 6;
  group.add(bubbles);
  const bubbleState = Array.from({length: 24}, (_, i) => ({
    phase: random() * 5.7, speed: .30 + random() * .14,
    radius: .012 + random() * .018, x: i % 2 ? -2.71 : 2.68,
    z: -1.12 + random() * .16,
  }));
  const transform = new THREE.Object3D();
  const rippleGeometry = keepGeometry(new THREE.RingGeometry(.9, 1, 64));
  const surfaceGlow = keepMaterial(new THREE.MeshBasicMaterial({color: 0xd4dcca, transparent: true, opacity: .0, side: THREE.DoubleSide, depthWrite: false}));
  const ripplePool = Array.from({length: 7}, () => {
    const material = keepMaterial(surfaceGlow.clone());
    const ring = new THREE.Mesh(rippleGeometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    ring.renderOrder = 13;
    group.add(ring);
    return {mesh: ring, age: 99, duration: 1.65};
  });

  function addRipple(point) {
    if (disposed) return;
    const ripple = ripplePool.find(item => !item.mesh.visible) || ripplePool.reduce((a,b) => a.age > b.age ? a : b);
    ripple.age = 0;
    ripple.mesh.visible = true;
    ripple.mesh.position.set(THREE.MathUtils.clamp(point.x, -2.75, 2.75), 1.443, THREE.MathUtils.clamp(point.z, -1.25, 1.25));
    ripple.mesh.scale.setScalar(.045);
    ripple.mesh.material.opacity = .18;
    if (!ripples.includes(ripple)) ripples.push(ripple);
  }
  let bubbleRippleTime = 0;
  function update(dt, elapsed) {
    if (disposed || !group.visible) return;
    animated.time.value = elapsed;
    for (const plant of plants) {
      plant.object.rotation.z = Math.sin(elapsed * .47 + plant.phase) * .014;
      plant.object.rotation.x = Math.sin(elapsed * .35 + plant.phase) * .009;
    }
    for (let i = 0; i < surfacePositions.count; i++) {
      const j = i * 3, x = surfaceOriginal[j], z = surfaceOriginal[j + 2];
      const height = .004 * Math.sin(x * 3.2 + z * 2.7 + elapsed * 1.1)
        + .003 * Math.cos(z * 5.3 - x * 1.8 - elapsed * .83);
      surfacePositions.setY(i, height);
    }
    surfacePositions.needsUpdate = true;
    // Recompute infrequently: the ripple amplitude is tiny, but reflections move.
    if (Math.floor(elapsed * 8) !== Math.floor((elapsed - dt) * 8)) surfaceGeometry.computeVertexNormals();
    for (let i = 0; i < bubbleState.length; i++) {
      const state = bubbleState[i];
      const height = ((elapsed * state.speed + state.phase) % 2.93) - 1.50;
      transform.position.set(state.x + .034 * Math.sin(height * 3.4 + state.phase), height,
        state.z + .026 * Math.cos(height * 2.4 + state.phase));
      transform.scale.setScalar(state.radius * (1 + (height + 1.5) * .09));
      transform.updateMatrix();
      bubbles.setMatrixAt(i, transform.matrix);
    }
    bubbles.instanceMatrix.needsUpdate = true;
    bubbleRippleTime += dt;
    if (bubbleRippleTime > 4.1) {
      bubbleRippleTime = 0;
      addRipple({x: Math.sin(elapsed) > 0 ? -2.70 : 2.68, z: -1.12});
    }
    for (const ripple of ripples) {
      ripple.age += dt;
      if (ripple.age > ripple.duration) {ripple.mesh.visible = false; continue;}
      const t = ripple.age / ripple.duration;
      ripple.mesh.scale.setScalar(.045 + t * .38);
      ripple.mesh.material.opacity = (1 - t) * .12;
    }
  }

  function setNight(value) {
    night = Boolean(value);
    animated.night.value = night ? 1 : 0;
    surfaceMaterial.color.set(night ? 0x91b5c8 : 0xa6c7bb);
    surfaceMaterial.opacity = night ? .11 : .08;
    glassEdgeMaterial.color.set(night ? 0x788d9d : 0xa9bbb0);
    waterlineMaterial.color.set(night ? 0x9bbdcc : 0xd8dfcd);
    leafMaterial.color.set(night ? 0x496452 : 0x587249);
    for (const ripple of ripplePool) ripple.mesh.material.color.set(night ? 0x9bbdd0 : 0xd4dcca);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    scene.remove(group);
    geometries.forEach(value => value.dispose());
    materials.forEach(value => value.dispose());
    textures.forEach(value => value.dispose());
  }
  update(0, 0);
  return {group, update, setNight, addRipple, setVisible: value => {group.visible = Boolean(value);}, dispose};
}
