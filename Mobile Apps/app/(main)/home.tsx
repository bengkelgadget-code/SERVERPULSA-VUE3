import { useState, useCallback, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../src/store/auth'
import { supabase } from '../../src/services/supabase'
import { Smartphone, Zap, Wallet, Wifi, Phone, CreditCard } from 'lucide-react-native'

export default function Home() {
  const { user, session } = useAuthStore()
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const [profile, setProfile] = useState<any>(null)

  const fetchProfile = async () => {
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (data) setProfile(data)
  }

  useEffect(() => {
    fetchProfile()
  }, [user])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchProfile()
    setRefreshing(false)
  }, [user])

  const formatRp = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num)
  }

  const categories = [
    { name: 'Pulsa', path: '/category/pulsa', icon: Smartphone, color: 'bg-blue-100', iconColor: '#2563eb' },
    { name: 'Token PLN', path: '/category/pln', icon: Zap, color: 'bg-yellow-100', iconColor: '#ca8a04' },
    { name: 'E-Wallet', path: '/category/ewallet', icon: Wallet, color: 'bg-green-100', iconColor: '#16a34a' },
    { name: 'Data', path: '/category/data', icon: Wifi, color: 'bg-purple-100', iconColor: '#9333ea' },
    { name: 'Telpon & SMS', path: '/category/telpon', icon: Phone, color: 'bg-rose-100', iconColor: '#e11d48' },
    { name: 'PPOB', path: '/category/ppob', icon: CreditCard, color: 'bg-orange-100', iconColor: '#ea580c' }
  ]

  return (
    <ScrollView 
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
      }
    >
      <View className="bg-blue-600 px-5 pt-12 pb-6 rounded-b-3xl shadow-sm">
        <View className="mb-5">
          <Text className="text-white text-sm opacity-80">Selamat datang,</Text>
          <Text className="text-white text-xl font-bold">{profile?.nama_toko || user?.email}</Text>
        </View>

        <View className="bg-white/20 p-4 rounded-xl border border-white/20">
          <Text className="text-white text-xs opacity-90 font-bold mb-1">Saldo Deposit</Text>
          <Text className="text-white text-3xl font-extrabold tracking-tight">
            {formatRp(profile?.saldo || 0)}
          </Text>
        </View>
      </View>

      <View className="px-5 mt-6 mb-8">
        <Text className="font-bold text-lg text-gray-800 mb-4">Layanan Kami</Text>

        <View className="flex-row flex-wrap justify-between">
          {categories.map((cat) => {
            const IconComponent = cat.icon
            return (
              <TouchableOpacity
                key={cat.name}
                className="items-center w-[30%] mb-6"
                onPress={() => router.push(cat.path as any)}
                activeOpacity={0.7}
              >
                <View className={`w-16 h-16 rounded-2xl items-center justify-center mb-2 shadow-sm ${cat.color}`}>
                  <IconComponent color={cat.iconColor} size={28} />
                </View>
                <Text className="text-xs font-semibold text-gray-700 text-center">{cat.name}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    </ScrollView>
  )
}
