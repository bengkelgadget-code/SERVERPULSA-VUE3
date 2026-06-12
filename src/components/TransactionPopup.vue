<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase'
const isVisible = ref(false)
const transactionInfo = ref({ title: '', message: '', status: '' })
let timeoutId: any = null
let realtimeChannel: any = null

onMounted(async () => {
  // Setup realtime listener for transactions table where user_id = current user
  setupRealtime()
})

const setupRealtime = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  
  if (!userId) {
    // Retry shortly if auth not ready
    setTimeout(setupRealtime, 2000)
    return
  }

  realtimeChannel = supabase.channel('transaction-popup')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
      (payload) => {
        const oldStatus = payload.old.status
        const newStatus = payload.new.status
        
        if (oldStatus !== newStatus) {
          showPopup(
            `Transaksi ${newStatus.toUpperCase()}`,
            `Status pesanan Anda telah berubah menjadi ${newStatus}.`,
            newStatus
          )
        }
      }
    )
    .subscribe()
}

const showPopup = (title: string, message: string, status: string) => {
  transactionInfo.value = { title, message, status }
  isVisible.value = true
  
  if (timeoutId) clearTimeout(timeoutId)
  
  timeoutId = setTimeout(() => {
    isVisible.value = false
  }, 3000) // Tampilkan selama 3 detik
}

onUnmounted(() => {
  if (timeoutId) clearTimeout(timeoutId)
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
        <!-- Icon Sukses -->
        <svg v-if="transactionInfo.status === 'sukses'" class="w-6 h-6 text-green-500 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        
        <!-- Icon Gagal -->
        <svg v-else-if="transactionInfo.status === 'gagal'" class="w-6 h-6 text-red-500 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>

        <!-- Icon Other -->
        <svg v-else class="w-6 h-6 text-yellow-500 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>

        <div>
          <h4 class="font-bold text-gray-900 text-sm">{{ transactionInfo.title }}</h4>
          <p class="text-xs text-gray-500 mt-1">{{ transactionInfo.message }}</p>
        </div>
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
