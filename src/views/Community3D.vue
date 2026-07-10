<template>
  <div class="fullscreen-3d">
    <div class="back-btn" @click="$router.back()">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="#333">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
      </svg>
    </div>
    <div ref="canvasContainer" class="canvas-full"></div>
    <div ref="labelContainer" class="label-container"></div>
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
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'

const canvasContainer = ref(null)
const labelContainer = ref(null)
const currentStep = ref(24)
const selectedIndex = ref(-1)
const perf = ref({ fps: 0, draws: 0, tris: '0' })

let renderer, labelRenderer, scene, camera, controls, animationId
let sunLight, overlayGroup, wireframeGroup, clickTargets = []
let canvasEl
let perfFrames = 0
let perfTime = performance.now()
let raycaster, mouse

function toRad(d) { return d * Math.PI / 180 }

const timeSteps = []
for (let t = 0; t <= 48; t++) {
  const totalMin = 8 * 60 + t * 10
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  timeSteps.push({ totalMin, label: h + ':' + String(m).padStart(2, '0') })
}

const timeLabel = computed(() => timeSteps[currentStep.value]?.label || '12:00')

const FLOOR_HEIGHT = 0.3

const buildingsConfig = [
  { id: '1#',  x: -3.5, z: -5.5, w: 0.6, d: 1.0, floors: 8,  color: 0xd4b896, shape: 'rect' },
  { id: '2#',  x: -1.8, z: -5.5, w: 0.6, d: 1.0, floors: 10, color: 0xc9b896, shape: 'rect' },
  { id: '3#',  x:  0.0, z: -5.5, w: 0.6, d: 1.0, floors: 7,  color: 0xd4c4a0, shape: 'rect' },
  { id: '4#',  x:  1.8, z: -5.5, w: 0.6, d: 1.0, floors: 9,  color: 0xccc09a, shape: 'rect' },
  { id: '5#',  x:  3.5, z: -5.5, w: 0.6, d: 1.0, floors: 11, color: 0xd0bc94, shape: 'rect' },

  { id: '6#',  x: -3.5, z: -1.8, w: 0.6, d: 1.0, floors: 10, color: 0xd4b896, shape: 'rect' },
  { id: '7#',  x: -1.8, z: -1.8, w: 0.6, d: 1.0, floors: 8,  color: 0xc9b896, shape: 'rect' },
  { id: '8#',  x:  0.0, z: -1.8, w: 0.6, d: 1.0, floors: 9,  color: 0xd4c4a0, shape: 'rect' },
  { id: '9#',  x:  1.8, z: -1.8, w: 0.6, d: 1.0, floors: 11, color: 0xccc09a, shape: 'rect' },
  { id: '10#', x:  3.5, z: -1.8, w: 0.6, d: 1.0, floors: 7,  color: 0xd0bc94, shape: 'rect' },

  { id: '11#', x: -3.5, z:  1.8, w: 0.6, d: 1.0, floors: 9,  color: 0xd4b896, shape: 'rect' },
  { id: '12#', x: -1.8, z:  1.8, w: 0.6, d: 1.0, floors: 11, color: 0xc9b896, shape: 'rect' },
  { id: '13#', x:  0.0, z:  1.8, w: 0.6, d: 1.0, floors: 8,  color: 0xd4c4a0, shape: 'rect' },
  { id: '14#', x:  1.8, z:  1.8, w: 0.6, d: 1.0, floors: 7,  color: 0xccc09a, shape: 'rect' },
  { id: '15#', x:  3.5, z:  1.8, w: 0.6, d: 1.0, floors: 10, color: 0xd0bc94, shape: 'rect' },

  { id: '16#', x:  0.0, z:  5.5, w: 1.2, d: 1.2, floors: 17, color: 0xd4c4a0, shape: 'rect' },
]

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

function selectBuilding(index) {
  selectedIndex.value = index
  overlayGroup.clear()
  wireframeGroup.clear()

  if (index < 0 || index >= buildingsConfig.length) return

  const grayMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthTest: true, depthWrite: false })
  const grayOverlay = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthTest: true, depthWrite: false })

  buildingsConfig.forEach((b, i) => {
    if (i === index) return
    const h = b.floors * FLOOR_HEIGHT
    const geo = new THREE.BoxGeometry(b.w + 0.05, h + 0.05, b.d + 0.05)
    geo.translate(b.x, h / 2, b.z)
    const mesh = new THREE.Mesh(geo, grayMat)
    mesh.renderOrder = 1
    mesh.material.depthTest = true
    mesh.material.depthWrite = false
    overlayGroup.add(mesh)
  })

  const sel = buildingsConfig[index]
  const sh = sel.floors * FLOOR_HEIGHT
  const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(sel.w + 0.08, sh + 0.08, sel.d + 0.08))
  edgeGeo.translate(sel.x, sh / 2, sel.z)
  const edgeLine = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0xff6600, linewidth: 2, depthTest: true }))
  wireframeGroup.add(edgeLine)

  const fillGeo = new THREE.BoxGeometry(sel.w + 0.04, sh + 0.04, sel.d + 0.04)
  fillGeo.translate(sel.x, sh / 2, sel.z)
  const fillMesh = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.15, depthTest: true, depthWrite: false }))
  fillMesh.renderOrder = 1
  wireframeGroup.add(fillMesh)
}

function clearSelection() {
  selectedIndex.value = -1
  overlayGroup.clear()
  wireframeGroup.clear()
}

function onCanvasClick(event) {
  if (!renderer || !camera) return

  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(clickTargets)
  if (intersects.length > 0) {
    const idx = clickTargets.indexOf(intersects[0].object)
    if (idx >= 0) selectBuilding(idx)
  } else {
    clearSelection()
  }
}

function createBuildingsMerged(config) {
  const bodyGroups = {}
  const windowGeos = []
  const windowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0x222222, emissiveIntensity: 0.1 })

  config.forEach(b => {
    const h = b.floors * FLOOR_HEIGHT
    const key = '0x' + b.color.toString(16).padStart(6, '0')
    if (!bodyGroups[key]) {
      bodyGroups[key] = { geos: [], mat: new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.6, metalness: 0.1 }) }
    }

    const bodyGeo = new THREE.BoxGeometry(b.w, h, b.d)
    bodyGeo.translate(b.x, h / 2, b.z)
    bodyGroups[key].geos.push(bodyGeo)

    const winFloors = Math.max(1, Math.floor((h - 0.3) / 0.35))
    for (let f = 0; f < winFloors; f++) {
      const wy = 0.45 + f * 0.35

      const winGeoF = new THREE.PlaneGeometry(b.w * 0.5, 0.15)
      winGeoF.translate(b.x, wy, b.z + b.d / 2 + 0.01)
      windowGeos.push(winGeoF)

      const winGeoB = new THREE.PlaneGeometry(b.w * 0.5, 0.15)
      winGeoB.rotateY(Math.PI)
      winGeoB.translate(b.x, wy, b.z - b.d / 2 - 0.01)
      windowGeos.push(winGeoB)

      const winGeoR = new THREE.PlaneGeometry(b.d * 0.5, 0.15)
      winGeoR.rotateY(Math.PI / 2)
      winGeoR.translate(b.x + b.w / 2 + 0.01, wy, b.z)
      windowGeos.push(winGeoR)

      const winGeoL = new THREE.PlaneGeometry(b.d * 0.5, 0.15)
      winGeoL.rotateY(-Math.PI / 2)
      winGeoL.translate(b.x - b.w / 2 - 0.01, wy, b.z)
      windowGeos.push(winGeoL)
    }
  })

  const buildingGroup = new THREE.Group()

  for (const [color, group] of Object.entries(bodyGroups)) {
    const mergedGeo = mergeGeometries(group.geos)
    const mesh = new THREE.Mesh(mergedGeo, group.mat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    buildingGroup.add(mesh)
  }

  if (windowGeos.length > 0) {
    const winMerged = mergeGeometries(windowGeos)
    const winMesh = new THREE.Mesh(winMerged, windowMat)
    buildingGroup.add(winMesh)
  }

  return buildingGroup
}

function createLabels(config) {
  const group = new THREE.Group()

  config.forEach(b => {
    const h = b.floors * FLOOR_HEIGHT
    const div = document.createElement('div')
    div.className = 'building-label'
    div.textContent = b.id + ' ' + b.floors + 'F'

    const label = new CSS2DObject(div)
    label.position.set(b.x, h + 0.3, b.z)
    group.add(label)
  })

  return group
}

function createMapGround() {
  const group = new THREE.Group()

  const groundGeo = new THREE.PlaneGeometry(16, 14)
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d4, roughness: 0.9 })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.05
  ground.receiveShadow = true
  group.add(ground)

  const greenGeo = new THREE.PlaneGeometry(15, 13)
  const greenMat = new THREE.MeshStandardMaterial({ color: 0xc8d8b0, roughness: 0.95 })
  const green = new THREE.Mesh(greenGeo, greenMat)
  green.rotation.x = -Math.PI / 2
  green.position.y = 0
  green.receiveShadow = true
  group.add(green)

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.8 })
  const roadGeos = [
    { geo: new THREE.PlaneGeometry(14.5, 0.6), pos: [0, -3.5] },
    { geo: new THREE.PlaneGeometry(14.5, 0.6), pos: [0, 3.5] },
    { geo: new THREE.PlaneGeometry(14.5, 0.6), pos: [0, 0] },
    { geo: new THREE.PlaneGeometry(0.6, 13), pos: [-5, 0] },
    { geo: new THREE.PlaneGeometry(0.6, 13), pos: [5, 0] },
  ]
  roadGeos.forEach(r => {
    r.geo.rotateX(-Math.PI / 2)
    r.geo.translate(r.pos[0], 0.01, r.pos[1])
  })
  const roadMerged = mergeGeometries(roadGeos.map(r => r.geo))
  const roadMesh = new THREE.Mesh(roadMerged, roadMat)
  roadMesh.receiveShadow = true
  group.add(roadMesh)

  const borderLine = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(16, 14)),
    new THREE.LineBasicMaterial({ color: 0x666666 })
  )
  borderLine.rotation.x = -Math.PI / 2
  borderLine.position.y = 0.02
  group.add(borderLine)

  return group
}

onMounted(() => {
  const container = canvasContainer.value
  canvasEl = container
  const lblContainer = labelContainer.value
  const w = window.innerWidth
  const h = window.innerHeight

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf5f5f5)

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500)
  camera.position.set(17.38, 18.58, 22.1)

  renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  container.appendChild(renderer.domElement)

  labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(w, h)
  labelRenderer.domElement.style.position = 'absolute'
  labelRenderer.domElement.style.top = '0'
  labelRenderer.domElement.style.left = '0'
  labelRenderer.domElement.style.pointerEvents = 'none'
  lblContainer.appendChild(labelRenderer.domElement)

  window.scene = scene
  window.renderer = renderer
  window.camera = camera

  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()
  overlayGroup = new THREE.Group()
  wireframeGroup = new THREE.Group()
  scene.add(overlayGroup)
  scene.add(wireframeGroup)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.1
  controls.minDistance = 5
  controls.maxDistance = 80
  controls.target.set(0, 0, 0)
  controls.update()

  scene.add(new THREE.AmbientLight(0xffffff, 0.35))

  sunLight = new THREE.DirectionalLight(0xffffff, 3.5)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.width = 2048
  sunLight.shadow.mapSize.height = 2048
  sunLight.shadow.camera.near = 0.5
  sunLight.shadow.camera.far = 100
  sunLight.shadow.camera.left = -20
  sunLight.shadow.camera.right = 20
  sunLight.shadow.camera.top = 20
  sunLight.shadow.camera.bottom = -20
  sunLight.shadow.bias = -0.0003
  sunLight.shadow.normalBias = 0.02
  scene.add(sunLight)
  scene.add(sunLight.target)
  sunLight.target.position.set(0, 0, 0)

  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.4)
  scene.add(hemiLight)

  const mapGround = createMapGround()
  scene.add(mapGround)

  const buildingGroup = createBuildingsMerged(buildingsConfig)
  scene.add(buildingGroup)

  buildingsConfig.forEach(b => {
    const h = b.floors * FLOOR_HEIGHT
    const clickGeo = new THREE.BoxGeometry(b.w, h, b.d)
    const clickMesh = new THREE.Mesh(clickGeo, new THREE.MeshBasicMaterial({ visible: false }))
    clickMesh.position.set(b.x, h / 2, b.z)
    clickTargets.push(clickMesh)
    scene.add(clickMesh)
  })

  const labelGroup = createLabels(buildingsConfig)
  scene.add(labelGroup)

  container.addEventListener('click', onCanvasClick)

  updateSunLight()

  function animate() {
    animationId = requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
    labelRenderer.render(scene, camera)

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
  labelRenderer.setSize(w, h)
}

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', onResize)
  canvasEl?.removeEventListener('click', onCanvasClick)
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

.label-container {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
}

:deep(.building-label) {
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: #333;
  background: rgba(255,255,255,0.85);
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  pointer-events: none;
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
