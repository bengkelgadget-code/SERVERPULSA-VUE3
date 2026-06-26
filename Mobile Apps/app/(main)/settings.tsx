import { View, Text, TouchableOpacity, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../src/store/auth'
import { LogOut, User } from 'lucide-react-native'

export default function Settings() {
  const { user, signOut } = useAuthStore()
  const router = useRouter()

  const handleLogout = () => {
    Alert.alert('Konfirmasi', 'Apakah Anda yakin ingin keluar?', [
      { text: 'Batal', style: 'cancel' },
      { 
        text: 'Keluar', 
        style: 'destructive',
        onPress: async () => {
          await signOut()
          router.replace('/login')
        }
      }
    ])
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-blue-600 p-4 pt-12 flex-row items-center shadow-sm">
        <Text className="text-xl font-bold text-white ml-2">Pengaturan</Text>
      </View>

      <View className="p-4">
        <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex-row items-center mb-6">
          <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mr-4">
            <User color="#2563eb" size={24} />
          </View>
          <View>
            <Text className="font-bold text-gray-800 text-lg">Akun Saya</Text>
            <Text className="text-gray-500">{user?.email}</Text>
          </View>
        </View>

        <TouchableOpacity 
          className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex-row items-center"
          onPress={handleLogout}
        >
          <View className="w-10 h-10 bg-red-100 rounded-full items-center justify-center mr-4">
            <LogOut color="#dc2626" size={20} />
          </View>
          <Text className="font-bold text-red-600 text-base">Keluar</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
