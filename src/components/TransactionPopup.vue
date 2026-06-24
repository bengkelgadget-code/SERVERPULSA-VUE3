<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { Capacitor } from '@capacitor/core'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const router = useRouter()
const auth = useAuthStore()
const isVisible = ref(false)
const transactionInfo = ref({ title: '', message: '', status: '' })
let timeoutId: any = null
let realtimeChannel: any = null
let pollingInterval: any = null
let knownPendingIds = new Set<string>()

onMounted(async () => {
  // Wait for auth to be ready
  await auth.initialize()
  if (!auth.user) return

  // Try realtime first
  setupRealtime()
  
  // Always start polling as fallback (catches updates even if realtime fails)
  startPolling()
  
  if (Capacitor.isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.requestPermissions()
    } catch (e) {
      console.warn('Local notifications not available')
    }
  }
})

const setupRealtime = () => {
  const userId = auth.user?.id
  if (!userId) return

  // Listen for transactions where this user is the owner OR the staff who made it
  realtimeChannel = supabase.channel('transaction-popup')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions' },
      (payload: any) => {
        const newRow = payload.new
        if (!newRow || (!newRow.user_id && !newRow.staff_id)) return
        
        const txUserId = newRow.user_id
        const txStaffId = newRow.staff_id
        
        // Only process if this update belongs to the current user (as owner or staff)
        if (txUserId !== userId && txStaffId !== userId) return
        
        const status = newRow.status?.toLowerCase()
        
        if (payload.eventType === 'INSERT') {
          if (['pending', 'proses'].includes(status)) {
            knownPendingIds.add(newRow.id)
          }
        } else if (payload.eventType === 'UPDATE') {
          if (knownPendingIds.has(newRow.id)) {
            if (!['pending', 'proses'].includes(status)) {
              showPopup(
                `Transaksi ${status.toUpperCase()}`,
                `Transaksi (${newRow.customer_no}) telah ${status}.`,
                status
              )
              knownPendingIds.delete(newRow.id)
            }
          } else {
            // If it's an update to pending/proses, track it
            if (['pending', 'proses'].includes(status)) {
              knownPendingIds.add(newRow.id)
            }
          }
        }
      }
    )
    .subscribe()
}

const startPolling = () => {
  // Poll every 15 seconds (battery-friendly) — only does work if pending exists
  pollingInterval = setInterval(async () => {
    await checkPendingTransactions()
  }, 15000)
  
  // Initial check after 3 seconds
  setTimeout(checkPendingTransactions, 3000)
}

const checkPendingTransactions = async () => {
  const userId = auth.user?.id
  if (!userId) return

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // 1. Fetch current pending from DB
    const { data: dbPending } = await supabase
      .from('transactions')
      .select('id, status, customer_no')
      .or(`user_id.eq.${userId},staff_id.eq.${userId}`)
      .in('status', ['pending'])

    const currentPendingIds = new Set(dbPending?.map(t => t.id) || [])

    // 2. Check if previously known pending IDs are NO LONGER pending in the DB
    for (const id of knownPendingIds) {
      if (!currentPendingIds.has(id)) {
        // Find its new status
        const { data: updatedTrx } = await supabase
          .from('transactions')
          .select('id, status, customer_no')
          .eq('id', id)
          .single()
          
        if (updatedTrx && !['pending', 'proses'].includes(updatedTrx.status?.toLowerCase())) {
          showPopup(
            `Transaksi ${updatedTrx.status.toUpperCase()}`,
            `Transaksi (${updatedTrx.customer_no}) telah ${updatedTrx.status}.`,
            updatedTrx.status
          )
          knownPendingIds.delete(id)
        }
      }
    }

    // 3. Add any newly found pending IDs to our known set
    if (dbPending) {
      for (const trx of dbPending) {
        knownPendingIds.add(trx.id)
      }
    }

    // 4. Only call API if we have known pending transactions (avoid unnecessary requests)
    if (knownPendingIds.size === 0) return
    
    const pendingArray = Array.from(knownPendingIds).slice(0, 1) // Check 1 at a time to reduce load
    for (const id of pendingArray) {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/mobile/transaction/check-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ transaction_id: id })
        })

        const result = await res.json()
        if (result.success && result.status) {
          const newStatus = result.status.toLowerCase()
          if (!['pending', 'proses'].includes(newStatus)) {
            const trx = dbPending?.find(t => t.id === id)
            const custNo = trx?.customer_no || 'Tujuan'
            
            showPopup(
              `Transaksi ${newStatus.toUpperCase()}`,
              `Transaksi (${custNo}) telah ${newStatus}.`,
              newStatus
            )
            knownPendingIds.delete(id)
          }
        }
      } catch (e) {
        continue
      }
    }
  } catch (e) {
    console.warn('Polling check failed:', e)
  }
}

const showPopup = async (title: string, message: string, status: string) => {
  transactionInfo.value = { title, message, status }
  isVisible.value = true
  
  if (Capacitor.isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body: message,
            id: Date.now(),
            schedule: { at: new Date(Date.now() + 50) },
          }
        ]
      })
    } catch (e) {
      console.warn('Failed to show local notification', e)
    }
  }

  if (timeoutId) clearTimeout(timeoutId)
  timeoutId = setTimeout(() => {
    isVisible.value = false
  }, 5000)
}

const closePopup = () => {
  isVisible.value = false
  if (timeoutId) clearTimeout(timeoutId)
  router.push('/history')
}

onUnmounted(() => {
  if (timeoutId) clearTimeout(timeoutId)
  if (pollingInterval) clearInterval(pollingInterval)
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
})
</script>

<template>
  <Transition name="slide-fade">
    <div 
      v-if="isVisible" 
      class="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-[90vw] w-80 p-4 rounded-xl shadow-lg border-l-4 transition-all"
      :class="{
        'bg-white border-green-500 shadow-green-100': transactionInfo.status === 'sukses',
        'bg-white border-red-500 shadow-red-100': transactionInfo.status === 'gagal',
        'bg-white border-yellow-500 shadow-yellow-100': transactionInfo.status === 'pending' || !['sukses', 'gagal'].includes(transactionInfo.status)
      }"
    >
      <div class="flex items-start">
        <svg v-if="transactionInfo.status === 'sukses'" class="w-6 h-6 text-green-500 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <svg v-else-if="transactionInfo.status === 'gagal'" class="w-6 h-6 text-red-500 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <svg v-else class="w-6 h-6 text-yellow-500 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <h4 class="font-bold text-gray-900 text-sm">{{ transactionInfo.title }}</h4>
          <p class="text-xs text-gray-500 mt-1">{{ transactionInfo.message }}</p>
        </div>
        <button @click="closePopup" class="ml-auto p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translate(-50%, -20px);
  opacity: 0;
}
</style>
