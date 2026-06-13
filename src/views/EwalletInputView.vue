<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProductsStore } from '@/stores/products'
import { supabase } from '@/lib/supabase'

const route = useRoute()
const router = useRouter()
const productsStore = useProductsStore()

const showAlert = (msg: string) => window.alert(msg)

const walletId = route.params.id as string
const customerNo = ref('')
const showCheckButton = ref(false)
const ewalletName = ref('')
const isChecking = ref(false)
let checkTimeout: any = null

const selectedProvider = computed(() => {
  return walletId.toUpperCase()
})

watch(customerNo, (newVal) => {
  ewalletName.value = ''
  showCheckButton.value = false
  clearTimeout(checkTimeout)

  if (newVal.length >= 10) {
    checkTimeout = setTimeout(() => {
      showCheckButton.value = true
    }, 1000)
  }
})

const checkEwallet = async () => {
  if (!customerNo.value) return
  
  // Cari SKU khusus untuk cek nama di dalam daftar produk (biasanya mengandung kata 'cek')
  const checkProduct = filteredProducts.value.find(p => p.product_name.toLowerCase().includes('cek'))
  const skuToSend = checkProduct ? checkProduct.sku_code : null
  
  isChecking.value = true
  ewalletName.value = ''
  
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/inquiry-ewallet`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({ 
        customer_no: customerNo.value, 
        provider: selectedProvider.value,
        sku_code: skuToSend 
      })
    })
    
    const data = await response.json()
    if (data.success) {
      ewalletName.value = data.name
      showCheckButton.value = false
    } else {
      window.alert(data.message || 'Gagal mengecek nama e-wallet')
    }
  } catch (error) {
    console.error(error)
    window.alert('Terjadi kesalahan koneksi saat mengecek nama')
  } finally {
    isChecking.value = false
  }
}

const formatRp = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

const pageTitle = computed(() => {
  return walletId.charAt(0).toUpperCase() + walletId.slice(1)
})

const walletInfo = computed(() => {
  const mapping: Record<string, any> = {
    dana: { name: 'DANA', icon: 'bg-blue-500 text-white', letter: 'D' },
    ovo: { name: 'OVO', icon: 'bg-purple-600 text-white', letter: 'O' },
    gopay: { name: 'GoPay', icon: 'bg-blue-400 text-white', letter: 'G' },
    shopeepay: { name: 'ShopeePay', icon: 'bg-orange-500 text-white', letter: 'S' },
    linkaja: { name: 'LinkAja', icon: 'bg-red-600 text-white', letter: 'L' }
  }
  return mapping[walletId.toLowerCase()] || { name: pageTitle.value, icon: 'bg-neutral-500 text-white', letter: walletId.charAt(0).toUpperCase() }
})

onMounted(() => {
  if (productsStore.products.length === 0) {
    productsStore.fetchProducts()
  }
  
  if (route.query.phone) {
    customerNo.value = route.query.phone as string
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
  if (!customerNo.value) {
    showAlert('Silakan isi Nomor Handphone terlebih dahulu!')
    return
  }
  let url = `/transaction/${sku}?phone=${customerNo.value}`
  if (ewalletName.value) {
    url += `&name=${encodeURIComponent(ewalletName.value)}`
  }
  router.push(url)
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50 pb-24">
    <!-- Header -->
    <div class="bg-primary-600 text-white py-1.5 px-2 flex items-center gap-1.5 shadow-sm sticky top-0 z-10">
      <button @click="router.back()" class="p-1 -ml-1 rounded-full hover:bg-white/20 transition-colors">
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
        <div class="mb-4">
          <label class="block text-sm font-bold text-neutral-800 mb-2">Nomor Tujuan / HP</label>
          <div class="relative flex items-center">
            <input 
              v-model="customerNo"
              type="tel" 
              pattern="[0-9]*"
              inputmode="numeric"
              class="w-full text-lg font-bold text-neutral-800 border-2 border-neutral-200 rounded-xl px-4 py-3 focus:border-primary-500 focus:ring-0 transition-colors pr-24"
              placeholder="Contoh: 08123456789"
            />
            
            <button 
              v-if="customerNo && !showCheckButton"
              @click="customerNo = ''"
              class="absolute right-4 p-1 text-neutral-400 hover:text-neutral-600 bg-neutral-100 rounded-full"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            <!-- Tombol Cek Nama -->
            <button 
              v-if="showCheckButton"
              @click="checkEwallet"
              :disabled="isChecking"
              class="absolute right-2 px-3 py-1.5 bg-primary-100 text-primary-700 font-bold text-xs rounded-lg border border-primary-200 hover:bg-primary-200 active:bg-primary-300 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <span v-if="isChecking" class="w-3 h-3 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></span>
              {{ isChecking ? 'Cek...' : 'Cek Nama' }}
            </button>
          </div>
          
          <!-- Hasil Cek Nama (Lebih Ringkas) -->
          <div v-if="ewalletName" class="mt-2 text-sm font-bold text-green-600 animate-in fade-in flex items-center gap-1.5 px-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <span class="uppercase">{{ ewalletName }}</span>
          </div>
        </div>

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

          <button @click="router.push(`/favorites/ewallet`)" class="flex-1 flex flex-col items-center gap-0.5 p-1 bg-neutral-50 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-colors text-neutral-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <span class="text-[9px] font-bold">Favorit</span>
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
