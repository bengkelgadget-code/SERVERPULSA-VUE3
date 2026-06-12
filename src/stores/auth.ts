import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<any>(null)
  const userProfile = ref<any>(null)
  const loading = ref(true)
  const isInitialized = ref(false)

  async function initialize() {
    if (isInitialized.value) return
    isInitialized.value = true

    const { data: { session } } = await supabase.auth.getSession()
    user.value = session?.user || null
    if (user.value) {
      await fetchProfile(user.value.id)
    }
    
    supabase.auth.onAuthStateChange(async (_event, session) => {
      user.value = session?.user || null
      if (user.value) {
        await fetchProfile(user.value.id)
      } else {
        userProfile.value = null
      }
    })
    
    loading.value = false
  }

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (data) {
      userProfile.value = data
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    user.value = null
    userProfile.value = null
  }

  return {
    user,
    userProfile,
    loading,
    initialize,
    signOut
  }
})
