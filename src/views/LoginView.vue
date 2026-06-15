<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const router = useRouter()
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

const handleLogin = async () => {
  if (!email.value || !password.value) return
  loading.value = true
  errorMsg.value = ''
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  
  if (error) {
    errorMsg.value = error.message
    loading.value = false
  } else if (data.user) {
    const authStore = useAuthStore()
    authStore.user = data.user
    const profile = await authStore.ensureProfile()
    
    loading.value = false
    if (profile?.role === 'superadmin') {
      router.push('/superadmin')
    } else if (profile?.role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/')
    }
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="card w-full max-w-sm space-y-6">
      <div class="text-center">
        <h1 class="text-2xl font-bold text-primary-600">KONTER APP</h1>
        <p class="text-neutral-500 text-sm mt-1">Masuk untuk transaksi pulsa</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div v-if="errorMsg" class="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
          {{ errorMsg }}
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">Email</label>
          <input v-model="email" type="email" required class="input-field" placeholder="Masukkan email" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Password</label>
          <input v-model="password" type="password" required class="input-field" placeholder="Masukkan password" />
        </div>
        <button type="submit" :disabled="loading" class="btn-primary w-full mt-2">
          {{ loading ? 'Memproses...' : 'Masuk' }}
        </button>
      </form>
    </div>
  </div>
</template>
