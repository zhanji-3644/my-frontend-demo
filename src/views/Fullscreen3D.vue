<template>
  <div class="fullscreen-3d">
    <div class="back-btn" @click="$router.back()">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="#333">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
      </svg>
    </div>
    <div ref="canvasContainer" class="canvas-full"></div>
    <div class="perf-panel">
      <div class="perf-row">FPS <span>{{ perf.fps }}</span></div>
      <div class="perf-row">Draws <span>{{ perf.draws }}</span></div>
      <div class="perf-row">Tris <span>{{ perf.tris }}</span></div>
    </div>
    <div class="slider-panel">
      <div class="time-display">{{ timeLabel }}</div>
      <input
        type="range"
        :min="0"
        :max="timeSteps.length - 1"
        :value="currentStep"
        step="1"
        class="time-slider"
        @input="onSliderInput"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const canvasContainer = ref(null)
const currentStep = ref(24)
const perf = ref({ fps: 0, draws: 0, tris: '0' })

let renderer, scene, camera, controls, animationId
let sunLight, modelGroup
let perfFrames = 0
let perfTime = performance.now()

function toRad(d) { return d * Math.PI / 180 }

const timeSteps = []
for (let t = 0; t <= 48; t++) {
  const totalMin = 8 * 60 + t * 10
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  timeSteps.push({ totalMin, label: h + ':' + String(m).padStart(2, '0') })
}

const timeLabel = computed(() => timeSteps[currentStep.value]?.label || '12:00')

function sunPosition(totalMin) {
  const t = (totalMin - 8 * 60) / (8 * 60)
  const altitude = toRad(15 + Math.sin(t * Math.PI) * 60)
  const azimuth = toRad(315 + t * 90)
  const dist = 8
  return new THREE.Vector3(
    dist * Math.cos(altitude) * Math.sin(azimuth),
    dist * Math.sin(altitude),
    dist * Math.cos(altitude) * Math.cos(azimuth)
  )
}

function updateSunLight() {
  if (!sunLight) return
  const pos = sunPosition(timeSteps[currentStep.value].totalMin)
  sunLight.position.copy(pos)
}

function onSliderInput(e) {
  currentStep.value = Number(e.target.value)
  updateSunLight()
}

onMounted(() => {
  const container = canvasContainer.value
  const w = window.innerWidth
  const h = window.innerHeight

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf5f5f5)

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200)
  camera.position.set(4, 3, 6)

  renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  container.appendChild(renderer.domElement)

  window.scene = scene
  window.renderer = renderer
  window.camera = camera

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.1

  scene.add(new THREE.AmbientLight(0xffffff, 0.35))

  sunLight = new THREE.DirectionalLight(0xffffff, 3.5)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.width = 2048
  sunLight.shadow.mapSize.height = 2048
  sunLight.shadow.camera.near = 0.5
  sunLight.shadow.camera.far = 30
  sunLight.shadow.camera.left = -6
  sunLight.shadow.camera.right = 6
  sunLight.shadow.camera.top = 6
  sunLight.shadow.camera.bottom = -6
  sunLight.shadow.bias = -0.0005
  sunLight.shadow.normalBias = 0.02
  scene.add(sunLight)
  scene.add(sunLight.target)
  sunLight.target.position.set(0, 0, 0)

  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.4)
  scene.add(hemiLight)

  modelGroup = new THREE.Group()
  scene.add(modelGroup)

  updateSunLight()

  window.renderer = renderer

  const loader = new GLTFLoader()
  loader.load(import.meta.env.BASE_URL + 'models/ac.glb',
    (gltf) => {
      const model = gltf.scene
      const box = new THREE.Box3().setFromObject(model)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 3 / maxDim
      model.scale.setScalar(scale)
      model.position.set(-center.x * scale, -center.y * scale, -center.z * scale)

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })

      modelGroup.add(model)

      const worldBox = new THREE.Box3().setFromObject(modelGroup)
      const worldCenter = worldBox.getCenter(new THREE.Vector3())
      controls.target.copy(worldCenter)
      controls.update()

      const worldSize = worldBox.getSize(new THREE.Vector3())
      const extent = Math.max(worldSize.x, worldSize.y, worldSize.z) * 0.8
      sunLight.shadow.camera.left = -extent
      sunLight.shadow.camera.right = extent
      sunLight.shadow.camera.top = extent
      sunLight.shadow.camera.bottom = -extent
      updateSunLight()
    },
    undefined,
    (error) => console.error('Failed to load ac.glb:', error)
  )

  function animate() {
    animationId = requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)

    perfFrames++
    const now = performance.now()
    if (now - perfTime >= 500) {
      perf.value = {
        fps: Math.round(perfFrames / ((now - perfTime) / 1000)),
        draws: renderer.info.render.calls,
        tris: renderer.info.render.triangles >= 1000
          ? (renderer.info.render.triangles / 1000).toFixed(1) + 'k'
          : renderer.info.render.triangles
      }
      perfFrames = 0
      perfTime = now
    }
  }
  animate()

  window.addEventListener('resize', onResize)
})

function onResize() {
  if (!renderer) return
  const w = window.innerWidth
  const h = window.innerHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', onResize)
  controls?.dispose()
  renderer?.dispose()
  delete window.scene
  delete window.renderer
  delete window.camera
})
</script>

<style scoped>
.fullscreen-3d {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: #f5f5f5;
}

.back-btn {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,0.85);
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(4px);
}

.canvas-full {
  width: 100%;
  height: 100%;
}

.perf-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  background: rgba(255,255,255,0.8);
  backdrop-filter: blur(4px);
  border-radius: 8px;
  padding: 8px 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
}

.perf-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: #999;
  line-height: 1.6;
}

.perf-row span {
  color: #333;
  font-weight: 600;
  min-width: 36px;
  text-align: right;
}

.slider-panel {
  position: absolute;
  bottom: 24px;
  left: 16px;
  right: 16px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.time-display {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(4px);
  padding: 6px 20px;
  border-radius: 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
}

.time-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(255,255,255,0.7);
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
  outline: none;
}

.time-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #07c160;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  cursor: pointer;
}

.time-slider::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #07c160;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  cursor: pointer;
  border: none;
}
</style>
