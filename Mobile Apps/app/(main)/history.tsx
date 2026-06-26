import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Modal } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../src/store/auth'
import { supabase } from '../../src/services/supabase'
import { ChevronLeft, X, Printer, Share2 } from 'lucide-react-native'

export default function History() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTrx, setSelectedTrx] = useState<any>(null)

  const fetchHistory = async () => {
    if (!user) return
    setLoading(true)
    
    // In React Native Supabase we might need to join differently, but we'll try the same syntax
    const { data } = await supabase
      .from('transactions')
      .select('*, products(product_name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      
    if (data) setTransactions(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchHistory()
  }, [user])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchHistory()
    setRefreshing(false)
  }, [user])

  const formatRp = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num)
  }

  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getDate()}/${d.getMonth()+1} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
  }
  
  const formatDateFull = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit' })}`
  }

  const getStatusStyle = (status: string) => {
    if (status === 'sukses') return { text: 'text-green-700', bg: 'bg-green-100', dot: 'bg-green-500' }
    if (status === 'gagal') return { text: 'text-red-700', bg: 'bg-red-100', dot: 'bg-red-500' }
    if (status === 'proses') return { text: 'text-blue-700', bg: 'bg-blue-100', dot: 'bg-blue-500' }
    return { text: 'text-yellow-700', bg: 'bg-yellow-100', dot: 'bg-yellow-500' }
  }

  const renderItem = ({ item }: { item: any }) => {
    const statusStyle = getStatusStyle(item.status)
    return (
      <TouchableOpacity 
        className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex-row items-center justify-between mb-3"
        onPress={() => setSelectedTrx(item)}
      >
        <View className="flex-row items-center flex-1 pr-2">
          <View className={`w-1.5 h-10 rounded-full mr-3 ${statusStyle.dot}`} />
          <View className="flex-1">
            <Text className="font-bold text-sm text-gray-800" numberOfLines={1}>
              {item.products?.product_name || item.sku_code}
            </Text>
            <Text className="text-xs text-gray-500 mt-1">
              {item.customer_no} • {formatDateShort(item.created_at)}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="font-bold text-sm text-blue-600">{formatRp(item.harga_jual)}</Text>
          <View className={`px-2 py-0.5 rounded mt-1 ${statusStyle.bg}`}>
            <Text className={`text-[10px] font-bold uppercase tracking-wider ${statusStyle.text}`}>
              {item.status}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-blue-600 p-4 pt-12 flex-row items-center shadow-sm">
        <Text className="text-xl font-bold text-white ml-2">Riwayat Transaksi</Text>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
        ListEmptyComponent={
          <View className="py-10 items-center">
            <Text className="text-gray-400">Belum ada riwayat transaksi</Text>
          </View>
        }
      />

      <Modal
        visible={!!selectedTrx}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTrx(null)}
      >
        <View className="flex-1 justify-center items-center bg-black/60 p-4">
          <View className="bg-white w-full max-w-sm rounded-2xl overflow-hidden">
            <View className="bg-gray-50 border-b border-gray-100 p-4 flex-row justify-between items-center">
              <Text className="font-bold text-gray-800 text-xl">Detail Transaksi</Text>
              <TouchableOpacity onPress={() => setSelectedTrx(null)} className="p-2 bg-gray-200 rounded-full">
                <X color="#4b5563" size={20} />
              </TouchableOpacity>
            </View>

            {selectedTrx && (
              <ScrollView className="p-5 max-h-[70vh]">
                <View className="items-center mb-6">
                  <Text className="text-sm text-gray-500 mb-2">Status Transaksi</Text>
                  <View className={`px-3 py-1 rounded-full ${getStatusStyle(selectedTrx.status).bg}`}>
                    <Text className={`font-bold uppercase tracking-wider ${getStatusStyle(selectedTrx.status).text}`}>
                      {selectedTrx.status}
                    </Text>
                  </View>
                </View>

                <View className="space-y-4">
                  <View>
                    <Text className="text-sm text-gray-500 mb-1">Produk</Text>
                    <Text className="font-bold text-gray-800">{selectedTrx.products?.product_name}</Text>
                  </View>
                  <View className="mt-4">
                    <Text className="text-sm text-gray-500 mb-1">Tujuan / Nomor</Text>
                    <Text className="font-medium text-gray-800">{selectedTrx.customer_no}</Text>
                  </View>
                  <View className="mt-4">
                    <Text className="text-sm text-gray-500 mb-1">SN / Ref ID</Text>
                    <Text className="font-mono text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                      {selectedTrx.sn || selectedTrx.ref_id || '-'}
                    </Text>
                  </View>
                  <View className="flex-row justify-between items-center pt-4 mt-4 border-t border-dashed border-gray-200">
                    <Text className="text-gray-500">Total Harga</Text>
                    <Text className="font-bold text-blue-600 text-lg">{formatRp(selectedTrx.harga_jual)}</Text>
                  </View>
                  <View className="flex-row justify-between items-center mt-2">
                    <Text className="text-gray-500">Tanggal</Text>
                    <Text className="text-gray-800 font-medium">{formatDateFull(selectedTrx.created_at)}</Text>
                  </View>
                </View>

                <View className="flex-row gap-3 mt-8">
                  <TouchableOpacity 
                    className="flex-1 flex-row justify-center items-center bg-blue-600 px-4 py-3 rounded-xl"
                    onPress={() => {
                      setSelectedTrx(null);
                      router.push(`/receipt/${selectedTrx.id}` as any);
                    }}
                  >
                    <Printer color="white" size={18} />
                    <Text className="text-white font-semibold ml-2">Cetak</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    className="flex-1 flex-row justify-center items-center bg-blue-50 border border-blue-100 px-4 py-3 rounded-xl"
                  >
                    <Share2 color="#2563eb" size={18} />
                    <Text className="text-blue-600 font-semibold ml-2">Kirim</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}
