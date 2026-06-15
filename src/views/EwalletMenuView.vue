<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const wallets = [
  { id: 'dana', name: 'DANA', icon: 'bg-blue-500 text-white', letter: 'D' },
  { id: 'gopay', name: 'GoPay', icon: 'bg-green-500 text-white', letter: 'G' },
  { id: 'ovo', name: 'OVO', icon: 'bg-purple-600 text-white', letter: 'O' },
  { id: 'shopeepay', name: 'ShopeePay', icon: 'bg-orange-500 text-white', letter: 'S' },
  { id: 'linkaja', name: 'LinkAja', icon: 'bg-red-600 text-white', letter: 'L' }
]
</script>

<template>
  <div class="min-h-screen bg-neutral-50 pb-24">
    <!-- Header -->
    <div class="bg-primary-600 text-white p-4 flex items-center gap-4 shadow-sm sticky top-0 z-10">
      <button @click="router.back()" class="p-2 -ml-2 rounded-full hover:bg-white/20 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <h1 class="text-xl font-bold">Pilih E-Wallet</h1>
    </div>

    <div class="p-4">
      <div class="grid grid-cols-3 gap-4">
        <button 
          v-for="w in wallets" 
          :key="w.id"
          @click="router.push(`/ewallet/${w.id}`)"
          class="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-neutral-100 hover:border-primary-300 transition-colors active:scale-95"
        >
          <div :class="['w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-xl mb-3 shadow-sm', w.icon]">
            {{ w.letter }}
          </div>
          <span class="text-xs font-bold text-neutral-700">{{ w.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
