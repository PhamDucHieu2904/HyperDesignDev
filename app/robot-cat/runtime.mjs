import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CatDirector } from './director.mjs';
import bytes from './source/robot-cat.glb';
import manifest from './source/behaviors.json';
import happy from './source/face_happy.png';
import open from './source/face_open.png';
import curious from './source/face_curious.png';
import sleepy from './source/face_sleepy.png';
import closed from './source/face_closed.png';
import surprised from './source/face_surprised.png';
import love from './source/face_love.png';
import dizzy from './source/face_dizzy.png';
import focused from './source/face_focused.png';
import wink from './source/face_wink.png';

// Assets are bundled separately and requested only on entering Blueprint.
// parseAsync + embedded PNGs also support the site's direct file:// workflow.
window.HyperDRobotCat = { mount(canvas, ready, fail) {
  let disposed = false, frame = 0, last = 0, hold, down, model, mixer, director, action;
  let renderer, controls, environment;
  const cleanups = [], materials = new Set(), textures = new Set(), geometries = new Set();
  const stale = [], scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, .05, 30);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const raycaster = new THREE.Raycaster();
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = faceCanvas.height = 512;
  const ctx = faceCanvas.getContext('2d');
  const face = new THREE.CanvasTexture(faceCanvas);
  face.flipY = false; face.colorSpace = THREE.SRGBColorSpace; textures.add(face);
  let active = 'happy', previous = 'happy', blendTime = 1, painted = '';
  const images = {};
  function listen(target, name, fn) { target.addEventListener(name, fn); cleanups.push(() => target.removeEventListener(name, fn)); }
  function collect(root) {
    root.traverse(o => {
      if (o.geometry) geometries.add(o.geometry);
      for (const material of [o.material].flat().filter(Boolean)) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
  }
  function disposeResources() {
    for (const resource of [...materials, ...textures, ...geometries]) resource.dispose();
    materials.clear(); textures.clear(); geometries.clear();
  }
  function play(name) {
    const next = mixer.clipAction(THREE.AnimationClip.findByName(model.animations, name));
    if (action && action !== next) { action.fadeOut(.25); stale.push({ action, time: .3 }); }
    for (let i = stale.length - 1; i >= 0; i--) if (stale[i].action === next) stale.splice(i, 1);
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    next.setLoop(manifest.clips[name].loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = true;
    if (action && action !== next) next.fadeIn(.25);
    next.play(); action = next;
  }
  function updateFace(dt) {
    const next = director.expression();
    if (next !== active) { previous = active; active = next; blendTime = 0; }
    if (painted === active && blendTime >= .16) return;
    blendTime += dt;
    const t = Math.min(1, blendTime / .16);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 512);
    ctx.globalCompositeOperation = 'lighter';
    if (t < 1) { ctx.globalAlpha = 1 - t; ctx.drawImage(images[previous], 0, 0); }
    ctx.globalAlpha = t; ctx.drawImage(images[active], 0, 0);
    ctx.globalAlpha = 1; face.needsUpdate = true; painted = active;
  }
  function regionAt(event) {
    if (!model) return null;
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1, -(event.clientY-r.top)/r.height*2+1), camera);
    return raycaster.intersectObject(model, true).find(hit => hit.object.userData.region)?.object.userData.region;
  }
  function cancel() { clearTimeout(hold); down = null; }
  function tick(time) {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    const dt = Math.min((time-last)/1000, .05) || 0; last = time;
    if (document.hidden) return;
    if (!director.paused) {
      director.update(dt); mixer.update(dt);
      for (let i=stale.length-1; i>=0; i--) if ((stale[i].time -= dt) <= 0) { stale[i].action.stop(); stale.splice(i,1); }
    }
    updateFace(dt); controls.update(); renderer.render(scene, camera);
  }
  async function init() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor(0, 0); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.enablePan = false; controls.enableZoom = false;
    controls.minPolarAngle = .35; controls.maxPolarAngle = 1.58;
    controls.target.set(.04, .8, .05);
    function resize() {
      const {width, height} = canvas.parentElement.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false); camera.aspect = width/height;
      // Leave room for the baked chase/hop envelope on narrow displays.
      const distance = Math.max(1, .92/camera.aspect);
      camera.position.set(2.1*distance, .8+.7*distance, 3.75*distance);
      camera.updateProjectionMatrix(); controls.update();
    }
    const observer = new ResizeObserver(resize); observer.observe(canvas.parentElement); cleanups.push(() => observer.disconnect()); resize();
    const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromScene(room, .05); scene.environment = environment.texture; room.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xe7f6ff, 0x9d9d7e, 2));
    const key = new THREE.DirectionalLight(0xfff2df, 3); key.position.set(2,4,3); scene.add(key);
    const fill = new THREE.DirectionalLight(0xb5ddff, 1); fill.position.set(-2,1,-1); scene.add(fill);
    await Promise.all(Object.entries({happy,open,curious,sleepy,closed,surprised,love,dizzy,focused,wink}).map(async ([name,src]) => {
      const image = new Image(); image.src = src; await image.decode(); images[name] = image;
    }));
    if (disposed) return;
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength), '');
    model = gltf.scene; collect(model);
    if (disposed) { disposeResources(); return; }
    model.animations = gltf.animations; model.position.y = .213; scene.add(model);
    model.traverse(o => {
      if (o.isMesh && o.userData.region === 'screen') {
        o.material = new THREE.MeshPhysicalMaterial({color:0x030812,roughness:.2,metalness:.25,clearcoat:1,clearcoatRoughness:.15,emissive:0x29dfff,emissiveIntensity:2.5,emissiveMap:face});
        materials.add(o.material);
      }
    });
    mixer = new THREE.AnimationMixer(model);
    director = new CatDirector(manifest, {onPlay:play,reducedMotion:reduced.matches}); director.play('Idle'); mixer.update(0);
    listen(canvas, 'pointerdown', e => {
      down = {x:e.clientX,y:e.clientY,id:e.pointerId,moved:false,held:false};
      if (regionAt(e) === 'head') hold = setTimeout(() => { if (down && !down.moved) { down.held=true; director.touch('head'); } },550);
    });
    listen(canvas, 'pointermove', e => { if (down && Math.hypot(e.clientX-down.x,e.clientY-down.y)>8) {down.moved=true;clearTimeout(hold);} });
    listen(canvas, 'pointerup', e => { if (down && e.pointerId===down.id && !down.moved && !down.held) {const region=regionAt(e);if(region)director.touch(region);} cancel(); });
    listen(canvas, 'pointercancel', cancel); listen(canvas, 'lostpointercapture', cancel);
    listen(canvas, 'keydown', e => {
      if (e.key==='Enter') {e.preventDefault();director.touch('paw');}
      if (e.code==='Space') {e.preventDefault();director.paused=!director.paused;}
    });
    listen(reduced,'change',e=>{director.auto=!e.matches;director.paused=e.matches;});
    listen(canvas,'webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(frame);fail(new Error('WebGL context lost'));});
    ready(); frame=requestAnimationFrame(tick);
  }
  init().catch(error => { if (!disposed) fail(error); });
  return () => {
    disposed=true; cancelAnimationFrame(frame); cancel(); cleanups.forEach(fn=>fn());
    controls?.dispose(); mixer?.stopAllAction(); if(model)mixer?.uncacheRoot(model);
    disposeResources(); environment?.dispose(); renderer?.dispose(); renderer?.forceContextLoss();
  };
} };
