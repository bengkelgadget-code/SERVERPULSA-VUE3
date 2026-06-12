<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { onMounted } from 'vue'

const auth = useAuthStore()

onMounted(() => {
  auth.initialize()
})
</script>

<template>
  <div v-if="auth.loading" class="min-h-screen flex items-center justify-center">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
  </div>
  <router-view v-else></router-view>
</template>
