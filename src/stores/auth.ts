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

  async function fetchProfile(userId: string, _providedToken?: string) {
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
        
        // Fetch Mitra data for both admin and staff
        if (data.mitra_id) {
          try {
            const { data: mitraData, error: mitraError } = await supabase
              .from('mitras')
              .select('*')
              .eq('id', data.mitra_id)
              .single()
              
            if (mitraData && !mitraError) {
              finalData.saldo = mitraData.saldo
              finalData.nama_toko = mitraData.nama_mitra
              finalData.alamat_toko = mitraData.alamat
            }
          } catch (e) {
            console.error('Error fetching mitra data:', e)
          }
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
        setupRealtime(userId, data.mitra_id)
      } else {
        console.log('No profile data returned.')
      }
    } catch (err) {
      console.error('Critical error in fetchProfile:', err)
    }
  }

  function setupRealtime(userId: string, mitraId?: string) {
    if (userSubscription) {
      supabase.removeChannel(userSubscription)
    }

    let channel = supabase.channel('user-profile-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
        (payload) => {
          console.log('User profile updated via realtime:', payload.new)
          // Saldo is now in mitras table, so we don't expect it here
          userProfile.value = { ...userProfile.value, ...payload.new }
        }
      )
      
    // Dengarkan perubahan tabel mitras untuk update saldo dan nama_toko
    if (mitraId) {
      channel = channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mitras', filter: `id=eq.${mitraId}` },
        (payload) => {
          console.log('Mitra profile updated via realtime (syncing balance):', payload.new)
          if (userProfile.value) {
            userProfile.value = { 
              ...userProfile.value, 
              saldo: payload.new.saldo !== undefined ? payload.new.saldo : userProfile.value.saldo,
              nama_toko: payload.new.nama_mitra !== undefined ? payload.new.nama_mitra : userProfile.value.nama_toko,
              alamat_toko: payload.new.alamat !== undefined ? payload.new.alamat : userProfile.value.alamat_toko
            }
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
