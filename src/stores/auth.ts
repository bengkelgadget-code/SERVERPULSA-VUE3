import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<any>(null)
  const userProfile = ref<any>(null)
  const loading = ref(true)
  const isInitialized = ref(false)
  let userSubscription: any = null

  let initPromise: Promise<boolean> | null = null

  async function initialize() {
    if (isInitialized.value) return true
    if (initPromise) return initPromise

    initPromise = new Promise((resolve) => {
      supabase.auth.onAuthStateChange(async (_event, session) => {
        try {
          user.value = session?.user || null
          if (user.value) {
            await fetchProfile(user.value.id)
          } else {
            userProfile.value = null
            if (userSubscription) {
              supabase.removeChannel(userSubscription)
              userSubscription = null
            }
          }
        } catch (err) {
          console.error('Critical error in fetchProfile during init:', err)
        } finally {
          if (!isInitialized.value) {
            isInitialized.value = true
            loading.value = false
            resolve(true)
          }
        }
      })
    })
  }

  async function fetchProfile(userId: string) {
    console.log('Fetching profile for:', userId)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error) {
        console.error('Error fetching user profile:', error)
      }
      
      if (data) {
        console.log('Profile fetched successfully:', data.role)
        userProfile.value = data
        setupRealtime(userId)
      } else {
        console.log('No profile data returned.')
      }
    } catch (err) {
      console.error('Critical error in fetchProfile:', err)
    }
  }

  function setupRealtime(userId: string) {
    if (userSubscription) {
      supabase.removeChannel(userSubscription)
    }

    userSubscription = supabase.channel('user-profile-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
        (payload) => {
          console.log('User profile updated via realtime:', payload.new)
          userProfile.value = { ...userProfile.value, ...payload.new }
        }
      )
      .subscribe()
  }

  async function ensureProfile() {
    if (userProfile.value) return userProfile.value
    if (user.value) {
      await fetchProfile(user.value.id)
      return userProfile.value
    }
    return null
  }

  async function signOut() {
    await supabase.auth.signOut()
    user.value = null
    userProfile.value = null
    if (userSubscription) {
      supabase.removeChannel(userSubscription)
      userSubscription = null
    }
  }

  return {
    user,
    userProfile,
    loading,
    initialize,
    ensureProfile,
    signOut
  }
})
