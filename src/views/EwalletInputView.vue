<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProductsStore } from '@/stores/products'

const route = useRoute()
const router = useRouter()
const productsStore = useProductsStore()

const showAlert = (msg: string) => window.alert(msg)

const walletId = route.params.id as string
const customerNo = ref('')

const formatRp = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

const pageTitle = computed(() => {
  return walletId.charAt(0).toUpperCase() + walletId.slice(1)
})

onMounted(() => {
  if (productsStore.products.length === 0) {
    productsStore.fetchProducts()
  }
})

const filteredProducts = computed(() => {
  let result = productsStore.products.filter(p => {
    const catLower = p.category.toLowerCase()
    const cleanBrand = p.brand.toLowerCase().replace(/\s+/g, '')
    const isEwallet = catLower.includes('e-money') || catLower.includes('wallet') || catLower.includes('dana') || catLower.includes('ovo') || catLower.includes('gopay')
    
    if (!isEwallet) return false
    return cleanBrand.includes(walletId.toLowerCase().replace(/\s+/g, ''))
  })

  result.sort((a, b) => (a.harga_jual || 0) - (b.harga_jual || 0))
  return result
})

const selectProduct = (sku: string) => {
  router.push(`/transaction/${sku}?phone=${customerNo.value}`)
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50 pb-24">
    <!-- Header -->
    <div class="bg-primary-600 text-white py-1.5 px-2 flex items-center gap-1.5 shadow-sm sticky top-0 z-10">
      <button @click="router.push('/ewallet')" class="p-1 -ml-1 rounded-full hover:bg-white/20 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <div class="flex items-center gap-1.5">
        <div :class="['w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold', walletInfo.icon]">
          {{ walletInfo.letter }}
        </div>
        <h1 class="text-sm font-bold">Topup {{ walletInfo.name }}</h1>
      </div>
    </div>

    <div class="p-4 space-y-4">
      <!-- Input Section -->
      <div class="card p-4 bg-white rounded-xl shadow-sm mb-6">
        <label class="block text-sm font-bold text-neutral-700 mb-2">Nomor Tujuan / HP</label>
        <input 
          v-model="customerNo" 
          type="text" 
          inputmode="numeric"
          class="input-field text-xl font-bold tracking-wider py-4 w-full bg-neutral-50 focus:bg-white" 
          placeholder="0812xxxxxxx" 
        />
        
        <!-- 3 Icons (Mic, Barcode, Contacts) -->
        <div class="flex items-center gap-1.5 mt-2 pt-2 border-t border-neutral-100">
          <button @click="showAlert('Mic / Speech to Text segera hadir')" class="flex-1 flex flex-col items-center gap-0.5 p-1 bg-neutral-50 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-colors text-neutral-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>
            <span class="text-[9px] font-bold">Suara</span>
          </button>
          
          <button @click="showAlert('Barcode Scanner segera hadir')" class="flex-1 flex flex-col items-center gap-0.5 p-1 bg-neutral-50 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-colors text-neutral-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><line x1="7" y1="8" x2="7" y2="16"></line><line x1="12" y1="8" x2="12" y2="16"></line><line x1="17" y1="8" x2="17" y2="16"></line></svg>
            <span class="text-[9px] font-bold">Scan</span>
          </button>
          
          <button @click="showAlert('Ambil dari Kontak segera hadir')" class="flex-1 flex flex-col items-center gap-0.5 p-1 bg-neutral-50 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-colors text-neutral-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            <span class="text-[9px] font-bold">Kontak</span>
          </button>
        </div>
      </div>

      <h3 class="font-bold text-neutral-800 mb-2 mt-4 ml-1">Pilih Nominal</h3>

      <!-- Product List -->
      <div v-if="filteredProducts.length > 0" class="space-y-3">
        <div 
          v-for="product in filteredProducts" 
          :key="product.sku_code" 
          @click="selectProduct(product.sku_code)"
          class="card p-4 bg-white rounded-xl shadow-sm flex items-center justify-between cursor-pointer border border-transparent hover:border-primary-300 transition-all active:scale-[0.98]"
        >
          <div>
            <h4 class="font-bold text-neutral-800 text-sm mb-1">{{ product.product_name }}</h4>
            <p class="text-xs text-neutral-500">{{ product.brand }}</p>
          </div>
          <div class="text-right">
            <p class="font-extrabold text-primary-600">{{ formatRp(product.harga_jual) }}</p>
          </div>
        </div>
      </div>
      
      <!-- Placeholder when empty -->
      <div v-else class="text-center py-10 text-neutral-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-3 opacity-20"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <p class="text-sm font-medium">Produk tidak ditemukan</p>
      </div>

    </div>
  </div>
</template>
