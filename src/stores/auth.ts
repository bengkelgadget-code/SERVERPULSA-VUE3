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
      supabase.auth.onAuthStateChange((_event, session) => {
        Promise.resolve().then(async () => {
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
    })
  }

  let adminSubscription: any = null

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
        let finalData = { ...data }
        if (data.role === 'staff' && data.admin_id) {
          const { data: adminData } = await supabase.from('users').select('saldo').eq('id', data.admin_id).single()
          if (adminData) {
            finalData.saldo = adminData.saldo
          }
        }
        console.log('Profile fetched successfully:', finalData.role)
        userProfile.value = finalData
        setupRealtime(userId, data.admin_id)
      } else {
        console.log('No profile data returned.')
      }
    } catch (err) {
      console.error('Critical error in fetchProfile:', err)
    }
  }

  function setupRealtime(userId: string, adminId?: string) {
    if (userSubscription) {
      supabase.removeChannel(userSubscription)
    }
    if (adminSubscription) {
      supabase.removeChannel(adminSubscription)
    }

    userSubscription = supabase.channel('user-profile-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
        (payload) => {
          console.log('User profile updated via realtime:', payload.new)
          if (userProfile.value?.role === 'staff' && adminId) {
            const { saldo, ...rest } = payload.new as any
            userProfile.value = { ...userProfile.value, ...rest }
          } else {
            userProfile.value = { ...userProfile.value, ...payload.new }
          }
        }
      )
      .subscribe()
      
    if (adminId) {
      adminSubscription = supabase.channel('admin-profile-changes')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${adminId}` },
          (payload) => {
             if (userProfile.value) {
                userProfile.value.saldo = (payload.new as any).saldo
             }
          }
        )
        .subscribe()
    }
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
