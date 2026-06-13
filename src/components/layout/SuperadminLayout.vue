<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  ArrowLeftRight,
  LogOut,
  ChevronLeft,
  Menu,
  Package
} from 'lucide-vue-next'
import { ref } from 'vue'

const auth = useAuthStore()
const router = useRouter()
const isSidebarOpen = ref(true)

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const handleSignOut = async () => {
  await auth.signOut()
  router.push('/login')
}

const menuItems = [
  { name: 'Dashboard SAAS', path: '/superadmin/dashboard', icon: LayoutDashboard },
  { name: 'Katalog Produk', path: '/superadmin/products', icon: Package },
  { name: 'Data Mitra', path: '/superadmin/mitra', icon: Users },
  { name: 'Sistem Deposit', path: '/superadmin/deposits', icon: CreditCard },
  { name: 'Semua Transaksi', path: '/superadmin/transactions', icon: ArrowLeftRight }
]
</script>

<template>
  <div class="h-screen overflow-hidden bg-gray-50 flex">
    <!-- Sidebar -->
      <aside 
        :class="[
          'bg-white border-r border-gray-200 transition-all duration-300 flex flex-col',
          isSidebarOpen ? 'w-[280px]' : 'w-20'
        ]"
      >
        <div class="h-20 flex items-center justify-between px-6 border-b border-gray-100 shrink-0">
          <div v-if="isSidebarOpen" class="flex items-center gap-3">
            <div class="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <div>
              <div class="font-extrabold text-[15px] text-gray-800 leading-tight">Super Admin</div>
              <div class="text-[11px] text-gray-400 font-medium">Super Admin</div>
            </div>
          </div>
          <button @click="toggleSidebar" class="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
            <Menu v-if="!isSidebarOpen" class="w-5 h-5" />
            <ChevronLeft v-else class="w-5 h-5" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto no-scrollbar flex flex-col">
          <nav class="px-3 py-6 flex-1 flex flex-col">
            <div v-if="isSidebarOpen" class="px-4 text-[10px] font-bold text-gray-400 mb-2 mt-2 tracking-widest shrink-0">MENU SUPER ADMIN</div>
            <ul class="space-y-1 flex-1 flex flex-col">
              <li v-for="item in menuItems" :key="item.path" class="shrink-0">
                <router-link
                  :to="item.path"
                  class="flex items-center px-4 py-3 rounded-xl transition-all group relative font-medium text-[14px]"
                  :class="[
                    $route.path === item.path 
                      ? 'bg-gradient-to-r from-[#7c3aed] to-[#a855f7] text-white shadow-md shadow-purple-200/50' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                  ]"
                  :title="!isSidebarOpen ? item.name : ''"
                >
                  <component :is="item.icon" class="w-[20px] h-[20px] flex-shrink-0" :class="$route.path === item.path ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'" />
                  <span 
                    class="ml-3 truncate transition-opacity duration-300"
                    :class="isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'"
                  >
                    {{ item.name }}
                  </span>
                </router-link>
              </li>
              
              <!-- SAAS Tag -->
              <div v-if="isSidebarOpen" class="px-6 py-4 mt-auto border-t border-gray-100">
                <div class="bg-indigo-50 rounded-xl p-4 border border-indigo-100/50 relative overflow-hidden">
                  <div class="absolute right-0 top-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                  <h4 class="text-[11px] font-bold text-indigo-800 uppercase tracking-wider mb-1">SAAS Mode</h4>
                  <p class="text-[12px] text-indigo-600 font-medium leading-relaxed">Kelola semua Mitra di satu tempat</p>
                </div>
              </div>
              
              <!-- Sign Out -->
              <li class="shrink-0">
                <button
                  @click="handleSignOut"
                  class="flex items-center w-full px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors font-medium text-[14px]"
                  :title="!isSidebarOpen ? 'Keluar' : ''"
                >
                  <LogOut class="w-[20px] h-[20px] flex-shrink-0" />
                  <span 
                    class="ml-3 truncate transition-opacity duration-300"
                    :class="isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'"
                  >
                    Keluar
                  </span>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f4f7fb] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
        <!-- Page Content -->
        <div class="flex-1 overflow-hidden flex flex-col p-5">
          <div class="max-w-[1400px] w-full mx-auto h-full flex flex-col">
            <router-view v-slot="{ Component }">
              <transition name="fade" mode="out-in">
                <component :is="Component" class="flex-1 min-h-0" />
              </transition>
            </router-view>
          </div>
        </div>
      </main>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
