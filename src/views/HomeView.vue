<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useProductsStore } from '@/stores/products'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const productsStore = useProductsStore()
const router = useRouter()

const formatRp = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

const activeTab = ref('Pulsa')
const tabs = ['Pulsa', 'Data', 'PLN', 'E-Wallet']
const searchQuery = ref('')

const filteredProducts = computed(() => {
  let result = productsStore.products.filter(p => {
    // Check search query first if it exists
    if (searchQuery.value) {
      return p.product_name.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
             p.brand.toLowerCase().includes(searchQuery.value.toLowerCase())
    }

    // Otherwise use tab filters
    if (activeTab.value === 'Pulsa') return p.category.toLowerCase().includes('pulsa')
    if (activeTab.value === 'Data') return p.category.toLowerCase().includes('data') || p.category.toLowerCase().includes('internet')
    if (activeTab.value === 'PLN') return p.category.toLowerCase().includes('pln')
    if (activeTab.value === 'E-Wallet') return p.category.toLowerCase().includes('wallet') || p.category.toLowerCase().includes('dana') || p.category.toLowerCase().includes('ovo') || p.category.toLowerCase().includes('gopay')
    return p.category === activeTab.value
  })

  // Sort by brand then by harga_jual (cheapest first)
  result.sort((a, b) => {
    if (a.brand < b.brand) return -1
    if (a.brand > b.brand) return 1
    return (a.harga_jual || 0) - (b.harga_jual || 0)
  })

  return result
})

onMounted(() => {
  productsStore.fetchProducts()
})

const doLogout = () => {
  auth.signOut()
  router.push('/login')
}
</script>

<template>
  <div class="pb-24">
    <!-- Header -->
    <div class="bg-primary-600 text-white p-6 rounded-b-3xl shadow-md">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-sm opacity-80">Selamat datang,</h2>
          <h1 class="text-xl font-bold">{{ auth.userProfile?.nama_toko || auth.user?.email }}</h1>
        </div>
        <button @click="doLogout" class="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        </button>
      </div>
      
      <div class="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/20">
        <p class="text-sm opacity-90 mb-1">Saldo Deposit</p>
        <p class="text-3xl font-extrabold tracking-tight">{{ formatRp(auth.userProfile?.saldo || 0) }}</p>
      </div>
    </div>

    <!-- Main Content -->
    <div class="px-4 -mt-4">
      <div class="card p-2 shadow-lg mb-6 flex justify-around items-center overflow-x-auto no-scrollbar gap-2">
        <button v-for="tab in tabs" :key="tab" 
          @click="activeTab = tab"
          class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
          :class="activeTab === tab ? 'bg-primary-100 text-primary-700' : 'text-neutral-500 hover:bg-neutral-100'">
          {{ tab }}
        </button>
      </div>

      <div class="flex flex-col gap-3 mb-4">
        <h3 class="font-bold text-lg text-neutral-800">Katalog Produk</h3>
        <div class="relative flex items-center gap-2">
          <input 
            v-model="searchQuery" 
            type="text" 
            class="input-field py-2.5 text-sm flex-1" 
            placeholder="Cari produk..." 
          />
          <button @click="alert('Fitur Voice Search (Speech to Text) akan segera hadir!')" class="p-2.5 bg-neutral-100 text-primary-600 rounded-xl hover:bg-neutral-200 transition-colors border border-neutral-200" title="Voice Search">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>
          </button>
        </div>
      </div>

      <div v-if="productsStore.loading" class="text-center py-8">
        <div class="animate-spin inline-block w-8 h-8 border-[3px] border-current border-t-transparent text-primary-600 rounded-full" role="status" aria-label="loading"></div>
      </div>
      
      <div v-else-if="filteredProducts.length === 0" class="text-center py-8 text-neutral-400">
        Produk tidak ditemukan
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div v-for="product in filteredProducts" :key="product.sku_code" 
          @click="router.push(`/transaction/${product.sku_code}`)"
          class="card p-4 flex items-center justify-between cursor-pointer hover:border-primary-300 hover:shadow-md transition-all active:scale-[0.98]">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold">
              {{ product.brand.substring(0, 1) }}
            </div>
            <div>
              <h4 class="font-bold text-neutral-800">{{ product.product_name }}</h4>
              <p class="text-xs text-neutral-500">{{ product.brand }}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="font-bold text-primary-600">{{ formatRp(product.harga_jual) }}</p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Floating Nav -->
    <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-2 px-6 flex justify-between items-center pb-safe">
      <button class="flex flex-col items-center text-primary-600 p-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        <span class="text-[10px] font-bold mt-1">Home</span>
      </button>
      <button v-if="auth.userProfile?.role === 'admin' || auth.userProfile?.role === 'superadmin'" @click="router.push('/admin')" class="flex flex-col items-center text-neutral-400 p-2 hover:text-primary-600 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        <span class="text-[10px] font-bold mt-1">Admin</span>
      </button>
      <button @click="router.push('/history')" class="flex flex-col items-center text-neutral-400 p-2 hover:text-primary-600 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        <span class="text-[10px] font-bold mt-1">Riwayat</span>
      </button>
    </div>
  </div>
</template>
<style>
.pb-safe { padding-bottom: env(safe-area-inset-bottom, 16px); }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
