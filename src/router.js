import { createWebHashHistory, createRouter } from 'vue-router'

import HomeView from './Home.vue'
import MyView from './My.vue'
import FxView from './Fx.vue'

const routes = [
  { path: '/', component: HomeView },
  { path: '/fx', component: FxView },
  { path: '/my', component: MyView },
  {
    path: '/list',
    name: 'List',
    // 懒加载组件
    component: () => import('./List.vue'),
  },
  {
    path: '/play',
    name: 'Play',
    // 懒加载组件
    component: () => import('./Play.vue'),
  },
]

const router = createRouter({
  // history: createMemoryHistory(),
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})

export default router;