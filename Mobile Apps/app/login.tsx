import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../src/services/supabase'
import { useAuthStore } from '../src/store/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { initialize } = useAuthStore()

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Silakan masukkan email dan password')
      return
    }
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      Alert.alert('Login Gagal', error.message)
      setLoading(false)
    } else if (data.user) {
      // Re-initialize store to fetch user
      await initialize()
      setLoading(false)
      // Wait a bit to let state settle
      setTimeout(() => {
        router.replace('/home')
      }, 100)
    }
  }

  return (
    <View className="flex-1 items-center justify-center p-4 bg-white">
      <View className="w-full max-w-sm space-y-6">
        <View className="items-center mb-8">
          <Text className="text-3xl font-bold text-blue-600">KONTER APP</Text>
          <Text className="text-gray-500 text-sm mt-1">Masuk untuk transaksi pulsa</Text>
        </View>

        <View className="space-y-4">
          <View>
            <Text className="text-sm font-medium mb-1 text-gray-700">Email</Text>
            <TextInput
              className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 focus:border-blue-500"
              placeholder="Masukkan email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <View className="mt-4">
            <Text className="text-sm font-medium mb-1 text-gray-700">Password</Text>
            <TextInput
              className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 focus:border-blue-500"
              placeholder="Masukkan password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>
          
          <TouchableOpacity 
            className={`w-full p-4 rounded-xl items-center mt-8 ${loading ? 'bg-blue-400' : 'bg-blue-600'}`}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-lg">Masuk</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}
