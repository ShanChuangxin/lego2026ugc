import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home/index.vue'
import Check from '../views/Check/index.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'index',
      component: Home
    },
    {
      path: '/index',
      name: 'index',
      component: Home
    },
    {
      path: '/check',
      name: 'check',
      component: Check
    }
  ]
})

export default router
