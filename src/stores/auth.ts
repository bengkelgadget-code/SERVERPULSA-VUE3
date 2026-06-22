import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<any>(null)
  const userProfile = ref<any>(null)
  const loading = ref(true)
  const isInitialized = ref(false)
  let userSubscription: any = null

  let authSubscription: any = null
  let initPromise: Promise<boolean> | null = null

  async function initialize() {
    if (isInitialized.value) return true
    if (initPromise) return initPromise

    initPromise = new Promise((resolve) => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        Promise.resolve().then(async () => {
          try {
            user.value = session?.user || null
            if (user.value) {
              await fetchProfile(user.value.id, session?.access_token)
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
      authSubscription = subscription
    })
  }

  async function fetchProfile(userId: string, providedToken?: string) {
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
          try {
            // Use provided token first, fallback to getSession()
            let token = providedToken
            if (!token) {
              const { data: sessionData } = await supabase.auth.getSession()
              token = sessionData.session?.access_token
            }
            if (!token) {
              throw new Error('No auth token available — cannot fetch admin balance')
            }
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/get-admin-balance`, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) {
              throw new Error(`API returned HTTP ${res.status}`)
            }
            const resData = await res.json()
            if (resData.success) {
              finalData.saldo = resData.saldo
            } else {
              throw new Error(`API returned success=false: ${resData.error || 'unknown'}`)
            }
          } catch (e) {
            console.error('Error fetching admin balance via API, using fallback:', e)
            // Fallback: Try to query directly if RLS allows or we just get what we can
            const { data: adminData } = await supabase
              .from('users')
              .select('saldo')
              .eq('id', data.admin_id)
              .single()
              
            if (adminData && adminData.saldo !== undefined) {
              finalData.saldo = adminData.saldo
            }
          }
        }
        const { data: userData } = await supabase.auth.getUser()
        if (userData?.user?.user_metadata) {
          if (userData.user.user_metadata.nama_toko) finalData.nama_toko = userData.user.user_metadata.nama_toko
          if (userData.user.user_metadata.alamat_toko) finalData.alamat_toko = userData.user.user_metadata.alamat_toko
        }

        // Overwrite nama_toko if local setting exists
        const customNamaToko = localStorage.getItem('custom_nama_toko')
        if (customNamaToko) {
          finalData.nama_toko = customNamaToko
        }
        const customAlamatToko = localStorage.getItem('custom_alamat_toko')
        if (customAlamatToko) {
          finalData.alamat_toko = customAlamatToko
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

    let channel = supabase.channel('user-profile-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
        (payload) => {
          console.log('User profile updated via realtime:', payload.new)
          if (userProfile.value?.role === 'staff') {
            const { saldo, ...rest } = payload.new as any
            userProfile.value = { ...userProfile.value, ...rest }
          } else {
            userProfile.value = { ...userProfile.value, ...payload.new }
          }
        }
      )
      
    // Jika staff, dengarkan juga perubahan tabel admin untuk update saldo
    if (adminId) {
      channel = channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${adminId}` },
        (payload) => {
          console.log('Admin profile updated via realtime (syncing balance):', payload.new)
          if (userProfile.value && payload.new.saldo !== undefined) {
            userProfile.value = { ...userProfile.value, saldo: payload.new.saldo }
          }
        }
      )
    }

    userSubscription = channel.subscribe()
  }

  async function ensureProfile() {
    if (userProfile.value) return userProfile.value
    if (user.value) {
      const { data: sessionData } = await supabase.auth.getSession()
      await fetchProfile(user.value.id, sessionData.session?.access_token)
      return userProfile.value
    }
    return null
  }

  async function signOut() {
    if (authSubscription) {
      authSubscription.unsubscribe()
      authSubscription = null
    }
    localStorage.removeItem('lastVisitedAdminRoute')
    
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
    fetchProfile,
    signOut
  }
})
