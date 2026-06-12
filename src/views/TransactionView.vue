<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProductsStore } from '@/stores/products'
import { supabase } from '@/lib/supabase'

const route = useRoute()
const router = useRouter()
const productsStore = useProductsStore()

const sku = route.params.sku as string
const customerNo = ref('')
const loading = ref(false)
const plnName = ref('')
const errorMsg = ref('')

const formatRp = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

const product = computed(() => {
  return productsStore.products.find(p => p.sku_code === sku)
})

onMounted(() => {
  if (productsStore.products.length === 0) {
    productsStore.fetchProducts()
  }
})

const checkPLN = async () => {
  if (customerNo.value.length < 10) return
  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_NEXTJS_API_URL}/api/mobile/transaction/inquiry-pln`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({ customer_no: customerNo.value, sku_code: sku })
    })
    const data = await res.json()
    if (data.success && data.data?.name) {
      plnName.value = data.data.name
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const buyProduct = async () => {
  if (!customerNo.value) {
    errorMsg.value = 'Nomor tujuan wajib diisi'
    return
  }
  loading.value = true
  errorMsg.value = ''
  
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_NEXTJS_API_URL}/api/mobile/transaction/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({ customer_no: customerNo.value, sku_code: sku })
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
  <div class="min-h-screen bg-neutral-50 flex flex-col">
    <div class="bg-primary-600 text-white p-4 flex items-center gap-4 shadow-sm">
      <button @click="router.back()" class="p-2 -ml-2 rounded-full hover:bg-white/20 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <h1 class="text-lg font-bold">Transaksi</h1>
    </div>

    <div class="p-4 flex-1" v-if="product">
      <div class="card mb-6">
        <div class="flex justify-between items-start mb-2">
          <div>
            <h2 class="font-bold text-lg text-neutral-800">{{ product.product_name }}</h2>
            <p class="text-sm text-neutral-500">{{ product.brand }}</p>
          </div>
          <p class="font-bold text-primary-600 text-lg">{{ formatRp(product.harga_jual) }}</p>
        </div>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-bold text-neutral-700 mb-2">Nomor Tujuan / PLN</label>
          <div class="relative">
            <input 
              v-model="customerNo" 
              type="text" 
              inputmode="numeric"
              class="input-field text-lg font-bold tracking-wide py-3" 
              placeholder="08123xxxx / 5123xxxx" 
              @blur="product.category.toLowerCase().includes('pln') && checkPLN()"
            />
          </div>
        </div>

        <div v-if="plnName" class="p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <p class="text-xs text-blue-600 font-semibold mb-1">Nama Pelanggan PLN</p>
          <p class="font-bold text-blue-900">{{ plnName }}</p>
        </div>

        <div v-if="errorMsg" class="p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 font-medium">
          {{ errorMsg }}
        </div>
      </div>
    </div>

    <div class="p-4 bg-white border-t border-neutral-200 pb-safe">
      <button 
        @click="buyProduct" 
        :disabled="loading || !customerNo"
        class="btn-primary w-full py-4 text-lg">
        {{ loading ? 'Memproses...' : 'Beli Sekarang' }}
      </button>
    </div>
  </div>
</template>
<style>
.pb-safe { padding-bottom: env(safe-area-inset-bottom, 16px); }
</style>
