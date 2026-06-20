<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import BottomNav from '@/components/BottomNav.vue'
import PullToRefresh from '@/components/PullToRefresh.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const transactions = ref<any[]>([])
const loading = ref(true)

const selectedTrxId = computed(() => route.query.trx as string | undefined)
const selectedTrx = computed(() => transactions.value.find(t => t.id === selectedTrxId.value) || null)

import { formatRp } from '@/utils/format'
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit' })}`
}
const formatDateShort = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.getDate()}/${d.getMonth()+1} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

let realtimeChannel: any

const fetchHistory = async () => {
  loading.value = true
  
  let query = supabase
    .from('transactions')
    .select('*, products(product_name)')
    .order('created_at', { ascending: false })
    .limit(50)

  // If not superadmin, restrict to their own/mitra's transactions
  if (auth.userProfile?.role !== 'superadmin') {
    const targetUserId = auth.userProfile?.role === 'staff' ? auth.userProfile?.admin_id : auth.user?.id
    if (targetUserId) {
      query = query.eq('user_id', targetUserId)
    }
  }

  const { data } = await query
  
  if (data) {
    transactions.value = data
    
    // Auto-check only truly pending transactions (not refunded) in the background
    const pendingTrx = data.filter(t => t.status === 'pending')
    if (pendingTrx.length > 0) {
      checkPendingStatuses(pendingTrx)
    }
  }
  loading.value = false
}

const checkPendingStatuses = async (pendingTrx: any[]) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  for (const trx of pendingTrx) {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/mobile/transaction/check-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ transaction_id: trx.id })
      })
      const result = await res.json()
      if (result.success && result.status !== trx.status) {
        const idx = transactions.value.findIndex(t => t.id === trx.id)
        if (idx !== -1) {
          transactions.value[idx].status = result.status
          transactions.value[idx].sn = result.sn || transactions.value[idx].sn
          transactions.value = [...transactions.value]
        }
      }
    } catch (e) {
      console.error('Failed to auto-check status:', e)
    }
  }
}

onMounted(async () => {
  await auth.initialize()
  if (!auth.user) {
    loading.value = false
    return
  }
  
  fetchHistory()

  // Subscribe to realtime updates for this user's transactions (as owner or staff)
  const userId = auth.user.id
  realtimeChannel = supabase.channel('transaction-updates')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'transactions'
      },
      (payload) => {
        // Only process if this transaction belongs to the current user
        if (payload.new.user_id !== userId && payload.new.staff_id !== userId) return
        
        const idx = transactions.value.findIndex(t => t.id === payload.new.id)
        if (idx !== -1) {
          payload.new.products = transactions.value[idx].products
          transactions.value[idx] = payload.new
          transactions.value = [...transactions.value]
        }
      }
    )
    .subscribe()
})

onUnmounted(() => {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel)
  }
})

const getStatusColor = (status: string) => {
  if (status === 'sukses') return 'bg-green-100 text-green-700'
  if (status === 'gagal') return 'bg-red-100 text-red-700'
  // using blue for 'proses' visually separates it from 'pending' (yellow)
  if (status === 'proses') return 'bg-blue-100 text-blue-700'
  return 'bg-yellow-100 text-yellow-700'
}

const getDisplayStatus = (status: string, createdAt: string) => {
  if (status !== 'pending') return status;
  const diffInMinutes = (new Date().getTime() - new Date(createdAt).getTime()) / 60000;
  if (diffInMinutes < 2) {
    return 'proses';
  }
  return 'pending';
}

const getStatusIndicator = (status: string) => {
  if (status === 'sukses') return 'bg-green-500'
  if (status === 'gagal') return 'bg-red-500'
  if (status === 'proses') return 'bg-blue-500'
  return 'bg-yellow-500'
}

const openPopup = (trx: any) => {
  router.push({ query: { trx: trx.id } })
}

const closePopup = () => {
  router.back()
}
</script>

<template>
  <PullToRefresh :onRefresh="fetchHistory">
  <div class="min-h-screen bg-neutral-50 flex flex-col pb-24 relative">
    <div class="bg-primary-600 text-white p-4 flex items-center gap-4 shadow-sm sticky top-0 z-10">
      <button @click="router.back()" class="p-2 -ml-2 rounded-full hover:bg-white/20 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <h1 class="text-xl font-bold">Riwayat Transaksi</h1>
    </div>

    <div class="p-4 flex-1">
      <div v-if="loading" class="text-center py-10">
        <div class="animate-spin inline-block w-8 h-8 border-[3px] border-current border-t-transparent text-primary-600 rounded-full"></div>
      </div>
      
      <div v-else-if="transactions.length === 0" class="text-center py-10 text-neutral-400">
        Belum ada riwayat transaksi
      </div>

      <div v-else class="space-y-2">
        <div v-for="trx in transactions" :key="trx.id" @click="openPopup(trx)" class="bg-white rounded-xl p-3 shadow-sm border border-neutral-100 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer">
          <div class="flex items-center gap-3">
            <div :class="['w-1.5 h-10 rounded-full', getStatusIndicator(getDisplayStatus(trx.status, trx.created_at))]"></div>
            <div>
              <h3 class="font-bold text-sm text-neutral-800 line-clamp-1">{{ trx.products?.product_name || trx.sku_code }}</h3>
              <p class="text-xs text-neutral-500 mt-0.5">{{ trx.customer_no }} &bull; {{ formatDateShort(trx.created_at) }}</p>
            </div>
          </div>
          <div class="text-right flex flex-col items-end gap-1">
            <p class="font-bold text-sm text-primary-600">{{ formatRp(trx.harga_jual) }}</p>
            <span :class="['px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider', getStatusColor(getDisplayStatus(trx.status, trx.created_at))]">
              {{ getDisplayStatus(trx.status, trx.created_at) }}
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Popup Modal -->
    <div v-if="selectedTrx" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click.self="closePopup">
      <div class="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
        
        <div class="bg-neutral-50 border-b border-neutral-100 p-4 flex justify-between items-center relative">
          <h2 class="font-bold text-neutral-800 text-xl">Detail Transaksi</h2>
          <button @click="closePopup" class="p-1.5 bg-neutral-200/50 hover:bg-neutral-200 rounded-full text-neutral-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        
        <div class="p-5 flex-1 overflow-y-auto">
          <div class="text-center mb-6">
            <p class="text-sm text-neutral-500 mb-2">Status Transaksi</p>
            <div class="inline-flex items-center gap-2">
              <span :class="['px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider', getStatusColor(getDisplayStatus(selectedTrx.status, selectedTrx.created_at))]">
                {{ getDisplayStatus(selectedTrx.status, selectedTrx.created_at) }}
              </span>
            </div>
            <p v-if="selectedTrx.status === 'pending'" class="text-xs text-neutral-400 mt-2">Menunggu respons dari server...</p>
          </div>

          <div class="space-y-4 text-sm">
            <div>
              <p class="text-neutral-500 text-xs mb-0.5">Produk</p>
              <p class="font-bold text-neutral-800">{{ selectedTrx.products?.product_name || selectedTrx.sku_code }}</p>
            </div>
            <div>
              <p class="text-neutral-500 text-xs mb-0.5">Tujuan / Nomor Pelanggan</p>
              <p class="font-mono font-medium text-neutral-800">{{ selectedTrx.customer_no }}</p>
            </div>
            <div>
              <p class="text-neutral-500 text-xs mb-0.5">SN / Ref ID</p>
              <p class="font-mono text-xs text-neutral-600 break-all">{{ selectedTrx.sn || selectedTrx.ref_id }}</p>
            </div>
            <div class="flex justify-between items-center pt-2 border-t border-dashed border-neutral-200">
              <p class="text-neutral-500">Total Harga</p>
              <p class="font-bold text-primary-600 text-lg">{{ formatRp(selectedTrx.harga_jual) }}</p>
            </div>
            <div class="flex justify-between items-center">
              <p class="text-neutral-500">Tanggal</p>
              <p class="text-neutral-800 font-medium">{{ formatDate(selectedTrx.created_at) }}</p>
            </div>
          </div>
        </div>
        
        <div class="p-4 bg-neutral-50 border-t border-neutral-100 flex gap-3">
          <button @click="router.push(`/receipt/${selectedTrx.id}`)" class="flex-1 flex justify-center items-center gap-2 text-sm font-semibold text-white bg-primary-600 px-4 py-2.5 rounded-xl hover:bg-primary-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Cetak
          </button>
          <button @click="router.push(`/receipt/${selectedTrx.id}?share=true`)" class="flex-1 flex justify-center items-center gap-2 text-sm font-semibold text-primary-600 bg-primary-50 border border-primary-100 px-4 py-2.5 rounded-xl hover:bg-primary-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
            Kirim
          </button>
        </div>
      </div>
    </div>

  </div>
  </PullToRefresh>
  
  <BottomNav />
</template>
