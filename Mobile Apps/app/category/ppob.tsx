import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronLeft, Zap, Droplet, HeartPulse } from 'lucide-react-native'

export default function PPOBMenu() {
  const router = useRouter()

  const subCategories = [
    { name: 'Tagihan Listrik', path: '/category/pln_postpaid', icon: Zap, color: 'bg-yellow-100', iconColor: '#ca8a04' },
    { name: 'Tagihan PDAM', path: '/category/pdam', icon: Droplet, color: 'bg-blue-100', iconColor: '#2563eb' },
    { name: 'BPJS Kesehatan', path: '/category/bpjs', icon: HeartPulse, color: 'bg-green-100', iconColor: '#16a34a' }
  ]

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-blue-600 text-white p-4 pt-12 flex-row items-center shadow-sm">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ChevronLeft color="white" size={28} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">Menu PPOB</Text>
      </View>

      <ScrollView className="p-4 mt-2">
        <View className="flex-row flex-wrap justify-between">
          {subCategories.map((cat) => {
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
      </ScrollView>
    </View>
  )
}
