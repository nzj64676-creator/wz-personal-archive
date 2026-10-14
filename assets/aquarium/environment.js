// 3D scenery is authored locally; photographed PBR maps are local Poly Haven CC0.
// Texture provenance is recorded in ./textures/LICENSES.md. No runtime CDN calls.
// Coordinate system: 6 × 3.3 × 3 m tank, gravel -1.60 m, water surface 1.43 m.
export function createAquariumEnvironment(THREE, scene, renderer) {
  const group = new THREE.Group();
  group.name = 'aquarium-environment';
  scene.add(group);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const plants = [], ripples = [];
  const animated = {time: {value: 0}, night: {value: 0}};
  const texturePromises = [];
  const textureLoader = new THREE.TextureLoader();
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
  function texture(name, repeatX = 1, repeatY = repeatX, color = false) {
    let resolve, reject;
    texturePromises.push(new Promise((success, failure) => {resolve = success; reject = failure;}));
    const value = textureLoader.load(new URL(`./textures/${name}`, import.meta.url).href,
      loaded => resolve(loaded), undefined, error => reject(error));
    value.wrapS = value.wrapT = THREE.RepeatWrapping;
    value.repeat.set(repeatX, repeatY);
    value.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    value.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    textures.add(value);
    return value;
  }

  // Dark polished cabinet and inset bronze edge keep the tank within WZ's palette.
  const cabinetMaterial = keepMaterial(new THREE.MeshStandardMaterial({color: 0x121411, roughness: .27, metalness: .23}));
  const bronze = keepMaterial(new THREE.MeshStandardMaterial({color: 0x9f8652, roughness: .35, metalness: .83}));
  mesh(new THREE.BoxGeometry(6.22, .17, 3.22), cabinetMaterial).position.y = -1.80;
  mesh(new THREE.BoxGeometry(6.15, .012, 3.15), bronze).position.y = -1.706;
  mesh(new THREE.BoxGeometry(6.12, .095, 3.12), cabinetMaterial).position.y = -1.665;

  // A real suspended light bar and bent side brackets, rather than a flat overlay.
  const lampMaterial = keepMaterial(new THREE.MeshStandardMaterial({color: 0x121514, roughness: .31, metalness: .56}));
  const lampEmitterMaterial = keepMaterial(new THREE.MeshStandardMaterial({
    color: 0xffeccb, emissive: 0xffdb9c, emissiveIntensity: 2.0, roughness: .3,
  }));
  const lampGroup = new THREE.Group();
  lampGroup.name = 'warm-aquarium-top-light';
  group.add(lampGroup);
  mesh(new THREE.BoxGeometry(5.74, .085, .28), lampMaterial, lampGroup).position.set(0, 2.08, -.18);
  mesh(new THREE.BoxGeometry(5.49, .012, .09), lampEmitterMaterial, lampGroup).position.set(0, 2.027, -.18);
  for (const x of [-2.66, 2.66]) {
    mesh(new THREE.BoxGeometry(.040, .47, .048), lampMaterial, lampGroup).position.set(x, 1.855, -.18);
    mesh(new THREE.BoxGeometry(.040, .038, .31), lampMaterial, lampGroup).position.set(x, 1.639, -.32);
    mesh(new THREE.BoxGeometry(.073, .065, .10), lampMaterial, lampGroup).position.set(x, 1.62, -.47);
  }
  const lampLight = new THREE.SpotLight(0xffe4ba, 6.0, 7.5, .82, .80, 1.2);
  lampLight.position.set(0, 2.017, -.18);
  lampLight.target.position.set(0, -1.28, -.15);
  lampLight.castShadow = false;
  lampGroup.add(lampLight, lampLight.target);

  const sandMap = texture('gravel_ground_01_diff_1k.jpg', 4.0, 2.0, true);
  const sandNormal = texture('gravel_ground_01_nor_gl_1k.jpg', 4.0, 2.0);
  const sandArm = texture('gravel_ground_01_arm_1k.jpg', 4.0, 2.0);
  const sandDisplacement = texture('gravel_ground_01_disp_1k.jpg', 4.0, 2.0);
  const sandMaterial = keepMaterial(new THREE.MeshStandardMaterial({
    color: 0xe8deca, map: sandMap, normalMap: sandNormal, normalScale: new THREE.Vector2(.65,.65),
    aoMap: sandArm, aoMapIntensity: .72, roughnessMap: sandArm, roughness: .96,
    displacementMap: sandDisplacement, displacementScale: .032, displacementBias: -.012,
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

  const rockMap = texture('mossy_rock_diff_1k.jpg', 2.0, 1.0, true);
  const rockNormal = texture('mossy_rock_nor_gl_1k.jpg', 2.0, 1.0);
  const rockArm = texture('mossy_rock_arm_1k.jpg', 2.0, 1.0);
  const rockDisplacement = texture('mossy_rock_disp_1k.jpg', 2.0, 1.0);
  const rockMaterial = keepMaterial(new THREE.MeshStandardMaterial({
    color: 0xd8d4bd, map: rockMap, normalMap: rockNormal, normalScale: new THREE.Vector2(.90,.90),
    aoMap: rockArm, aoMapIntensity: .82, roughnessMap: rockArm,
    displacementMap: rockDisplacement, displacementScale: .040, displacementBias: -.018,
    roughness: .93, vertexColors: true,
  }));
  function rock(x, z, sx, sy, sz, seed) {
    const geometry = new THREE.SphereGeometry(1, 56, 34);
    const positions = geometry.attributes.position;
    const colours = [];
    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i), vy = positions.getY(i), vz = positions.getZ(i);
      const erosion = .15 * Math.sin(vx * 5.6 + seed) * Math.cos(vz * 6.1 - seed)
        + .07 * Math.sin(vy * 11 + vx * 8) * Math.sin(vz * 9 + seed);
      const profile = 1 + erosion + .16 * Math.sin(vy * 4 + seed);
      positions.setXYZ(i, vx * profile, vy * profile, vz * profile);
      const shade = .75 + (vy + 1) * .11;
      colours.push(shade, shade, shade);
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
  rock(-2.37, -1.04, .56, .56, .39, 1.3);
  rock(-2.65, -.64, .29, .22, .26, 3.7);
  rock(-1.84, -1.19, .39, .30, .30, 5.1);
  rock(2.40, -1.03, .49, .76, .35, 7.1);
  rock(2.64, -.57, .28, .24, .26, 9.3);
  rock(1.97, -1.23, .40, .40, .25, 12.8);
  rock(-2.09, -.91, .24, .15, .20, 16.5);
  rock(2.42, -.58, .23, .17, .26, 19.2);

  // Seven low river-stone groups enrich the bed without filling the fish's
  // swimming or feeding space. The 21 real PBR meshes share one instanced draw.
  const lowStoneGroups = [
    [-1.10,-.92,.24], [-.40,-1.22,.19], [.60,-.94,.22],
    [-1.40,.66,.25], [.81,.77,.23], [-2.46,.72,.19], [2.39,.91,.22],
  ];
  const smallRockGeometry = keepGeometry(new THREE.SphereGeometry(1,28,18));
  const smallRockPositions = smallRockGeometry.attributes.position;
  const smallRockColours = [];
  for (let i=0;i<smallRockPositions.count;i++) {
    const x=smallRockPositions.getX(i), y=smallRockPositions.getY(i), z=smallRockPositions.getZ(i);
    const profile=1+.10*Math.sin(x*6.1+1.8)*Math.cos(z*7.3-2.0)+.065*Math.sin(y*9.8+x*5.4);
    smallRockPositions.setXYZ(i,x*profile,y*profile,z*profile);
    const shade=.79+(y+1)*.09;
    smallRockColours.push(shade,shade,shade);
  }
  smallRockGeometry.setAttribute('color',new THREE.Float32BufferAttribute(smallRockColours,3));
  smallRockGeometry.computeVertexNormals();
  const smallRocks = new THREE.InstancedMesh(smallRockGeometry,rockMaterial,lowStoneGroups.length*3);
  smallRocks.name='low-river-stone-groups';
  const smallRockTransform=new THREE.Object3D();
  let smallRockIndex=0;
  for(const [clusterX,clusterZ,spread] of lowStoneGroups) {
    for(let i=0;i<3;i++) {
      const sx=spread*(.49+random()*.66), sy=.072+random()*.077, sz=sx*(.64+random()*.32);
      const x=clusterX+(i-1)*spread*.72+(random()-.5)*.065;
      const z=clusterZ+(random()-.5)*spread*.67;
      const sandSlope=.10*Math.pow(Math.max(0,-z/1.5),2);
      smallRockTransform.position.set(x,-1.60+sy*.73+sandSlope,z);
      smallRockTransform.scale.set(sx,sy,sz);
      smallRockTransform.rotation.set((random()-.5)*.17,random()*6.2,(random()-.5)*.22);
      smallRockTransform.updateMatrix();
      smallRocks.setMatrixAt(smallRockIndex++,smallRockTransform.matrix);
    }
  }
  smallRocks.instanceMatrix.needsUpdate=true;
  group.add(smallRocks);
  // Fine physical river gravel breaks up the flat sand without individual draws.
  const gravelMaterial = keepMaterial(new THREE.MeshStandardMaterial({
    color: 0xe2d8be, map: sandMap, roughness: .94,
  }));
  const gravelGeometry = keepGeometry(new THREE.IcosahedronGeometry(1, 1));
  const gravel = new THREE.InstancedMesh(gravelGeometry, gravelMaterial, 720);
  gravel.name = 'small-river-gravel';
  const gravelTransform = new THREE.Object3D();
  const gravelColour = new THREE.Color();
  for (let i = 0; i < gravel.count; i++) {
    const cluster=lowStoneGroups[i%lowStoneGroups.length];
    const clustered=i%3!==0;
    const x = clustered ? cluster[0]+(random()-.5)*.68 : (random()-.5)*5.65;
    const z = clustered ? cluster[1]+(random()-.5)*.48 : (random()-.5)*2.65;
    const radius = .009 + random() * .025;
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

  // Full-bleed AI-authored leaf-surface detail is mapped onto the existing curved
  // plant geometry. Its origin is separately recorded; it is not a photo scan.
  const leafMap=texture('aquatic-leaf-generated.webp',1,1,true);
  const leafMaterial = keepMaterial(new THREE.MeshStandardMaterial({
    color: 0xdde6cc, map:leafMap, bumpMap:leafMap, bumpScale:.0025,
    roughness: .79, metalness: 0, vertexColors: true,
    side: THREE.DoubleSide, transparent: true, opacity: .98,
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
  function leafGeometry(height, width, bend, twist, oval = false) {
    const positions = [], colours = [], uvs = [], indices = [];
    const rows = 19;
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      const taper = Math.pow(Math.sin(Math.PI * t), oval ? .56 : .7);
      const halfWidth = width * taper;
      const centreX = Math.sin(t * 1.7) * bend * t + (oval ? 0 : .021*Math.sin(t*5+twist)*t*t);
      const centreZ = (oval ? .045 : .09) * Math.sin(t * 3 + twist) * t;
      const droop=oval ? 0 : Math.pow(Math.max(0,t-.65),2)*height*.11;
      for (let j = 0; j < 3; j++) {
        const lateral = j - 1;
        positions.push(centreX + lateral * halfWidth, t * height-droop,
          centreZ + lateral * lateral * (oval ? .023 : .015) * taper);
        const light = .70 + t * .26;
        // Visible curved midrib and darker sides form an actual blade cross-section.
        colours.push(light * (j === 1 ? .98 : .90), light, light * .91);
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

  // Opposed oval leaves on curved stems add a second living plant structure.
  // Every clump is merged; this is geometry, never a cutout or a billboard.
  function broadleafPlant(x, z, height, stalkCount, seed) {
    const plantGroup = new THREE.Group();
    plantGroup.position.set(x, -1.56, z);
    plantGroup.name = 'broadleaf-aquatic-stems';
    const positions = [], colours = [], uvs = [], indices = [];
    const leafTransform = new THREE.Object3D();
    function append(geometry, matrix, shade = .80) {
      geometry.applyMatrix4(matrix);
      const offset = positions.length / 3;
      positions.push(...geometry.attributes.position.array);
      if (geometry.attributes.color) colours.push(...geometry.attributes.color.array);
      else for (let j = 0; j < geometry.attributes.position.count; j++) colours.push(shade * .79, shade, shade * .56);
      if (geometry.attributes.uv) uvs.push(...geometry.attributes.uv.array);
      else for (let j = 0; j < geometry.attributes.position.count; j++) uvs.push(0, 0);
      if (geometry.index) for (const index of geometry.index.array) indices.push(index + offset);
      else for (let j = 0; j < geometry.attributes.position.count; j++) indices.push(j + offset);
      geometry.dispose();
    }
    for (let stalk = 0; stalk < stalkCount; stalk++) {
      const h = height * (.70 + random() * .30);
      const originX = (random() - .5) * .25, originZ = (random() - .5) * .18;
      const bend = (random() - .5) * .25;
      const points = [
        new THREE.Vector3(originX, 0, originZ),
        new THREE.Vector3(originX + bend * .28, h * .45, originZ - .04),
        new THREE.Vector3(originX + bend, h, originZ + .03),
      ];
      const stem = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, .008, 5, false);
      append(stem, new THREE.Matrix4(), .69);
      const levels = Math.floor(h / .16);
      for (let level = 1; level <= levels; level++) {
        const t = level / (levels + 1), stemX = originX + bend * t * t;
        for (const side of [-1, 1]) {
          const length = .17 + random() * .12;
          const geometry = leafGeometry(length, .053 + random() * .031, .052, seed + level, true);
          leafTransform.position.set(stemX, h * t, originZ);
          leafTransform.rotation.set(.25 + random() * .35, stalk * 1.34 + level * .56 + (side > 0 ? 0 : Math.PI), -.67);
          leafTransform.updateMatrix();
          append(geometry, leafTransform.matrix);
        }
      }
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    merged.setIndex(indices);
    merged.computeVertexNormals();
    mesh(merged, leafMaterial, plantGroup);
    group.add(plantGroup);
    plants.push({object: plantGroup, phase: seed});
  }
  broadleafPlant(-2.53, -1.18, 2.48, 4, 21);
  broadleafPlant(2.64, -1.15, 2.60, 4, 25);
  broadleafPlant(-1.83, -1.31, .96, 3, 29);
  broadleafPlant(1.77, -1.32, 1.34, 3, 33);
  plant(-2.25, -1.36, 2.65, 10, .53, 37);
  plant(2.10, -1.34, 2.52, 12, .49, 41);
  plant(-1.43, -1.37, 1.33, 8, .32, 45);
  plant(1.31, -1.37, .98, 9, .29, 49);

  // Local analytical scattering gives the submerged region its own depth/tint.
  // Only the back-facing boundary is drawn: there is no global scene fog and
  // no fogged lamp or room. Depth testing keeps the solid fish silhouette clear.
  // This is a low-density Beer-Lambert approximation, not full volume transport.
  const waterBoundsMin = new THREE.Vector3(-2.978, -1.585, -1.478);
  const waterBoundsMax = new THREE.Vector3(2.978, 1.424, 1.478);
  const waterVolumeMaterial = keepMaterial(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, side: THREE.BackSide,
    uniforms: {
      uNight: animated.night, uTime: animated.time,
      uBoundsMin: {value: waterBoundsMin}, uBoundsMax: {value: waterBoundsMax},
      uDensity: {value: .125},
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main(){
        vec4 world = modelMatrix * vec4(position,1.0);
        vWorldPosition = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vWorldPosition;
      uniform vec3 uBoundsMin;
      uniform vec3 uBoundsMax;
      uniform float uDensity;
      uniform float uNight;
      uniform float uTime;
      void main(){
        vec3 direction = normalize(vWorldPosition-cameraPosition);
        vec3 invDirection = 1.0/(direction+vec3(.000001));
        vec3 hitA = (uBoundsMin-cameraPosition)*invDirection;
        vec3 hitB = (uBoundsMax-cameraPosition)*invDirection;
        vec3 nearHit = min(hitA,hitB), farHit = max(hitA,hitB);
        float entry = max(max(nearHit.x,nearHit.y),nearHit.z);
        float exitDepth = min(min(farHit.x,farHit.y),farHit.z);
        float depth = max(0.0,exitDepth-max(0.0,entry));
        float height = clamp((vWorldPosition.y-uBoundsMin.y)/(uBoundsMax.y-uBoundsMin.y),0.0,1.0);
        float extinction = 1.0-exp(-depth*uDensity);
        vec3 day = mix(vec3(.235,.285,.135),vec3(.42,.44,.225),height);
        vec3 moon = mix(vec3(.090,.160,.175),vec3(.165,.265,.285),height);
        vec3 water = mix(day,moon,uNight);
        gl_FragColor = vec4(water,extinction*.91);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }));
  const waterVolume = mesh(new THREE.BoxGeometry(5.956, 3.009, 2.956), waterVolumeMaterial);
  waterVolume.name = 'bounded-underwater-scattering';
  waterVolume.position.y = (waterBoundsMin.y + waterBoundsMax.y) / 2;
  waterVolume.renderOrder = 2;

  // Several genuinely three-dimensional, very faint light-shaft cross-sections
  // provide suspended-light cues. They are clipped to the submerged box in the
  // fragment shader, feathered at edges and drawn without writing depth.
  const lightShaftMaterial = keepMaterial(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: {uNight: animated.night, uTime: animated.time},
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec2 vUv;
      void main(){
        vec4 world=modelMatrix*vec4(position,1.0);
        vWorldPosition=world.xyz;
        vWorldNormal=normalize(mat3(modelMatrix)*normal);
        vUv=uv;
        gl_Position=projectionMatrix*viewMatrix*world;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec2 vUv;
      uniform float uNight;
      uniform float uTime;
      void main(){
        if(abs(vWorldPosition.x)>2.97 || abs(vWorldPosition.z)>1.47 ||
           vWorldPosition.y>1.427 || vWorldPosition.y< -1.57) discard;
        vec3 viewDirection=normalize(cameraPosition-vWorldPosition);
        float facing=abs(dot(normalize(vWorldNormal),viewDirection));
        float feather=pow(facing,1.8);
        float endFade=smoothstep(0.0,.14,vUv.y)*(1.0-smoothstep(.92,1.0,vUv.y));
        float slowRipple=.91+.09*sin(uTime*.42+vWorldPosition.y*3.4+vWorldPosition.x*2.0);
        float alpha=feather*endFade*(.28+.72*vUv.y)*slowRipple*mix(.034,.025,uNight);
        vec3 ray=mix(vec3(.92,.83,.51),vec3(.42,.61,.72),uNight);
        gl_FragColor=vec4(ray,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }));
  for (const [x,z,width,tilt] of [[-1.75,-.52,.37,-.11],[-.42,-.32,.49,-.075],[1.18,-.48,.40,-.04]]) {
    const shaft = mesh(new THREE.CylinderGeometry(width*.48,width,2.95,20,1,true), lightShaftMaterial);
    shaft.name = 'submerged-lamp-light-shaft';
    shaft.position.set(x,-.060,z);
    shaft.rotation.z = tilt;
    shaft.renderOrder = 4;
  }

  const suspendedPositions = [];
  for (let i = 0; i < 150; i++) suspendedPositions.push((random()-.5)*5.75, -1.46+random()*2.82, (random()-.5)*2.72);
  const suspendedGeometry = new THREE.BufferGeometry();
  suspendedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(suspendedPositions,3));
  const suspendedMaterial = keepMaterial(new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,depthTest:true,
    uniforms:{uTime:animated.time,uNight:animated.night},
    vertexShader:`
      uniform float uTime;
      void main(){
        vec3 p=position;
        p.x+=sin(uTime*.19+position.y*2.1)*.025;
        p.y+=sin(uTime*.15+position.x*1.3)*.017;
        vec4 view=modelViewMatrix*vec4(p,1.0);
        gl_Position=projectionMatrix*view;
        gl_PointSize=clamp(13.0/(-view.z),.7,2.1);
      }
    `,
    fragmentShader:`
      precision highp float;
      uniform float uNight;
      void main(){
        float r=length(gl_PointCoord-.5)*2.0;
        if(r>1.0)discard;
        float alpha=pow(1.0-r,2.0)*mix(.085,.055,uNight);
        gl_FragColor=vec4(mix(vec3(.91,.85,.62),vec3(.55,.72,.76),uNight),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }));
  const suspendedParticles = new THREE.Points(keepGeometry(suspendedGeometry),suspendedMaterial);
  suspendedParticles.name = 'subtle-water-suspended-particles';
  suspendedParticles.renderOrder = 5;
  group.add(suspendedParticles);

  const sideGlassMaterial = keepMaterial(new THREE.MeshPhysicalMaterial({
    color: 0xd9e7d8, roughness: .036, metalness: 0,
    transmission: .92, thickness: .027, ior: 1.5, transparent: true,
    opacity: .13, side: THREE.DoubleSide, depthWrite: false,
    clearcoat: .8, clearcoatRoughness: .04,
  }));
  const frontGlassMaterial = keepMaterial(new THREE.MeshPhysicalMaterial({
    color: 0xdbe3c7, roughness: .036, metalness: 0, clearcoat: 1,
    transparent: true, opacity: .027, side: THREE.DoubleSide,
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
  // Thin dark structural seams keep the cabinet, water and glass readable.
  const seamMaterial = keepMaterial(new THREE.MeshStandardMaterial({color: 0x252a25, roughness: .25, metalness: .4}));
  for (const x of [-3.012, 3.012]) for (const z of [-1.505, 1.505]) {
    const seam = mesh(new THREE.BoxGeometry(.014, 3.28, .014), seamMaterial);
    seam.position.set(x, -.007, z);
  }

  // A thin reflecting surface avoids a solid translucent volume obscuring fins.
  const surfaceMaterial = keepMaterial(new THREE.MeshPhysicalMaterial({
    color: 0xc0cdae, roughness: .060, metalness: .08,
    transmission: .32, thickness: .015, ior: 1.333, transparent: true,
    opacity: .12, side: THREE.DoubleSide, depthWrite: false,
    clearcoat: 1, clearcoatRoughness: .12,
  }));
  const surfaceGeometry = new THREE.PlaneGeometry(5.97, 2.97, 72, 36);
  surfaceGeometry.rotateX(-Math.PI / 2);
  const surface = mesh(surfaceGeometry, surfaceMaterial);
  surface.position.y = 1.43;
  surface.renderOrder = 12;
  const surfacePositions = surfaceGeometry.attributes.position;
  const surfaceOriginal = Float32Array.from(surfacePositions.array);
  const waterlineMaterial = keepMaterial(new THREE.LineBasicMaterial({color: 0xf2e4b6, transparent: true, opacity: .47}));
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
    surfaceMaterial.color.set(night ? 0x91b5c8 : 0xc0cdae);
    surfaceMaterial.opacity = night ? .12 : .12;
    glassEdgeMaterial.color.set(night ? 0x788d9d : 0xa9bbb0);
    waterlineMaterial.color.set(night ? 0x9bbdcc : 0xf2e4b6);
    leafMaterial.color.set(night ? 0xbccbc4 : 0xdde6cc);
    lampEmitterMaterial.emissiveIntensity = night ? 1.6 : 2.0;
    lampLight.color.set(night ? 0xd5e5ec : 0xffe4ba);
    lampLight.intensity = night ? 4.8 : 6.0;
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
  return {
    group, update, setNight, addRipple, setVisible: value => {group.visible = Boolean(value);}, dispose,
    ready: Promise.all(texturePromises),
    textureSources: ['https://polyhaven.com/a/mossy_rock', 'https://polyhaven.com/a/gravel_ground_01'],
  };
}
