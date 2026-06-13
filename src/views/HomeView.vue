<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useProductsStore } from '@/stores/products'
import { useRouter } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import PullToRefresh from '@/components/PullToRefresh.vue'

const auth = useAuthStore()
const productsStore = useProductsStore()
const router = useRouter()

const formatRp = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

const handleRefresh = async () => {
  if (auth.user?.id) {
    await Promise.all([
      auth.fetchProfile(auth.user.id),
      productsStore.fetchProducts()
    ])
  } else {
    await productsStore.fetchProducts()
  }
}

onMounted(() => {
  productsStore.fetchProducts()
})

const categories = [
  {
    name: 'Pulsa',
    path: '/category/pulsa',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`,
    color: 'bg-blue-100 text-blue-600'
  },
  {
    name: 'Token PLN',
    path: '/category/pln',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
    color: 'bg-yellow-100 text-yellow-600'
  },
  {
    name: 'E-Wallet',
    path: '/ewallet',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>`,
    color: 'bg-green-100 text-green-600'
  },
  {
    name: 'Data',
    path: '/category/data',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    color: 'bg-purple-100 text-purple-600'
  },
  {
    name: 'Telpon & SMS',
    path: '/category/telpon',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
    color: 'bg-rose-100 text-rose-600'
  }
]
</script>

<template>
  <PullToRefresh :onRefresh="handleRefresh">
    <div class="min-h-screen bg-neutral-50 pb-24">
      <!-- Header -->
      <div class="bg-primary-600 text-white p-6 rounded-b-3xl shadow-md">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-sm opacity-80">Selamat datang,</h2>
          <h1 class="text-xl font-bold">{{ auth.userProfile?.nama_toko || auth.user?.email }}</h1>
        </div>
        <!-- Removed logout button here as per user request -->
      </div>
      
      <div class="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/20">
        <p class="text-sm opacity-90 mb-1">Saldo Deposit</p>
        <p class="text-3xl font-extrabold tracking-tight">{{ formatRp(auth.userProfile?.saldo || 0) }}</p>
      </div>
    </div>

    <!-- Main Content -->
    <div class="px-4 mt-6">
      <h3 class="font-bold text-lg text-neutral-800 mb-4">Layanan Kami</h3>
      
      <div class="grid grid-cols-4 gap-4">
        <!-- We use col-span-4 grid, but display them properly. The first 4 can be a 2x2 grid, or 5 items can be 3 + 2. Let's use flex or grid-cols-3 -->
      </div>
      
      <div class="flex flex-wrap gap-4 justify-between">
        <div 
          v-for="cat in categories" 
          :key="cat.name"
          @click="router.push(cat.path)"
          class="flex flex-col items-center w-[30%] cursor-pointer active:scale-95 transition-transform"
        >
          <div :class="['w-16 h-16 rounded-2xl flex items-center justify-center mb-2 shadow-sm', cat.color]">
            <div v-html="cat.icon"></div>
          </div>
          <span class="text-xs font-semibold text-neutral-700 text-center">{{ cat.name }}</span>
        </div>
      </div>
      
      <!-- Promo Banner Placeholder -->
      <div class="mt-8 bg-gradient-to-r from-primary-500 to-primary-700 rounded-2xl p-4 text-white shadow-md">
        <h4 class="font-bold mb-1">Promo Hari Ini! 🎉</h4>
        <p class="text-sm opacity-90">Nikmati potongan harga untuk semua produk Telkomsel Data.</p>
      </div>
    </div>
    
    <BottomNav />
  </div>
  </PullToRefresh>
</template>

<style scoped>
.pb-safe { padding-bottom: env(safe-area-inset-bottom, 16px); }
</style>
