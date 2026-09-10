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

// Popup State
const selectedGroup = ref<{name: string, items: Voucher[]} | null>(null)

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

// Grouping Logic
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

const formatRp = (val: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(val || 0)
}

// Screensaver Logic
const idleTimeout = ref(120000) // 2 minutes (120000)
const isScreensaverActive = ref(false)
let idleTimer: any = null
let autoRefreshTimer: any = null

const resetIdleTimer = () => {
  isScreensaverActive.value = false
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    isScreensaverActive.value = true
    selectedGroup.value = null // close popups if idle
  }, idleTimeout.value)
}

const openGroupPopup = (group: any) => {
  selectedGroup.value = group
  resetIdleTimer()
}

onMounted(() => {
  fetchVouchers()
  
  // Data Auto-refresh every 5 minutes
  autoRefreshTimer = setInterval(fetchVouchers, 300000)

  // Global event listeners for idle tracking
  window.addEventListener('mousemove', resetIdleTimer)
  window.addEventListener('keydown', resetIdleTimer)
  window.addEventListener('touchstart', resetIdleTimer)
  window.addEventListener('click', resetIdleTimer)
  resetIdleTimer()
})

onUnmounted(() => {
  if (idleTimer) clearTimeout(idleTimer)
  if (autoRefreshTimer) clearInterval(autoRefreshTimer)
  window.removeEventListener('mousemove', resetIdleTimer)
  window.removeEventListener('keydown', resetIdleTimer)
  window.removeEventListener('touchstart', resetIdleTimer)
  window.removeEventListener('click', resetIdleTimer)
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
        <p class="text-gray-400 mt-2 text-lg font-medium">Silakan sentuh provider untuk melihat detail</p>
      </div>
      <div class="flex items-center gap-4">
        <!-- Back Button (acts as PPOB trigger for now) -->
        <div class="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-xl">
          <button @click="router.push('/')" class="text-white hover:text-gray-300 transition-colors font-bold tracking-widest text-xl cursor-pointer flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            MENU TRANSAKSI
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

    <!-- Dynamic Grid View (All Cards) -->
    <div v-else class="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 z-10 pb-2 custom-scrollbar overflow-y-auto content-start">
      <div v-for="group in groupedVouchers" :key="group.name" 
           @click="openGroupPopup(group)"
           class="flex flex-col rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 bg-white/5 backdrop-blur-lg border border-white/10 relative group hover:scale-[1.02] cursor-pointer min-h-[250px]">
        
        <!-- Card Header Banner -->
        <div class="p-4 flex items-center justify-between bg-gradient-to-r relative overflow-hidden shrink-0"
             :class="getProviderStyle(group.name).gradient">
          <div class="absolute inset-0 bg-black/10"></div>
          <!-- Instrumental overlay pattern -->
          <svg class="absolute right-0 top-0 h-full w-1/2 opacity-20 transform translate-x-1/4 scale-150" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon fill="currentColor" points="0,100 100,0 100,100"/>
          </svg>
          
          <h2 class="text-xl lg:text-2xl font-black text-white z-10 tracking-wider drop-shadow-md relative truncate">
            {{ group.name }}
          </h2>
          <div class="bg-white/20 px-3 py-1 rounded-full z-10 backdrop-blur-md border border-white/30">
            <span class="text-white font-bold text-xs">{{ group.items.length }} Item</span>
          </div>
        </div>

        <!-- Preview Card Body (Top 3 items) -->
        <div class="p-3 flex-1 flex flex-col gap-2 pointer-events-none">
          <div v-for="item in group.items.slice(0, 3)" :key="item.id" 
               class="bg-white/10 p-2.5 rounded-xl flex items-center justify-between border border-white/5">
            <div class="flex-1 min-w-0 pr-2">
              <h3 class="font-bold text-white text-sm truncate">{{ item.nama_produk }}</h3>
            </div>
            <div class="text-right flex-shrink-0">
              <span class="text-md font-black text-white">{{ formatRp(item.harga_jual) }}</span>
            </div>
          </div>
          <div v-if="group.items.length > 3" class="mt-auto text-center pt-2">
            <span class="text-xs font-bold text-white/50">Tampilkan {{ group.items.length - 3 }} lainnya...</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Popup Modal for Enlarged View -->
    <transition name="fade">
      <div v-if="selectedGroup" 
           class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-10 bg-slate-900/80 backdrop-blur-xl"
           @click.self="selectedGroup = null">
        
        <div class="bg-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 flex flex-col w-full max-w-5xl max-h-full animate-scale-up">
          
          <!-- Popup Header -->
          <div class="p-6 sm:p-8 flex items-center justify-between bg-gradient-to-r relative overflow-hidden shrink-0"
               :class="getProviderStyle(selectedGroup.name).gradient">
            <div class="absolute inset-0 bg-black/10"></div>
            <h2 class="text-4xl md:text-5xl font-black text-white z-10 drop-shadow-md relative truncate">
              VOUCHER {{ selectedGroup.name }}
            </h2>
            <button @click="selectedGroup = null" class="z-10 bg-black/20 hover:bg-black/40 text-white p-3 rounded-full transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- Popup Body (All Items Enlarged) -->
          <div class="p-6 sm:p-8 flex-1 overflow-y-auto custom-scrollbar bg-slate-800">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div v-for="item in selectedGroup.items" :key="item.id" 
                   class="bg-white/5 hover:bg-white/10 transition-colors p-5 rounded-2xl flex items-center justify-between border border-white/10">
                <div class="flex-1 min-w-0 pr-4">
                  <h3 class="font-bold text-white text-xl md:text-2xl truncate drop-shadow-sm">{{ item.nama_produk }}</h3>
                  <div class="mt-2">
                    <span class="px-3 py-1 rounded-md text-sm font-bold"
                          :class="item.stok > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'">
                      STOK TERSEDIA: {{ item.stok }}
                    </span>
                  </div>
                </div>
                <div class="text-right flex-shrink-0 bg-black/30 px-5 py-3 rounded-xl border border-white/10 shadow-inner">
                  <span class="text-2xl md:text-3xl font-black text-white drop-shadow-md">
                    {{ formatRp(item.harga_jual) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Screensaver Overlay (Ads) -->
    <transition name="fade">
      <div v-if="isScreensaverActive" 
           class="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center cursor-pointer"
           @click="resetIdleTimer">
        
        <!-- Placeholder for custom Ads/Video -->
        <div class="w-full h-full relative flex items-center justify-center overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-black opacity-80"></div>
          
          <div class="relative z-10 text-center px-4">
            <h1 class="text-6xl md:text-8xl font-black text-white mb-6 drop-shadow-2xl tracking-tighter animate-pulse">
              BENGKEL GADGET
            </h1>
            <p class="text-2xl md:text-4xl font-bold text-white/80">Solusi Pembayaran & Voucher Termurah</p>
            <div class="mt-12 inline-block bg-white/10 backdrop-blur-md px-8 py-4 rounded-full border border-white/20 animate-bounce">
              <span class="text-xl font-bold text-white">Sentuh layar untuk memulai</span>
            </div>
          </div>
        </div>
      </div>
    </transition>

  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes scaleUp {
  0% { transform: scale(0.95); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.animate-scale-up {
  animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
