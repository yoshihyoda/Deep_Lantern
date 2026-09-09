import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Illustrative water optics only. This never modifies the scientific geometry.
export function createUnderwater(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, strength: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv;
      void main(){
        vec3 col=texture2D(tDiffuse,vUv).rgb;
        vec2 p=vUv*2.-1.;
        float edge=smoothstep(.22,1.4,length(p*vec2(.85,1.)));
        col*=1.-edge*.36*strength;
        col=mix(col,col*vec3(.82,1.015,1.065),strength*.65);
        gl_FragColor=vec4(col,1.);
      }`,
  });
  const output = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(grade);
  composer.addPass(output);

  const particleGeometry = new THREE.BufferGeometry();
  const position = new Float32Array(1000 * 3),
    seeds = new Float32Array(1000);
  // Repeatable particles make reduced-motion and screenshot states stable.
  let seed = 137;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 1000; i++) {
    position.set(
      [(random() - 0.5) * 100, (random() - 0.5) * 70, (random() - 0.5) * 100],
      i * 3,
    );
    seeds[i] = random();
  }
  particleGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(position, 3),
  );
  particleGeometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      pixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: `uniform float time; uniform float pixelRatio; attribute float seed; varying float alpha;
      void main(){
        vec3 box=vec3(100.,70.,100.);
        vec3 drift=vec3(time*.09,-time*.07,time*.035);
        vec3 world=mod(position+drift-cameraPosition+box*.5,box)-box*.5+cameraPosition;
        vec4 mv=viewMatrix*vec4(world,1.);
        float d=length(world-cameraPosition);
        alpha=(1.-smoothstep(25.,60.,d))*smoothstep(.8,4.,d)*(.2+seed*.45);
        alpha*=1.-smoothstep(-1.,.5,world.y);
        gl_PointSize=clamp((18.+seed*26.)/max(1.,-mv.z),1.,4.)*pixelRatio;
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `varying float alpha; void main(){float r=length(gl_PointCoord-.5)*2.; float soft=1.-smoothstep(.05,1.,r);gl_FragColor=vec4(.52,.8,.86,soft*alpha);}`,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false;
  particles.renderOrder = 3;
  scene.add(particles);

  const lightTarget = new THREE.Object3D();
  scene.add(lightTarget);
  const lamps = [-1, 1].map((side) => {
    const light = new THREE.SpotLight(
      side < 0 ? 0xbbe7e1 : 0xc4e5ff,
      1300,
      125,
      0.54,
      0.92,
      2,
    );
    light.target = lightTarget;
    scene.add(light);
    return light;
  });
  const forward = new THREE.Vector3(),
    right = new THREE.Vector3();
  return {
    update(
      time: number,
      immersive: boolean,
      effects: boolean,
      lights: boolean,
    ) {
      particles.visible = immersive && effects;
      particleMaterial.uniforms.time.value = time;
      camera.getWorldDirection(forward);
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      lightTarget.position.copy(camera.position).addScaledVector(forward, 42);
      lamps.forEach((l, i) => {
        l.visible = immersive && lights;
        l.position
          .copy(camera.position)
          .addScaledVector(right, i === 0 ? -1.3 : 1.3);
      });
      grade.uniforms.strength.value = immersive && effects ? 1 : 0;
    },
    render(immersive: boolean, effects: boolean) {
      if (immersive && effects) composer.render();
      else renderer.render(scene, camera);
    },
    resize(width: number, height: number) {
      composer.setSize(width, height);
    },
    setPixelRatio(ratio: number) {
      composer.setPixelRatio(ratio);
      particleMaterial.uniforms.pixelRatio.value = ratio;
    },
    dispose() {
      composer.passes.forEach((p) => p.dispose());
      composer.dispose();
      scene.remove(particles, lightTarget, ...lamps);
      particleGeometry.dispose();
      particleMaterial.dispose();
      lamps.forEach((l) => l.dispose());
    },
  };
}

// Fine color variation suggests a rocky surface; it adds no invented geometry.
export function addSeafloorAppearance(
  material: THREE.MeshStandardMaterial,
  strength: { value: number },
) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.seafloorAppearance = strength;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vSeafloorPosition;',
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvSeafloorPosition=(modelMatrix*vec4(transformed,1.)).xyz;',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vSeafloorPosition; uniform float seafloorAppearance;
      float seabedHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      float seabedNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(seabedHash(i),seabedHash(i+vec3(1,0,0)),f.x),mix(seabedHash(i+vec3(0,1,0)),seabedHash(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(seabedHash(i+vec3(0,0,1)),seabedHash(i+vec3(1,0,1)),f.x),mix(seabedHash(i+vec3(0,1,1)),seabedHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float rock=seabedNoise(vSeafloorPosition*2.8)*.55+seabedNoise(vSeafloorPosition*11.)*.3+seabedNoise(vSeafloorPosition*37.)*.15;
      diffuseColor.rgb*=mix(1.,.6+rock*.55,seafloorAppearance);
    `,
    );
  };
  material.customProgramCacheKey = () => 'abyss-seafloor-appearance-v1';
}
