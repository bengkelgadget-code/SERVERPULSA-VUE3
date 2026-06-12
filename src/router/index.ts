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

router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore()
  
  if (auth.loading) {
    await auth.initialize()
  }
  
  if (to.meta.requiresAuth && !auth.user) {
    next('/login')
  } else if (to.meta.requiresGuest && auth.user) {
    next('/')
  } else if (to.meta.requiresAdmin) {
    const role = auth.userProfile?.role
    if (role === 'admin' || role === 'superadmin') {
      next()
    } else {
      next('/')
    }
  } else {
    next()
  }
})

export default router
