<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProductsStore } from '@/stores/products'
import { supabase } from '@/lib/supabase'
import { useContacts } from '@/composables/useContacts'
import { useBarcodeScanner } from '@/composables/useBarcodeScanner'
import { useSpeechToText } from '@/composables/useSpeechToText'

const route = useRoute()
const router = useRouter()
const productsStore = useProductsStore()

const { pickContact: pickNativeContact } = useContacts()
const { scan: scanBarcode, isScanning } = useBarcodeScanner()
const { startListening, isListening } = useSpeechToText()

const showAlert = (msg: string) => window.alert(msg)

const categoryParam = route.params.type as string
const customerNo = ref('')
const plnName = ref('')
const plnLoading = ref(false)
let checkTimeout: any = null

onUnmounted(() => {
  if (checkTimeout) clearTimeout(checkTimeout)
})

import { formatRp } from '@/utils/format'

const pageTitle = computed(() => {
  if (categoryParam === 'pulsa') return 'Isi Pulsa'
  if (categoryParam === 'data') return 'Paket Data'
  if (categoryParam === 'telpon') return 'Telpon & SMS'
  if (categoryParam === 'pln') return 'Token PLN'
  if (categoryParam === 'pdam') return 'Tagihan PDAM'
  if (categoryParam === 'pln_postpaid') return 'Tagihan Listrik'
  if (categoryParam === 'bpjs') return 'Tagihan BPJS'
  if (['indihome', 'firstmedia', 'myrepublic', 'biznet', 'mncplay'].includes(categoryParam)) return 'Tagihan Internet'
  return 'Transaksi'
})

onMounted(() => {
  if (productsStore.products.length === 0) {
    productsStore.fetchProducts()
  }
  
  // Auto-fill from favorites if query param exists
  if (route.query.phone) {
    customerNo.value = route.query.phone as string
    // if pln, we check it
    if (categoryParam === 'pln' && customerNo.value.length >= 11) {
      checkPLN(customerNo.value)
    }
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
  const isPpob = ['pdam', 'pln_postpaid', 'bpjs', 'indihome', 'firstmedia', 'myrepublic', 'biznet', 'mncplay'].includes(categoryParam)

  if (categoryParam !== 'pln' && !isPpob && !detectedProvider.value) return []

  let result = productsStore.products.filter(p => {
    // 1. Filter by category
    let matchesCategory = false
    const catLower = p.category.toLowerCase()
    const bLower = p.brand.toLowerCase()
    const nLower = p.product_name.toLowerCase()
    
    if (categoryParam === 'pulsa') matchesCategory = catLower.includes('pulsa')
    else if (categoryParam === 'data') matchesCategory = catLower.includes('data') && !catLower.includes('pasca')
    else if (categoryParam === 'telpon') matchesCategory = catLower.includes('telpon') || catLower.includes('sms')
    else if (categoryParam === 'pln') matchesCategory = catLower.includes('pln') && !catLower.includes('pasca')
    else if (categoryParam === 'pdam') matchesCategory = bLower.includes('pdam') || catLower.includes('pdam')
    else if (categoryParam === 'pln_postpaid') matchesCategory = catLower.includes('pln') && catLower.includes('pasca')
    else if (categoryParam === 'bpjs') matchesCategory = catLower.includes('bpjs') || bLower.includes('bpjs')
    else if (['indihome', 'firstmedia', 'myrepublic', 'biznet', 'mncplay'].includes(categoryParam)) {
       if (catLower.includes('pasca') && (bLower.includes('internet') || bLower.includes('tv'))) {
          if (categoryParam === 'indihome') matchesCategory = nLower.includes('indihome') || nLower.includes('speedy')
          else if (categoryParam === 'firstmedia') matchesCategory = nLower.includes('first media') || nLower.includes('firstmedia')
          else if (categoryParam === 'myrepublic') matchesCategory = nLower.includes('republic')
          else if (categoryParam === 'biznet') matchesCategory = nLower.includes('biznet')
          else if (categoryParam === 'mncplay') matchesCategory = nLower.includes('mnc')
       }
    }

    if (!matchesCategory) return false

    // 2. Filter by brand/provider
    if (categoryParam === 'pln' || isPpob) return true
    return p.brand.toLowerCase() === detectedProvider.value.toLowerCase()
  })

  // Sort by price
  result.sort((a, b) => (a.harga_jual || 0) - (b.harga_jual || 0))
  return result
})

const checkPLN = async (no: string) => {
  if (categoryParam !== 'pln' || no.length < 11) {
    plnName.value = ''
    return
  }
  
  plnLoading.value = true
  plnName.value = ''
  
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/inquiry-pln`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({ customer_no: no })
    })
    
    const data = await res.json()
    
    if (data.success && data.name) {
      // Format the display name along with segment/power if available
      let displayName = data.name
      if (data.segment_power) displayName += ` / ${data.segment_power}`
      plnName.value = displayName
    } else {
      plnName.value = data.message || 'Nomor Pelanggan Tidak Ditemukan'
    }
  } catch (err) {
    console.error('Error checking PLN:', err)
    plnName.value = 'Gagal mengecek nomor'
  } finally {
    plnLoading.value = false
  }
}

// Watch customerNo for changes
watch(customerNo, (newVal) => {
  if (categoryParam !== 'pln') return
  
  if (newVal.length < 11) {
    plnName.value = ''
    return
  }

  // Debounce the check
  if (checkTimeout) clearTimeout(checkTimeout)
  checkTimeout = setTimeout(() => {
    checkPLN(newVal)
  }, 500)
})

const validatePhone = (phone: string, category: string): string | null => {
  phone = phone.trim().replace(/\D/g, '')
  if (!phone) return 'Silakan isi Nomor Handphone atau ID Pelanggan terlebih dahulu!'
  if (['pulsa', 'data', 'telpon'].includes(category)) {
    if (phone.startsWith('62')) phone = '0' + phone.slice(2)
    if (phone.length < 10 || phone.length > 13) return 'Nomor HP harus 10-13 digit'
    if (!phone.startsWith('08')) return 'Nomor HP harus diawali 08'
  }
  return null
}

const selectProduct = (sku: string) => {
  const phoneErr = validatePhone(customerNo.value, categoryParam)
  if (phoneErr) {
    showAlert(phoneErr)
    return
  }

  // Store customerNo in sessionStorage or pass via query params
  if (categoryParam === 'pln' && plnName.value && !plnName.value.includes('Gagal') && !plnName.value.includes('Tidak Ditemukan')) {
    router.push(`/transaction/${sku}?phone=${customerNo.value}&name=${encodeURIComponent(plnName.value)}`)
  } else {
    router.push(`/transaction/${sku}?phone=${customerNo.value}`)
  }
}

const pickContact = async () => {
  const result = await pickNativeContact()
  if (result) {
    customerNo.value = result
  }
}

const doBarcode = async () => {
  const result = await scanBarcode()
  if (result) {
    customerNo.value = result.replace(/[^0-9]/g, '') // typically numbers only for pln/phone
  }
}

const doSpeech = async () => {
  const result = await startListening()
  if (result) {
    customerNo.value = result
  }
}

</script>

<template>
  <div class="min-h-screen bg-neutral-50 pb-24">
    <!-- Header -->
    <div class="bg-primary-600 text-white py-1.5 px-2 flex items-center gap-1.5 shadow-sm sticky top-0 z-10">
      <button @click="router.back()" class="p-1 -ml-1 rounded-full hover:bg-white/20 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <h1 class="text-lg font-bold">{{ pageTitle }}</h1>
    </div>

    <div class="p-3 space-y-3">
      <!-- Input Section -->
      <div class="card p-3 bg-white rounded-2xl shadow-sm mb-3">
        <label class="block text-[11px] font-bold text-neutral-700 mb-1">
          <span v-if="categoryParam === 'pln'">Nomor Meter / ID Pelanggan</span>
          <span v-else-if="categoryParam === 'pdam'">Nomor Pelanggan PDAM</span>
          <span v-else-if="categoryParam === 'pln_postpaid'">ID Pelanggan Listrik</span>
          <span v-else-if="categoryParam === 'bpjs'">Nomor VA BPJS</span>
          <span v-else-if="['indihome', 'firstmedia', 'myrepublic', 'biznet', 'mncplay'].includes(categoryParam)">Nomor Pelanggan Internet</span>
          <span v-else>Nomor Handphone</span>
        </label>
        
        <div class="relative">
          <input 
            v-model="customerNo" 
            type="text" 
            inputmode="numeric"
            class="input-field text-lg font-bold tracking-wider py-2.5 px-3 w-full bg-neutral-50 rounded-xl border border-neutral-200 focus:bg-white focus:border-primary-500 transition-colors" 
            :placeholder="['pdam', 'pln_postpaid', 'bpjs', 'indihome', 'firstmedia', 'myrepublic', 'biznet', 'mncplay'].includes(categoryParam) ? 'Masukkan ID Pelanggan' : (categoryParam === 'pln' ? '5123xxxxxxx' : '0812xxxxxxx')" 
          />
        </div>

        <!-- Validation PLN -->
        <div v-if="categoryParam === 'pln' && (plnLoading || plnName)" class="mt-3">
          <p v-if="plnLoading" class="text-xs text-primary-600 animate-pulse font-medium">Mengecek ID Pelanggan...</p>
          <div v-else-if="plnName && !plnName.includes('Gagal') && !plnName.includes('Tidak Ditemukan')" class="p-2.5 bg-green-50 border border-green-100 rounded-lg flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-600"><path d="M20 6 9 17l-5-5"/></svg>
            <div>
              <p class="text-[10px] text-green-600 font-semibold leading-none">Pemilik Rekening</p>
              <p class="font-bold text-green-800 text-sm mt-0.5">{{ plnName }}</p>
            </div>
          </div>
          <div v-else class="p-2.5 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-600"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <div>
               <p class="font-bold text-red-800 text-xs">{{ plnName }}</p>
            </div>
          </div>
        </div>

        <!-- 3 Icons (Mic, Barcode, Contacts) -->
        <div class="flex items-center gap-1.5 mt-2 pt-2 border-t border-neutral-100">
          <button @click="doSpeech" :class="['flex-1 flex flex-col items-center gap-0.5 p-1 rounded-xl transition-colors', isListening ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-neutral-50 hover:bg-primary-50 hover:text-primary-600 text-neutral-500']">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>
            <span class="text-[9px] font-bold">Suara</span>
          </button>
          
          <button @click="doBarcode" :class="['flex-1 flex flex-col items-center gap-0.5 p-1 rounded-xl transition-colors', isScanning ? 'bg-primary-50 text-primary-600 animate-pulse' : 'bg-neutral-50 hover:bg-primary-50 hover:text-primary-600 text-neutral-500']">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><line x1="7" y1="8" x2="7" y2="16"></line><line x1="12" y1="8" x2="12" y2="16"></line><line x1="17" y1="8" x2="17" y2="16"></line></svg>
            <span class="text-[9px] font-bold">Scan</span>
          </button>
          
          <button @click="pickContact" class="flex-1 flex flex-col items-center gap-0.5 p-1 bg-neutral-50 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-colors text-neutral-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            <span class="text-[9px] font-bold">Kontak</span>
          </button>
          
          <button @click="router.push(`/favorites/${categoryParam}`)" class="flex-1 flex flex-col items-center gap-0.5 p-1 bg-neutral-50 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-colors text-neutral-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <span class="text-[9px] font-bold">Favorit</span>
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
      <div v-else-if="!['pdam', 'pln_postpaid', 'bpjs', 'indihome', 'firstmedia', 'myrepublic', 'biznet', 'mncplay'].includes(categoryParam) && customerNo.length > 3" class="text-center py-10 text-neutral-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-3 opacity-20"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <p class="text-sm font-medium">Produk tidak ditemukan</p>
      </div>

    </div>
  </div>
</template>
