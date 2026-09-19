<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProductsStore } from '@/stores/products'

const router = useRouter()
const productsStore = useProductsStore()

const imageError = ref<Record<string, boolean>>({})

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
  const ewalletProducts = productsStore.products.filter(p => {
    const catLower = p.category?.toLowerCase() || ''
    const brandLower = p.brand?.toLowerCase() || ''
    return catLower.includes('e-money') || 
           catLower.includes('wallet') || 
           brandLower.includes('dana') || 
           brandLower.includes('ovo') || 
           brandLower.includes('gopay') || 
           brandLower.includes('go pay') ||
           brandLower.includes('shopee') ||
           brandLower.includes('linkaja')
  })
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
    <div class="bg-primary-600 text-white p-4 flex items-center  shadow-sm sticky top-0 z-10 justify-between">
      <div class="flex items-center gap-4">
        <button @click="router.back()" class="p-2 -ml-2 rounded-full hover:bg-white/20 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 class="text-xl font-bold">Pilih E-Wallet</h1>
      </div>
      <button @click="router.replace('/')" class="p-2 -mr-2 rounded-full hover:bg-white/20 transition-colors" title="Ke Beranda">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </button>
    </div>

    <div class="p-4">
      <div v-if="productsStore.loading && wallets.length === 0" class="flex justify-center p-8">
        <div class="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
      <div v-else class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
        <button 
          v-for="w in wallets" 
          :key="w.id"
          @click="router.push(`/ewallet/${w.id}`)"
          class="relative aspect-square w-full rounded-2xl shadow-sm border border-neutral-100 hover:border-primary-300 transition-all active:scale-95 overflow-hidden bg-white"
        >
          <img 
            v-show="!imageError[w.id]" 
            :src="`/icons/${w.id}.png`" 
            class="w-full h-full object-cover" 
            @error="imageError[w.id] = true" 
            :alt="w.name" 
          />
          <div 
            v-show="imageError[w.id]" 
            :class="['w-full h-full flex items-center justify-center font-extrabold text-2xl sm:text-3xl', w.icon]"
          >
            {{ w.letter }}
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
