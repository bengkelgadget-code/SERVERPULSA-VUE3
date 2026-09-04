<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const internetProviders = [
  {
    id: 'indihome',
    name: 'Indihome',
    path: '/category/indihome',
    logo: 'I',
    color: 'bg-red-100 text-red-600'
  },
  {
    id: 'firstmedia',
    name: 'First Media',
    path: '/category/firstmedia',
    logo: 'F',
    color: 'bg-blue-100 text-blue-600'
  },
  {
    id: 'myrepublic',
    name: 'MyRepublic',
    path: '/category/myrepublic',
    logo: 'M',
    color: 'bg-purple-100 text-purple-600'
  },
  {
    id: 'biznet',
    name: 'Biznet',
    path: '/category/biznet',
    logo: 'B',
    color: 'bg-yellow-100 text-yellow-600'
  },
  {
    id: 'mncplay',
    name: 'MNC Play',
    path: '/category/mncplay',
    logo: 'M',
    color: 'bg-green-100 text-green-600'
  }
]
</script>

<template>
  <div class="min-h-screen bg-neutral-50 pb-24">
    <!-- Header -->
    <div class="bg-primary-600 text-white py-1.5 px-2 flex items-center  shadow-sm sticky top-0 z-10 justify-between">
      <div class="flex items-center gap-4">
        <button @click="router.back()" class="p-1 -ml-1 rounded-full hover:bg-white/20 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 class="text-lg font-bold">Tagihan Internet</h1>
      </div>
      <button @click="router.replace('/')" class="p-2 -mr-2 rounded-full hover:bg-white/20 transition-colors" title="Ke Beranda">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </button>
    </div>

    <div class="p-3">
      <div class="grid grid-cols-1 gap-2.5">
        <div 
          v-for="provider in internetProviders" 
          :key="provider.id"
          @click="router.push(provider.path)"
          class="card p-3 bg-white rounded-xl shadow-sm flex items-center gap-3 cursor-pointer hover:border-primary-300 border border-transparent transition-all active:scale-[0.98]"
        >
          <div :class="['w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg', provider.color]">
            {{ provider.logo }}
          </div>
          <span class="font-bold text-neutral-800 text-sm">{{ provider.name }}</span>
          <div class="ml-auto text-neutral-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
