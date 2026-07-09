import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Fullscreen3D from '../views/Fullscreen3D.vue'
import Community3D from '../views/Community3D.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/three-view', name: 'Fullscreen3D', component: Fullscreen3D },
  { path: '/community-three', name: 'Community3D', component: Community3D }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
