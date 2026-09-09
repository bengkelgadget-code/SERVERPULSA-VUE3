<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'vue-router'

const router = useRouter()

// Data structure
interface Voucher {
  id: string
  nama_produk: string
  harga_jual: number
  stok: number
  provider_kategori: string
}

const vouchers = ref<Voucher[]>([])
const loading = ref(true)

// Config Provider Colors
const getProviderStyle = (provider: string) => {
  const p = (provider || '').toLowerCase()
  if (p.includes('telkomsel') || p.includes('tsel')) {
    return { gradient: 'from-red-600 to-red-800' }
  }
  if (p.includes('indosat') || p.includes('isat')) {
    return { gradient: 'from-yellow-400 to-yellow-600' }
  }
  if (p.includes('xl')) {
    return { gradient: 'from-blue-600 to-blue-800' }
  }
  if (p.includes('tri') || p.includes('three') || p.includes('3')) {
    return { gradient: 'from-slate-800 to-black' }
  }
  if (p.includes('axis')) {
    return { gradient: 'from-purple-500 to-purple-800' }
  }
  if (p.includes('smartfren')) {
    return { gradient: 'from-pink-500 to-red-600' }
  }
  if (p.includes('byu') || p.includes('by.u')) {
    return { gradient: 'from-blue-500 to-orange-500' }
  }
  return { gradient: 'from-gray-600 to-gray-800' }
}

const fetchVouchers = async () => {
  try {
    const { data, error } = await supabase
      .from('counter_products')
      .select('id, nama_produk, harga_jual, stok, provider_kategori')
      .eq('jenis', 'VOUCHER')
      .order('harga_jual', { ascending: true })

    if (error) throw error
    vouchers.value = data || []
  } catch (err) {
    console.error('Error fetching vouchers:', err)
  } finally {
    loading.value = false
  }
}

// Grouping and Pagination Logic
const groupedVouchers = computed(() => {
  const groups: Record<string, Voucher[]> = {}
  vouchers.value.forEach(v => {
    const p = (v.provider_kategori || 'Lainnya').toUpperCase()
    if (!groups[p]) groups[p] = []
    groups[p].push(v)
  })
  return Object.keys(groups).map(name => ({
    name,
    items: groups[name]
  }))
})

// Auto Pagination (Carousel) every 15 seconds if > 6 providers
const currentPage = ref(0)
const itemsPerPage = 6 // 3 columns x 2 rows
let intervalId: any = null

const paginatedGroups = computed(() => {
  const start = currentPage.value * itemsPerPage
  return groupedVouchers.value.slice(start, start + itemsPerPage)
})

const totalPages = computed(() => Math.ceil(groupedVouchers.value.length / itemsPerPage))

const nextPage = () => {
  if (totalPages.value > 1) {
    currentPage.value = (currentPage.value + 1) % totalPages.value
  }
}

const formatRp = (val: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(val || 0)
}

onMounted(() => {
  fetchVouchers()
  intervalId = setInterval(nextPage, 15000)
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})

</script>

<template>
  <div class="min-h-screen bg-slate-900 flex flex-col p-4 sm:p-6 overflow-hidden select-none font-sans relative">
    
    <!-- Background Accents -->
    <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
      <div class="absolute -top-32 -right-32 w-96 h-96 bg-primary-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div class="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
    </div>

    <!-- Header -->
    <div class="flex items-center justify-between mb-6 z-10">
      <div>
        <h1 class="text-3xl md:text-5xl font-black text-white tracking-tight drop-shadow-md">DAFTAR VOUCHER</h1>
        <p class="text-gray-400 mt-2 text-lg font-medium">Ketersediaan & Harga Terkini</p>
      </div>
      <div class="flex items-center gap-4">
        <!-- Pagination Indicator -->
        <div v-if="totalPages > 1" class="flex gap-2 mr-4">
          <div v-for="i in totalPages" :key="i" 
               class="w-3 h-3 rounded-full transition-all duration-500"
               :class="(i-1) === currentPage ? 'bg-white scale-125' : 'bg-white/20'">
          </div>
        </div>
        <!-- Back Button -->
        <div class="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-xl">
          <button @click="router.back()" class="text-white hover:text-gray-300 transition-colors font-bold tracking-widest text-xl cursor-pointer">
            TUTUP
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex items-center justify-center z-10">
      <div class="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-white drop-shadow-lg"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="groupedVouchers.length === 0" class="flex-1 flex items-center justify-center z-10">
      <p class="text-2xl text-white/50 font-bold tracking-widest">TIDAK ADA DATA VOUCHER</p>
    </div>

    <!-- 3x2 Grid View -->
    <div v-else class="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-rows-2 gap-6 z-10 h-full pb-2">
      <div v-for="group in paginatedGroups" :key="group.name" 
           class="flex flex-col rounded-3xl overflow-hidden shadow-2xl transition-all duration-700 bg-white/5 backdrop-blur-lg border border-white/10 relative group hover:scale-[1.01]">
        
        <!-- Card Header Banner -->
        <div class="p-5 flex items-center justify-between bg-gradient-to-r relative overflow-hidden"
             :class="getProviderStyle(group.name).gradient">
          <div class="absolute inset-0 bg-black/10"></div>
          <!-- Instrumental overlay pattern -->
          <svg class="absolute right-0 top-0 h-full w-1/2 opacity-20 transform translate-x-1/4 scale-150" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon fill="currentColor" points="0,100 100,0 100,100"/>
          </svg>
          
          <h2 class="text-2xl lg:text-3xl font-black text-white z-10 tracking-wider drop-shadow-md relative truncate">
            {{ group.name }}
          </h2>
          <div class="bg-white/20 px-4 py-1.5 rounded-full z-10 backdrop-blur-md border border-white/30">
            <span class="text-white font-bold text-sm">{{ group.items.length }} Item</span>
          </div>
        </div>

        <!-- Card Body (Voucher Items) -->
        <div class="p-4 flex-1 overflow-y-auto custom-scrollbar">
          <div class="grid gap-3">
            <div v-for="item in group.items" :key="item.id" 
                 class="bg-white/10 hover:bg-white/15 transition-colors p-4 rounded-2xl flex items-center justify-between border border-white/5 shadow-inner backdrop-blur-sm">
              <div class="flex-1 min-w-0 pr-4">
                <h3 class="font-bold text-white text-lg lg:text-xl truncate drop-shadow-sm transition-colors">
                  {{ item.nama_produk }}
                </h3>
                <div class="flex items-center gap-2 mt-1">
                  <span class="px-2 py-0.5 rounded-md text-xs font-bold"
                        :class="item.stok > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'">
                    STOK: {{ item.stok }}
                  </span>
                </div>
              </div>
              <div class="text-right flex-shrink-0 bg-black/20 px-4 py-2 rounded-xl border border-white/5">
                <span class="text-xl lg:text-2xl font-black text-white drop-shadow-md">
                  {{ formatRp(item.harga_jual) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}

@keyframes blob {
  0% { transform: translate(0px, 0px) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0px, 0px) scale(1); }
}
.animate-blob {
  animation: blob 7s infinite;
}
.animation-delay-2000 {
  animation-delay: 2s;
}
</style>
