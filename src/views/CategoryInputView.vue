<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProductsStore } from '@/stores/products'
import { supabase } from '@/lib/supabase'

const route = useRoute()
const router = useRouter()
const productsStore = useProductsStore()

const showAlert = (msg: string) => window.alert(msg)

const categoryParam = route.params.type as string
const customerNo = ref('')
const plnName = ref('')
const plnLoading = ref(false)

const formatRp = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

const pageTitle = computed(() => {
  if (categoryParam === 'pulsa') return 'Isi Pulsa'
  if (categoryParam === 'data') return 'Paket Data'
  if (categoryParam === 'telpon') return 'Telpon & SMS'
  if (categoryParam === 'pln') return 'Token PLN'
  return 'Transaksi'
})

onMounted(() => {
  if (productsStore.products.length === 0) {
    productsStore.fetchProducts()
  }
})

// Provider prefix detection
const getProvider = (phone: string) => {
  if (!phone || phone.length < 4) return ''
  const prefix = phone.substring(0, 4)
  
  // Telkomsel
  if (['0811','0812','0813','0821','0822','0852','0853','0851'].includes(prefix)) return 'Telkomsel'
  // Indosat
  if (['0814','0815','0816','0855','0856','0857','0858'].includes(prefix)) return 'Indosat'
  // XL
  if (['0817','0818','0819','0859','0877','0878'].includes(prefix)) return 'XL'
  // Axis
  if (['0838','0831','0832','0833'].includes(prefix)) return 'Axis'
  // Tri
  if (['0895','0896','0897','0898','0899'].includes(prefix)) return 'Tri'
  // Smartfren
  if (['0881','0882','0883','0884','0885','0886','0887','0888','0889'].includes(prefix)) return 'Smartfren'
  
  return ''
}

const detectedProvider = computed(() => {
  if (categoryParam === 'pln') return 'PLN'
  return getProvider(customerNo.value)
})

const filteredProducts = computed(() => {
  if (categoryParam === 'pln' && customerNo.value.length < 10) return []
  if (categoryParam !== 'pln' && !detectedProvider.value) return []

  let result = productsStore.products.filter(p => {
    // 1. Filter by category
    let matchesCategory = false
    const catLower = p.category.toLowerCase()
    
    if (categoryParam === 'pulsa') matchesCategory = catLower.includes('pulsa')
    else if (categoryParam === 'data') matchesCategory = catLower.includes('data') || catLower.includes('internet')
    else if (categoryParam === 'telpon') matchesCategory = catLower.includes('telpon') || catLower.includes('sms')
    else if (categoryParam === 'pln') matchesCategory = catLower.includes('pln')

    if (!matchesCategory) return false

    // 2. Filter by brand/provider
    if (categoryParam === 'pln') return true
    return p.brand.toLowerCase() === detectedProvider.value.toLowerCase()
  })

  // Sort by price
  result.sort((a, b) => (a.harga_jual || 0) - (b.harga_jual || 0))
  return result
})

const checkPLN = async () => {
  if (categoryParam !== 'pln' || customerNo.value.length < 10) return
  plnLoading.value = true
  plnName.value = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_NEXTJS_API_URL}/api/mobile/transaction/inquiry-pln`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`
      },
      // Using a dummy SKU for inquiry just to get the name
      body: JSON.stringify({ customer_no: customerNo.value, sku_code: 'pln20' })
    })
    const data = await res.json()
    if (data.success && data.data?.name) {
      plnName.value = data.data.name
    }
  } catch (e) {
    console.error(e)
  } finally {
    plnLoading.value = false
  }
}

const selectProduct = (sku: string) => {
  // Store customerNo in sessionStorage or pass via query params
  router.push(`/transaction/${sku}?phone=${customerNo.value}`)
}

</script>

<template>
  <div class="min-h-screen bg-neutral-50 pb-24">
    <!-- Header -->
    <div class="bg-primary-600 text-white p-4 flex items-center gap-4 shadow-sm sticky top-0 z-10">
      <button @click="router.push('/')" class="p-2 -ml-2 rounded-full hover:bg-white/20 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <h1 class="text-lg font-bold">{{ pageTitle }}</h1>
    </div>

    <div class="p-4 space-y-4">
      <!-- Input Section -->
      <div class="card p-5 bg-white rounded-2xl shadow-sm">
        <label class="block text-sm font-bold text-neutral-700 mb-2">
          {{ categoryParam === 'pln' ? 'Nomor Meter / ID Pelanggan' : 'Nomor Handphone' }}
        </label>
        
        <input 
          v-model="customerNo" 
          type="text" 
          inputmode="numeric"
          class="input-field text-xl font-bold tracking-wider py-4 w-full bg-neutral-50 focus:bg-white" 
          :placeholder="categoryParam === 'pln' ? '5123xxxxxxx' : '0812xxxxxxx'" 
          @input="categoryParam === 'pln' && customerNo.length >= 11 && checkPLN()"
        />

        <!-- Validation PLN -->
        <div v-if="categoryParam === 'pln' && (plnLoading || plnName)" class="mt-3">
          <p v-if="plnLoading" class="text-xs text-primary-600 animate-pulse font-medium">Mengecek ID Pelanggan...</p>
          <div v-else-if="plnName" class="p-2.5 bg-green-50 border border-green-100 rounded-lg flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-600"><path d="M20 6 9 17l-5-5"/></svg>
            <div>
              <p class="text-[10px] text-green-600 font-semibold leading-none">Pemilik Rekening</p>
              <p class="font-bold text-green-800 text-sm mt-0.5">{{ plnName }}</p>
            </div>
          </div>
        </div>

        <!-- 3 Icons (Mic, Barcode, Contacts) -->
        <div class="flex items-center gap-3 mt-4 pt-4 border-t border-neutral-100">
          <button @click="showAlert('Mic / Speech to Text segera hadir')" class="flex-1 flex flex-col items-center gap-1 p-2 bg-neutral-50 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-colors text-neutral-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>
            <span class="text-[10px] font-bold">Suara</span>
          </button>
          
          <button @click="showAlert('Barcode Scanner segera hadir')" class="flex-1 flex flex-col items-center gap-1 p-2 bg-neutral-50 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-colors text-neutral-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><line x1="7" y1="8" x2="7" y2="16"></line><line x1="12" y1="8" x2="12" y2="16"></line><line x1="17" y1="8" x2="17" y2="16"></line></svg>
            <span class="text-[10px] font-bold">Scan</span>
          </button>
          
          <button @click="showAlert('Ambil dari Kontak segera hadir')" class="flex-1 flex flex-col items-center gap-1 p-2 bg-neutral-50 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-colors text-neutral-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            <span class="text-[10px] font-bold">Kontak</span>
          </button>
        </div>
      </div>

      <!-- Provider Logo detected -->
      <div v-if="detectedProvider && categoryParam !== 'pln'" class="flex items-center gap-2 mb-2 px-2">
        <span class="text-xs font-bold text-neutral-500 uppercase tracking-wider">Provider Terdeteksi:</span>
        <span class="text-sm font-extrabold text-primary-600">{{ detectedProvider }}</span>
      </div>

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
      <div v-else-if="customerNo.length > 3" class="text-center py-10 text-neutral-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-3 opacity-20"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <p class="text-sm font-medium">Produk tidak ditemukan</p>
      </div>

    </div>
  </div>
</template>
