<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProductsStore } from '@/stores/products'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const productsStore = useProductsStore()
const authStore = useAuthStore()

const sku = route.params.sku as string
const customerNo = ref((route.query.phone as string) || '')
const customerNameQuery = route.query.name as string || ''
const loading = ref(false)
const customerName = ref(customerNameQuery)
const errorMsg = ref('')

const paymentMethods = [
  { id: 'saldo', name: 'Saldo Aplikasi', icon: 'M3 6h18v12H3z', description: 'Potong dari saldo deposit' },
  { id: 'qris', name: 'QRIS', icon: 'M3 3h8v8H3z M13 3h8v8h-8z M3 13h8v8H3z', description: 'Bayar pakai E-Wallet/M-Banking' },
]

const selectedPayment = ref('saldo')

const formatRp = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

const product = computed(() => {
  return productsStore.products.find(p => p.sku_code === sku)
})

const adminFee = computed(() => {
  if (selectedPayment.value === 'qris') return 1500
  return 0
})

const totalPrice = computed(() => {
  return (product.value?.harga_jual || 0) + adminFee.value
})

onMounted(() => {
  if (productsStore.products.length === 0) {
    productsStore.fetchProducts()
  }
  
  // If PLN name wasn't passed via query, we might need to fetch it here
  if (product.value?.category?.toLowerCase().includes('pln') && !customerName.value && customerNo.value.length >= 11) {
    checkPLN()
  }
})

const checkPLN = async () => {
  if (customerNo.value.length < 11) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/inquiry-pln`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({ customer_no: customerNo.value })
    })
    const data = await res.json()
    if (data.success && data.name) {
      let displayName = data.name
      if (data.segment_power) displayName += ` / ${data.segment_power}`
      customerName.value = displayName
    }
  } catch (e) {
    console.error(e)
  }
}

const buyProduct = async () => {
  if (!customerNo.value) {
    errorMsg.value = 'Nomor tujuan wajib diisi'
    return
  }

  const confirmMsg = `Konfirmasi Pembelian:\n\nProduk: ${product.value?.product_name}\nNomor: ${customerNo.value}\nHarga: ${formatRp(totalPrice.value)}\nMetode: ${selectedPayment.value === 'saldo' ? 'Saldo Aplikasi' : 'Tunai / Kasir'}\n\nLanjutkan?`
  if (!window.confirm(confirmMsg)) {
    return
  }

  loading.value = true
  errorMsg.value = ''
  
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/mobile/transaction/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({ 
        customer_no: customerNo.value, 
        sku_code: sku, 
        payment_method: selectedPayment.value,
        customer_name: customerName.value // Dikirim ke API (jika API mendukung penyimpanan nama ini)
      })
    })
    
    const data = await res.json()
    if (!res.ok || !data.success) {
      errorMsg.value = data.error || 'Gagal melakukan transaksi'
    } else {
      router.push('/history')
    }
  } catch (e: any) {
    errorMsg.value = e.message || 'Terjadi kesalahan jaringan'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50 flex flex-col pb-24">
    <!-- Header -->
    <div class="bg-primary-600 text-white py-2 px-3 flex items-center gap-2 shadow-sm sticky top-0 z-10">
      <button @click="router.back()" class="p-1.5 -ml-1.5 rounded-full hover:bg-white/20 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <h1 class="text-base font-bold">Checkout Pembayaran</h1>
    </div>

    <div class="p-3 space-y-3" v-if="product">
      <!-- Detail Tujuan -->
      <div class="card p-4 bg-white rounded-2xl shadow-sm border border-neutral-100">
        <h3 class="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Informasi Tujuan</h3>
        
        <div class="space-y-3">
          <div>
            <p class="text-[10px] text-neutral-400 font-medium">Nomor {{ product.category?.toLowerCase().includes('pln') ? 'Meter/ID Pelanggan' : 'Handphone' }}</p>
            <p class="font-bold text-neutral-800 text-base">{{ customerNo }}</p>
          </div>
          
          <div v-if="customerName">
            <p class="text-[10px] text-neutral-400 font-medium">Nama Pelanggan/Akun</p>
            <p class="font-bold text-neutral-800 text-sm">{{ customerName }}</p>
          </div>
        </div>
      </div>

      <!-- Detail Produk -->
      <div class="card p-4 bg-white rounded-2xl shadow-sm border border-neutral-100">
        <h3 class="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Detail Pembelian</h3>
        
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center text-primary-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h0M2 9.5h20"/></svg>
          </div>
          <div>
            <h2 class="font-bold text-sm text-neutral-800 leading-tight">{{ product.product_name }}</h2>
            <p class="text-[11px] text-neutral-500 mt-0.5">{{ product.brand }}</p>
          </div>
        </div>
        
        <div class="border-t border-dashed border-neutral-200 my-3"></div>
        
        <div class="space-y-2">
          <div class="flex justify-between items-center text-sm">
            <span class="text-neutral-500">Harga Produk</span>
            <span class="font-semibold text-neutral-800">{{ formatRp(product.harga_jual) }}</span>
          </div>
          <div class="flex justify-between items-center text-sm">
            <span class="text-neutral-500">Biaya Admin</span>
            <span class="font-semibold text-neutral-800">{{ adminFee === 0 ? 'Gratis' : formatRp(adminFee) }}</span>
          </div>
        </div>
        
        <div class="border-t border-dashed border-neutral-200 my-3"></div>
        
        <div class="flex justify-between items-center">
          <span class="font-bold text-neutral-800">Total Pembayaran</span>
          <span class="font-extrabold text-primary-600 text-lg">{{ formatRp(totalPrice) }}</span>
        </div>
      </div>

      <!-- Metode Pembayaran -->
      <div class="card p-4 bg-white rounded-2xl shadow-sm border border-neutral-100 mb-6">
        <h3 class="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Pilih Pembayaran</h3>
        
        <div class="space-y-2">
          <label v-for="method in paymentMethods" :key="method.id" 
            :class="[
              'flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
              selectedPayment === method.id ? 'border-primary-500 bg-primary-50' : 'border-neutral-100 hover:border-primary-200'
            ]">
            <input type="radio" :value="method.id" v-model="selectedPayment" class="mt-1 w-4 h-4 text-primary-600 border-neutral-300 focus:ring-primary-500">
            <div class="flex-1">
              <div class="flex justify-between items-center">
                <span class="font-bold text-sm text-neutral-800">{{ method.name }}</span>
                <span v-if="method.id === 'saldo'" class="text-[10px] font-bold text-primary-600 bg-white px-2 py-0.5 rounded-full border border-primary-200">
                  Sisa: {{ formatRp(authStore.userProfile?.saldo || 0) }}
                </span>
              </div>
              <p class="text-[10px] text-neutral-500 mt-0.5">{{ method.description }}</p>
            </div>
          </label>
        </div>
      </div>

      <div v-if="errorMsg" class="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 font-semibold text-center">
        {{ errorMsg }}
      </div>
    </div>

    <!-- Bottom Sticky Button -->
    <div class="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-3 bg-white border-t border-neutral-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-safe z-20">
      <button 
        @click="buyProduct" 
        :disabled="loading || !customerNo"
        class="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-primary-600/20 transition-all flex justify-between items-center active:scale-[0.98]">
        <div class="text-left">
          <p class="text-[10px] font-medium text-primary-100 mb-0.5">Total Bayar</p>
          <p class="text-sm font-extrabold">{{ formatRp(totalPrice) }}</p>
        </div>
        <div class="flex items-center gap-1.5">
          <span>{{ loading ? 'Memproses...' : 'Bayar Sekarang' }}</span>
          <svg v-if="!loading" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </div>
      </button>
    </div>
  </div>
</template>
<style>
.pb-safe { padding-bottom: env(safe-area-inset-bottom, 16px); }
</style>
