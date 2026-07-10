<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProductsStore } from '@/stores/products'

const router = useRouter()
const productsStore = useProductsStore()

onMounted(() => {
  if (productsStore.products.length === 0) {
    productsStore.fetchProducts()
  }
})

const colorMap: Record<string, string> = {
  'dana': 'bg-blue-500',
  'go pay': 'bg-green-500',
  'gopay': 'bg-green-500',
  'ovo': 'bg-purple-600',
  'shopee pay': 'bg-orange-500',
  'shopeepay': 'bg-orange-500',
  'linkaja': 'bg-red-600',
  'maxim': 'bg-yellow-500',
  'grab': 'bg-emerald-600',
  'isaku': 'bg-blue-600',
  'brizi': 'bg-blue-700',
  'tapcash': 'bg-orange-600'
}

const wallets = computed(() => {
  const ewalletProducts = productsStore.products.filter(p => p.category?.toLowerCase() === 'e-money')
  const brands = [...new Set(ewalletProducts.map(p => p.brand))]
  
  return brands.map(brand => {
    const brandLower = brand.toLowerCase()
    const color = colorMap[brandLower] || 'bg-slate-500'
    return {
      id: brandLower.replace(/\s+/g, ''),
      name: brand,
      icon: `${color} text-white`,
      letter: brand.charAt(0).toUpperCase()
    }
  }).sort((a, b) => a.name.localeCompare(b.name))
})
</script>

<template>
  <div class="min-h-screen bg-neutral-50 pb-24">
    <!-- Header -->
    <div class="bg-primary-600 text-white p-4 flex items-center gap-4 shadow-sm sticky top-0 z-10">
      <button @click="router.back()" class="p-2 -ml-2 rounded-full hover:bg-white/20 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <h1 class="text-xl font-bold">Pilih E-Wallet</h1>
    </div>

    <div class="p-4">
      <div v-if="productsStore.loading && wallets.length === 0" class="flex justify-center p-8">
        <div class="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
      <div v-else class="grid grid-cols-3 gap-4">
        <button 
          v-for="w in wallets" 
          :key="w.id"
          @click="router.push(`/ewallet/${w.id}`)"
          class="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-neutral-100 hover:border-primary-300 transition-colors active:scale-95"
        >
          <div :class="['w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-xl mb-3 shadow-sm', w.icon]">
            {{ w.letter }}
          </div>
          <span class="text-xs font-bold text-neutral-700 text-center leading-tight">{{ w.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
