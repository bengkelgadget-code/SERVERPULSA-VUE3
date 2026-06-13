<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const products = ref<any[]>([])
const loading = ref(true)
const categoryFilter = ref('')
const brandFilter = ref('')
const categories = ref<string[]>([])
const saveLoading = ref<Record<string, boolean>>({})
const syncLoading = ref(false)
const mitraPricing = ref<Record<string, number>>({})

const isSuperadmin = computed(() => auth.userProfile?.role === 'superadmin')

let typingTimers: Record<string, any> = {}

const fetchProducts = async () => {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('brand', { ascending: true })
      
    if (error) throw error
    if (data) {
      products.value = data
      
      const uniqueCats = new Set<string>()
      data.forEach(p => {
        if (p.category) uniqueCats.add(p.category)
      })
      categories.value = Array.from(uniqueCats).sort()
    }
    
    // Fetch Mitra Pricing if admin
    if (!isSuperadmin.value && auth.user?.id) {
      const { data: mpData, error: mpError } = await supabase
        .from('mitra_pricing')
        .select('*')
        .eq('mitra_id', auth.user?.id)
      
      if (mpError) throw mpError
      if (mpData) {
        const mapping: Record<string, number> = {}
        mpData.forEach(mp => {
          mapping[mp.product_sku] = mp.markup_amount
        })
        mitraPricing.value = mapping
      }
    }
  } catch (err) {
    console.error('Error fetching products:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchProducts()
})

const filteredProducts = computed(() => {
  let result = products.value.filter(p => {
    const matchesCategory = categoryFilter.value ? p.category === categoryFilter.value : true
    const matchesBrand = brandFilter.value ? p.brand === brandFilter.value : true
    return matchesCategory && matchesBrand
  })
  
  // Sort by brand (provider), then by harga_modal (smallest to largest)
  result.sort((a, b) => {
    if (a.brand < b.brand) return -1
    if (a.brand > b.brand) return 1
    return (a.harga_modal || 0) - (b.harga_modal || 0)
  })
  
  return result
})

const availableBrands = computed(() => {
  const uniqueBrands = new Set<string>()
  products.value.forEach(p => {
    if (!categoryFilter.value || p.category === categoryFilter.value) {
      if (p.brand) uniqueBrands.add(p.brand)
    }
  })
  return Array.from(uniqueBrands).sort()
})

watch(availableBrands, (newBrands) => {
  if (brandFilter.value && !newBrands.includes(brandFilter.value)) {
    brandFilter.value = ''
  }
})

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(value || 0)
}

const toggleActive = async (product: any) => {
  const newStatus = !product.is_active
  try {
    const { error } = await supabase
      .from('products')
      .update({ is_active: newStatus })
      .eq('sku_code', product.sku_code)
      
    if (error) throw error
    product.is_active = newStatus
  } catch (err) {
    console.error('Error toggling status:', err)
    alert('Failed to update product status')
  }
}

const getHargaModal = (product: any) => {
  return isSuperadmin.value ? product.harga_modal : product.harga_jual
}

const getHargaJual = (product: any) => {
  if (isSuperadmin.value) return product.harga_jual
  return product.harga_jual + (mitraPricing.value[product.sku_code] || 0)
}

const handlePriceChange = (product: any, event: Event) => {
  const target = event.target as HTMLInputElement
  const newPrice = parseInt(target.value.replace(/[^0-9]/g, '')) || 0
  
  if (typingTimers[product.sku_code]) {
    clearTimeout(typingTimers[product.sku_code])
  }
  
  saveLoading.value[product.sku_code] = true
  
  typingTimers[product.sku_code] = setTimeout(async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const markupAmount = isSuperadmin.value ? newPrice : newPrice - product.harga_jual

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/admin-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'update_product_markup',
          payload: {
            sku: product.sku_code,
            markup: markupAmount
          }
        })
      })

      if (!response.ok) throw new Error('Failed to update price')
      
      if (isSuperadmin.value) {
        product.harga_jual = newPrice
      } else {
        mitraPricing.value[product.sku_code] = markupAmount
      }
    } catch (err) {
      console.error('Error saving price:', err)
      alert('Gagal menyimpan harga')
    } finally {
      saveLoading.value[product.sku_code] = false
    }
  }, 800)
}

const setAutoSama = async () => {
  if (!confirm(`Are you sure you want to set "Jual" price equal to "Modal" for ${filteredProducts.value.length} filtered products?`)) return
  
  loading.value = true
  try {
    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const items = []
    for (const product of filteredProducts.value) {
      const newPrice = getHargaModal(product) || 0
      if (getHargaJual(product) !== newPrice) {
        const markupAmount = isSuperadmin.value ? newPrice : newPrice - product.harga_jual
        items.push({ sku: product.sku_code, markup: markupAmount })
        
        // Update local state immediately for better UX
        if (isSuperadmin.value) {
          product.harga_jual = newPrice
        } else {
          mitraPricing.value[product.sku_code] = markupAmount
        }
      }
    }

    if (items.length > 0) {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/admin-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'batch_update_product_markup',
          payload: { items }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update prices')
      }
    }
    
    alert('Harga Jual telah disamakan dengan Harga Modal')
  } catch (err) {
    console.error('Error auto-setting prices:', err)
    alert('Terjadi kesalahan saat menyamakan harga')
  } finally {
    loading.value = false
  }
}

const syncDigiflazz = async () => {
  if (!confirm('Tarik data terbaru dari Digiflazz? Proses ini memakan waktu beberapa saat.')) return
  
  syncLoading.value = true
  try {
    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.access_token

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/sync-digiflazz`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
    const data = await res.json()
    if (data.success) {
      alert(data.message)
      await fetchProducts()
    } else {
      alert('Gagal sinkronisasi: ' + data.error)
    }
  } catch (err) {
    console.error(err)
    alert('Terjadi kesalahan saat menghubungi server sinkronisasi. Pastikan Anda sudah menjalankan backend di terminal terpisah ("node backend/server.js").')
  } finally {
    syncLoading.value = false
  }
}
</script>

<template>
  <div class="h-full flex flex-col gap-4">
    <!-- Header -->
    <div class="flex items-center justify-between shrink-0">
      <div>
        <h1 class="text-2xl font-extrabold text-gray-800">Product Catalog</h1>
        <p class="text-[13px] text-gray-500 mt-1">{{ products.length }} produk terdaftar</p>
      </div>
      <button 
        @click="syncDigiflazz"
        :disabled="syncLoading"
        class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full text-[13px] font-bold flex items-center shadow-md shadow-blue-200/50 transition-colors disabled:opacity-50"
      >
        <svg v-if="syncLoading" class="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        {{ syncLoading ? 'Menyinkronkan...' : 'Sync DigiFlazz' }}
      </button>
    </div>

    <!-- Top Filters -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 shrink-0">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <select
            v-model="categoryFilter"
            class="block w-full pl-3 pr-10 py-2 text-gray-700 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none bg-white bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat"
          >
            <option value="">Semua Kategori</option>
            <option v-for="cat in categories" :key="cat" :value="cat">
              {{ cat }}
            </option>
          </select>
        </div>
        <div>
          <select
            v-model="brandFilter"
            class="block w-full pl-3 pr-10 py-2 text-gray-700 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none bg-white bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat"
          >
            <option value="">Semua Provider</option>
            <option v-for="brand in availableBrands" :key="brand" :value="brand">
              {{ brand }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Main Table Card -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col min-h-0">
      <!-- Data Table -->
      <div class="overflow-y-auto flex-1 h-full">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-[#f4f7fb] sticky top-0 z-10 shadow-sm">
            <tr>
              <th scope="col" class="px-4 py-2 text-left text-[12px] font-bold text-gray-700 capitalize tracking-wide w-24">SKU</th>
              <th scope="col" class="px-4 py-2 text-left text-[12px] font-bold text-gray-700 capitalize tracking-wide">Product</th>
              <th scope="col" class="px-4 py-2 text-left text-[12px] font-bold text-gray-700 capitalize tracking-wide w-32">Brand</th>
              <th scope="col" class="px-4 py-2 text-left text-[12px] font-bold text-gray-700 capitalize tracking-wide w-32">Modal (Rp)</th>
              <th scope="col" class="px-4 py-2 text-left text-[12px] font-bold text-gray-700 capitalize tracking-wide w-48">
                Jual (Rp) 
                <span @click="setAutoSama" class="bg-blue-100 text-blue-600 font-bold px-2 py-0.5 rounded-full text-[10px] cursor-pointer ml-1 hover:bg-blue-200 transition-colors">Auto Sama</span>
              </th>
              <th scope="col" class="px-4 py-2 text-left text-[12px] font-bold text-gray-700 capitalize tracking-wide w-28">Profit/Unit</th>
              <th scope="col" class="px-4 py-2 text-center text-[12px] font-bold text-gray-700 capitalize tracking-wide w-28">Active</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="loading">
              <td colspan="7" class="px-6 py-10 text-center text-gray-500">
                <div class="flex justify-center items-center">
                  <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading products...
                </div>
              </td>
            </tr>
            <tr v-else-if="filteredProducts.length === 0">
              <td colspan="7" class="px-6 py-10 text-center text-gray-500">
                No products found matching your criteria.
              </td>
            </tr>
            <tr v-for="product in filteredProducts" :key="product.sku_code" class="hover:bg-[#f8fafc] transition-colors border-b border-gray-100 last:border-0">
              <td class="px-4 py-1.5 whitespace-nowrap">
                <span class="text-[12px] text-gray-400 font-medium">{{ product.sku_code }}</span>
              </td>
              <td class="px-4 py-1.5">
                <div class="text-[13px] font-bold text-gray-800 leading-tight">{{ product.product_name }}</div>
                <div class="text-[11px] text-gray-400">{{ product.category }}</div>
              </td>
              <td class="px-4 py-1.5 whitespace-nowrap">
                <span class="text-[12px] font-bold text-gray-600">{{ product.brand }}</span>
              </td>
              <td class="px-4 py-1.5 whitespace-nowrap">
                <span class="text-[12px] text-gray-500">{{ formatCurrency(getHargaModal(product)) }}</span>
              </td>
              <td class="px-4 py-1.5 whitespace-nowrap">
                <div class="flex items-center gap-2 relative">
                  <span class="absolute left-3 text-[12px] text-gray-400">Rp</span>
                  <input 
                    type="text" 
                    :value="getHargaJual(product)?.toLocaleString('id-ID')"
                    @input="(e) => handlePriceChange(product, e)"
                    class="block w-28 pl-8 pr-2 py-1 border border-gray-200 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500 text-[12px] font-bold text-gray-800 transition-colors"
                    :class="{'bg-gray-50 border-gray-200': saveLoading[product.sku_code]}"
                  />
                  <div class="absolute right-[-24px]">
                    <svg v-if="saveLoading[product.sku_code]" class="animate-spin h-3.5 w-3.5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <svg v-else class="h-3.5 w-3.5 text-green-500 opacity-0 transition-opacity" :class="{'opacity-100': !saveLoading[product.sku_code] && product.harga_jual !== undefined}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                </div>
              </td>
              <td class="px-4 py-1.5 whitespace-nowrap">
                <span class="text-[12px] font-bold" :class="(getHargaJual(product) - getHargaModal(product)) > 0 ? 'text-green-500' : (getHargaJual(product) - getHargaModal(product)) < 0 ? 'text-red-500' : 'text-green-500'">
                  +{{ formatCurrency(Math.max(0, (getHargaJual(product) || 0) - (getHargaModal(product) || 0))) }}
                </span>
              </td>
              <td class="px-4 py-1.5 whitespace-nowrap text-center">
                <button 
                  @click="toggleActive(product)"
                  class="px-2 py-0.5 rounded-full text-[10px] font-extrabold transition-colors w-[75px] text-center"
                  :class="product.is_active ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-red-100 text-red-500 hover:bg-red-200'"
                >
                  {{ product.is_active ? 'AKTIF' : 'NONAKTIF' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

