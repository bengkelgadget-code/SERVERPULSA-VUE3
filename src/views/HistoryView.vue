<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import BottomNav from '@/components/BottomNav.vue'

const router = useRouter()
const auth = useAuthStore()
const transactions = ref<any[]>([])
const loading = ref(true)


const formatRp = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit' })}`
}

let realtimeChannel: any

const fetchHistory = async () => {
  loading.value = true
  const { data } = await supabase
    .from('transactions')
    .select('*, products(product_name)')
    .or(`user_id.eq.${auth.user?.id},staff_id.eq.${auth.user?.id}`)
    .order('created_at', { ascending: false })
    .limit(50)
  
  if (data) {
    transactions.value = data
  }
  loading.value = false
}

onMounted(() => {
  fetchHistory()

  // Subscribe to realtime updates for this user's transactions
  realtimeChannel = supabase.channel('transaction-updates')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'transactions'
      },
      (payload) => {
        // Find and update the transaction in the list
        const idx = transactions.value.findIndex(t => t.id === payload.new.id)
        if (idx !== -1) {
          // Keep product name from old data since it's a joined table
          payload.new.products = transactions.value[idx].products
          transactions.value[idx] = payload.new
          
          // Force reactivity (sometimes array mutation needs to be reassigned)
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
  return 'bg-yellow-100 text-yellow-700'
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50 flex flex-col pb-24">
    <div class="bg-primary-600 text-white p-4 flex items-center gap-4 shadow-sm sticky top-0 z-10">
      <button @click="router.push('/')" class="p-2 -ml-2 rounded-full hover:bg-white/20 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <h1 class="text-lg font-bold">Riwayat Transaksi</h1>
    </div>

    <div class="p-4 flex-1">
      <div v-if="loading" class="text-center py-10">
        <div class="animate-spin inline-block w-8 h-8 border-[3px] border-current border-t-transparent text-primary-600 rounded-full"></div>
      </div>
      
      <div v-else-if="transactions.length === 0" class="text-center py-10 text-neutral-400">
        Belum ada riwayat transaksi
      </div>

      <div v-else class="space-y-3">
        <div v-for="trx in transactions" :key="trx.id" class="card p-4">
          <div class="flex justify-between items-start mb-2">
            <div>
              <h3 class="font-bold text-neutral-800">{{ trx.products?.product_name || trx.sku_code }}</h3>
              <p class="text-sm font-medium text-neutral-600">{{ trx.customer_no }}</p>
            </div>
            <span :class="['px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider', getStatusColor(trx.status)]">
              {{ trx.status }}
            </span>
          </div>
          
          <div class="flex justify-between items-end mt-4">
            <div>
              <p class="text-[11px] text-neutral-400 mb-0.5">SN / Ref</p>
              <p class="text-xs font-mono text-neutral-600">{{ trx.sn || trx.ref_id }}</p>
            </div>
            <div class="text-right flex flex-col items-end">
              <p class="font-bold text-primary-600">{{ formatRp(trx.harga_jual) }}</p>
              <p class="text-[11px] text-neutral-400 mt-0.5">{{ formatDate(trx.created_at) }}</p>
            </div>
          </div>
          
          <div v-if="trx.status === 'sukses'" class="mt-4 pt-4 border-t border-neutral-100 flex justify-end">
            <button @click="router.push(`/receipt/${trx.id}`)" class="flex items-center gap-2 text-sm font-semibold text-primary-600 bg-primary-50 px-4 py-2 rounded-lg hover:bg-primary-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Cetak Struk
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <BottomNav />
  </div>
</template>
