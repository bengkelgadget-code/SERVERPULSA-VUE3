import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import LoginView from '@/views/LoginView.vue'
import HomeView from '@/views/HomeView.vue'
import TransactionView from '@/views/TransactionView.vue'
import HistoryView from '@/views/HistoryView.vue'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import AdminDashboard from '@/views/admin/AdminDashboard.vue'
import ProductManager from '@/views/admin/ProductManager.vue'
import UserManager from '@/views/admin/UserManager.vue'
import DepositManager from '@/views/admin/DepositManager.vue'
import AllTransactions from '@/views/admin/AllTransactions.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { requiresGuest: true }
    },
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: true }
    },
    {
      path: '/transaction/:sku',
      name: 'transaction',
      component: TransactionView,
      meta: { requiresAuth: true }
    },
    {
      path: '/history',
      name: 'history',
      component: HistoryView,
      meta: { requiresAuth: true }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/category/:type',
      name: 'category',
      component: () => import('@/views/CategoryInputView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/ewallet',
      name: 'ewallet-menu',
      component: () => import('@/views/EwalletMenuView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/ewallet/:id',
      name: 'ewallet-input',
      component: () => import('@/views/EwalletInputView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/receipt/:id',
      name: 'receipt',
      component: () => import('@/views/ReceiptView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/favorites/:category',
      name: 'favorites',
      component: () => import('@/views/FavoritesView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/admin',
      component: AdminLayout,
      meta: { requiresAuth: true, requiresAdmin: true },
      children: [
        {
          path: '',
          redirect: '/admin/dashboard'
        },
        {
          path: 'dashboard',
          name: 'admin-dashboard',
          component: AdminDashboard
        },
        {
          path: 'products',
          name: 'admin-products',
          component: ProductManager
        },
        {
          path: 'users',
          name: 'admin-users',
          component: UserManager
        },
        {
          path: 'deposits',
          name: 'admin-deposits',
          component: DepositManager
        },
        {
          path: 'transactions',
          name: 'admin-transactions',
          component: AllTransactions
        }
      ]
    }
  ]
})

let isInitialLoad = true

router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore()
  
  if (auth.loading) {
    await auth.initialize()
  }

  // Restore last visited route on initial load if going to root or admin root
  if (isInitialLoad && (to.path === '/' || to.path === '/admin')) {
    isInitialLoad = false
    const lastRoute = localStorage.getItem('lastVisitedAdminRoute')
    if (lastRoute && lastRoute !== '/' && lastRoute !== '/admin') {
      return next(lastRoute)
    }
  }
  isInitialLoad = false
  
  if (to.meta.requiresAuth && !auth.user) {
    next('/login')
  } else if (to.meta.requiresGuest && auth.user) {
    const profile = await auth.ensureProfile()
    const role = profile?.role
    if (role === 'admin' || role === 'superadmin') {
      next('/admin')
    } else {
      next('/')
    }
  } else if (to.path === '/' && auth.user) {
    const profile = await auth.ensureProfile()
    const role = profile?.role
    if (role === 'admin' || role === 'superadmin') {
      next('/admin')
    } else {
      next()
    }
  } else if (to.meta.requiresAdmin) {
    const profile = await auth.ensureProfile()
    const role = profile?.role
    if (role === 'admin' || role === 'superadmin') {
      next()
    } else {
      next('/')
    }
  } else {
    next()
  }
})

router.afterEach((to) => {
  if (to.path.startsWith('/admin')) {
    localStorage.setItem('lastVisitedAdminRoute', to.fullPath)
  }
})

export default router
