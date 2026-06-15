<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useProductsStore } from '@/stores/products'
import { useRouter } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import PullToRefresh from '@/components/PullToRefresh.vue'
import { supabase } from '@/lib/supabase'

const auth = useAuthStore()
const productsStore = useProductsStore()
const router = useRouter()

import { formatRp } from '@/utils/format'

const handleRefresh = async () => {
  if (auth.user?.id) {
    const { data: sessionData } = await supabase.auth.getSession()
    await Promise.all([
      auth.fetchProfile(auth.user.id, sessionData.session?.access_token),
      productsStore.fetchProducts()
    ])
  } else {
    await productsStore.fetchProducts()
  }
}

onMounted(() => {
  productsStore.fetchProducts()
  if (auth.user?.id) {
    supabase.auth.getSession().then(({ data }) => {
      auth.fetchProfile(auth.user.id, data.session?.access_token)
    })
  }
})

const categories = [
  {
    name: 'Pulsa',
    path: '/category/pulsa',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`,
    color: 'bg-blue-100 text-blue-600'
  },
  {
    name: 'Token PLN',
    path: '/category/pln',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
    color: 'bg-yellow-100 text-yellow-600'
  },
  {
    name: 'E-Wallet',
    path: '/ewallet',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>`,
    color: 'bg-green-100 text-green-600'
  },
  {
    name: 'Data',
    path: '/category/data',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    color: 'bg-purple-100 text-purple-600'
  },
  {
    name: 'Telpon & SMS',
    path: '/category/telpon',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
    color: 'bg-rose-100 text-rose-600'
  },
  {
    name: 'PPOB',
    path: '/ppob',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path></svg>`,
    color: 'bg-orange-100 text-orange-600'
  }
]
</script>

<template>
  <PullToRefresh :onRefresh="handleRefresh">
    <div class="min-h-screen bg-neutral-50 pb-24">
      <!-- Header -->
      <div class="bg-primary-600 text-white p-4 pt-5 rounded-b-[2rem] shadow-md">
      <div class="flex justify-between items-center mb-4">
        <div>
          <h2 class="text-sm opacity-80">Selamat datang,</h2>
          <h1 class="text-xl font-bold">{{ auth.userProfile?.nama_toko || auth.user?.email }}</h1>
        </div>
        <!-- Removed logout button here as per user request -->
      </div>
      
      <div class="p-3.5 rounded-xl saldo-card mx-1">
        <p class="text-[13px] opacity-90 mb-0.5 font-bold">Saldo Deposit</p>
        <p class="text-3xl font-extrabold tracking-tight">{{ formatRp(auth.userProfile?.saldo || 0) }}</p>
      </div>
    </div>

    <!-- Main Content -->
    <div class="px-5 mt-5">
      <h3 class="font-bold text-lg text-neutral-800 mb-3">Layanan Kami</h3>
      
      <div class="grid grid-cols-3 gap-y-4 gap-x-2 justify-items-center">
        <div 
          v-for="cat in categories" 
          :key="cat.name"
          @click="router.push(cat.path)"
          class="flex flex-col items-center w-full cursor-pointer active:scale-95 transition-transform"
        >
          <div :class="['w-[72px] h-[72px] rounded-2xl flex items-center justify-center mb-2 shadow-sm', cat.color]">
            <div v-html="cat.icon"></div>
          </div>
          <span class="text-[13px] font-semibold text-neutral-700 text-center">{{ cat.name }}</span>
        </div>
      </div>
      
    </div>
    
    <BottomNav />
  </div>
  </PullToRefresh>
</template>

<style scoped>
.pb-safe { padding-bottom: env(safe-area-inset-bottom, 16px); }
</style>
