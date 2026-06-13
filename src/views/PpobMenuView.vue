<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const ppobServices = [
  {
    id: 'pdam',
    name: 'Tagihan PDAM',
    path: '/category/pdam',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>`,
    color: 'bg-blue-100 text-blue-600'
  },
  {
    id: 'pln-postpaid',
    name: 'Tagihan Listrik',
    path: '/category/pln_postpaid',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
    color: 'bg-yellow-100 text-yellow-600'
  },
  {
    id: 'bpjs',
    name: 'Tagihan BPJS',
    path: '/category/bpjs',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>`,
    color: 'bg-green-100 text-green-600'
  },
  {
    id: 'internet',
    name: 'Tagihan Internet',
    path: '/internet',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01"></path><path d="M2 8.82a15 15 0 0 1 20 0"></path><path d="M5 12.82a10 10 0 0 1 14 0"></path><path d="M8.5 16.42a5 5 0 0 1 7 0"></path></svg>`,
    color: 'bg-purple-100 text-purple-600'
  }
]
</script>

<template>
  <div class="min-h-screen bg-neutral-50 pb-24">
    <!-- Header -->
    <div class="bg-primary-600 text-white py-1.5 px-2 flex items-center gap-1.5 shadow-sm sticky top-0 z-10">
      <button @click="router.push('/')" class="p-1 -ml-1 rounded-full hover:bg-white/20 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <h1 class="text-sm font-bold">PPOB & Tagihan</h1>
    </div>

    <div class="p-4">
      <div class="grid grid-cols-2 gap-4">
        <div 
          v-for="service in ppobServices" 
          :key="service.id"
          @click="router.push(service.path)"
          class="card p-4 bg-white rounded-2xl shadow-sm flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary-300 border border-transparent transition-all active:scale-[0.98]"
        >
          <div :class="['w-14 h-14 rounded-2xl flex items-center justify-center', service.color]">
            <div v-html="service.icon"></div>
          </div>
          <span class="text-xs font-bold text-neutral-800 text-center">{{ service.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
