import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, TextInput } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../src/services/supabase'
import { useAuthStore } from '../../src/store/auth'
import { ChevronLeft, Printer, Share2, Edit2, X } from 'lucide-react-native'
import { BluetoothManager, BluetoothEscposPrinter } from 'react-native-thermal-receipt-printer-image-qr'

export default function Receipt() {
  const { id: transactionId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { userProfile } = useAuthStore()
  
  const [trx, setTrx] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [customHargaJual, setCustomHargaJual] = useState(0)
  const [showEditModal, setShowEditModal] = useState(false)
  const [tempHargaInput, setTempHargaInput] = useState('')

  const [printerConnected, setPrinterConnected] = useState(false)
  const [devices, setDevices] = useState<any[]>([])
  const [showDeviceModal, setShowDeviceModal] = useState(false)

  const storeName = userProfile?.nama_toko || 'KONTER PULSA'
  const storeAddress = userProfile?.alamat_toko || 'Jl. Contoh Alamat No 123'

  useEffect(() => {
    fetchTransaction()
    BluetoothManager.isBluetoothEnabled().then((enabled: boolean) => {
      if(enabled) {
        // init BT connection state
      }
    })
  }, [])

  const fetchTransaction = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*, products(*)')
      .eq('id', transactionId)
      .single()
    
    if (data) {
      setTrx(data)
      setCustomHargaJual(data.harga_jual)
      setTempHargaInput(data.harga_jual.toString())
    }
    setLoading(false)
  }

  const formatRp = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
  }

  const scanPrinters = () => {
    setShowDeviceModal(true)
    BluetoothManager.scanDevice().then((s: any) => {
      let devicesList: any[] = []
      try {
        devicesList = JSON.parse(s)
      } catch (e) {
        devicesList = s
      }
      setDevices(devicesList)
    }).catch((err: any) => {
      Alert.alert('Error', 'Gagal scan bluetooth')
    })
  }

  const connectPrinter = (address: string) => {
    BluetoothManager.connect(address)
      .then((s: any) => {
        setPrinterConnected(true)
        setShowDeviceModal(false)
        Alert.alert('Sukses', 'Printer terhubung!')
      })
      .catch((e: any) => {
        Alert.alert('Gagal', 'Tidak dapat terhubung ke printer')
      })
  }

  const printReceipt = async () => {
    if (!printerConnected) {
      scanPrinters()
      return
    }

    try {
      await BluetoothEscposPrinter.printText(`\r\n\r\n`, {})
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER)
      await BluetoothEscposPrinter.printText(`${storeName}\r\n`, { widthtimes: 1, heigthtimes: 1 })
      await BluetoothEscposPrinter.printText(`${storeAddress}\r\n`, {})
      await BluetoothEscposPrinter.printText(`\r\n`, {})
      
      await BluetoothEscposPrinter.printText(`${formatDate(trx.created_at)} (CU)\r\n\r\n`, {})
      
      const isPln = trx.products?.category?.toLowerCase().includes('pln')
      if (isPln) {
        await BluetoothEscposPrinter.printText(`STRUK PEMBELIAN LISTRIK\r\nPRABAYAR\r\n\r\n`, {})
      } else {
        await BluetoothEscposPrinter.printText(`STRUK PEMBELIAN\r\n${(trx.products?.category || '').toUpperCase()}\r\n\r\n`, {})
      }
      
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT)
      
      const printRow = async (label: string, value: string) => {
        const labelPadded = label.padEnd(12, ' ')
        await BluetoothEscposPrinter.printText(`${labelPadded}: ${value}\r\n`, {})
      }

      if (isPln) {
        await printRow('IDPEL', trx.customer_no)
        await printRow('NOMINAL', formatRp(trx.products?.harga_modal || 0))
        await printRow('BIAYA ADM', formatRp(customHargaJual - (trx.products?.harga_modal || 0)))
        await printRow('TOTAL BAYAR', formatRp(customHargaJual))
        await BluetoothEscposPrinter.printText(`\r\n`, {})
        await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER)
        await BluetoothEscposPrinter.printText(`-- TOKEN --\r\n`, {})
        
        const snParts = trx.sn?.split('/') || []
        const tokenStr = snParts[0] || '-'
        await BluetoothEscposPrinter.printText(`${tokenStr}\r\n`, { widthtimes: 1, heigthtimes: 1 })
        
      } else {
        await printRow('PRODUK', trx.products?.product_name || '')
        await printRow('NO TUJUAN', trx.customer_no)
        await printRow('SN/REF', trx.sn || trx.ref_id || '-')
        await BluetoothEscposPrinter.printText(`\r\n`, {})
        await printRow('TOTAL BAYAR', formatRp(customHargaJual))
      }

      await BluetoothEscposPrinter.printText(`\r\n--------------------------------\r\n`, {})
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER)
      await BluetoothEscposPrinter.printText(`Terima Kasih\r\n\r\n\r\n`, {})

    } catch (e: any) {
      Alert.alert('Error', 'Gagal mencetak: ' + e.message)
    }
  }

  if (loading) return (
    <View className="flex-1 items-center justify-center bg-gray-50">
      <Text>Loading...</Text>
    </View>
  )

  if (!trx) return (
    <View className="flex-1 items-center justify-center bg-gray-50">
      <Text>Transaksi tidak ditemukan</Text>
      <TouchableOpacity onPress={() => router.back()} className="mt-4 p-2 bg-blue-600 rounded">
        <Text className="text-white">Kembali</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <View className="flex-1 bg-gray-100">
      <View className="bg-blue-600 p-4 pt-12 flex-row items-center shadow-sm">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ChevronLeft color="white" size={28} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">Nota Transaksi</Text>
      </View>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ alignItems: 'center' }}>
        <View className="w-full max-w-sm bg-white p-6 shadow-lg border border-gray-200">
          <View className="mb-4 items-center">
            <Text className="text-xl font-bold text-gray-800 text-center uppercase">{storeName}</Text>
            <Text className="text-xs text-gray-500 mt-1 text-center">{storeAddress}</Text>
          </View>

          <View className="text-center mb-4">
            <Text className="text-gray-800 text-xs text-center">{formatDate(trx.created_at)} (CU)</Text>
          </View>

          <View className="text-center mb-4 items-center">
            <Text className="font-bold text-gray-800 uppercase text-sm">
              {trx.products?.category?.toLowerCase().includes('pln') ? 'STRUK PEMBELIAN LISTRIK' : 'STRUK PEMBELIAN'}
            </Text>
            <Text className="font-bold text-gray-800 uppercase text-sm">
              {trx.products?.category?.toLowerCase().includes('pln') ? 'PRABAYAR' : trx.products?.category}
            </Text>
          </View>

          <View className="space-y-1">
            {trx.products?.category?.toLowerCase().includes('pln') ? (
              <>
                <View className="flex-row"><Text className="w-24 text-gray-800 text-xs font-mono">IDPEL</Text><Text className="mr-2">:</Text><Text className="flex-1 text-xs font-mono">{trx.customer_no}</Text></View>
                <View className="flex-row"><Text className="w-24 text-gray-800 text-xs font-mono">NOMINAL</Text><Text className="mr-2">:</Text><Text className="flex-1 text-xs font-mono">{formatRp(trx.products?.harga_modal || 0)}</Text></View>
                <View className="flex-row"><Text className="w-24 text-gray-800 text-xs font-mono">BIAYA ADM</Text><Text className="mr-2">:</Text><Text className="flex-1 text-xs font-mono">{formatRp(customHargaJual - (trx.products?.harga_modal || 0))}</Text></View>
              </>
            ) : (
              <>
                <View className="flex-row"><Text className="w-24 text-gray-800 text-xs font-mono">PRODUK</Text><Text className="mr-2">:</Text><Text className="flex-1 text-xs font-mono">{trx.products?.product_name}</Text></View>
                <View className="flex-row"><Text className="w-24 text-gray-800 text-xs font-mono">NO TUJUAN</Text><Text className="mr-2">:</Text><Text className="flex-1 text-xs font-mono">{trx.customer_no}</Text></View>
                <View className="flex-row"><Text className="w-24 text-gray-800 text-xs font-mono">SN/REF</Text><Text className="mr-2">:</Text><Text className="flex-1 text-xs font-mono">{trx.sn || trx.ref_id || '-'}</Text></View>
              </>
            )}

            <TouchableOpacity 
              onPress={() => setShowEditModal(true)}
              className="flex-row mt-2 font-bold p-1 -m-1 rounded bg-gray-50 items-center"
            >
              <Text className="w-24 text-gray-800 text-xs font-mono font-bold">TOTAL BAYAR</Text>
              <Text className="mr-2">:</Text>
              <Text className="flex-1 text-xs font-mono font-bold flex-row items-center">
                {formatRp(customHargaJual)} <Edit2 color="#9ca3af" size={12} style={{marginLeft: 4}} />
              </Text>
            </TouchableOpacity>
          </View>

          {trx.products?.category?.toLowerCase().includes('pln') && (
            <View className="items-center mt-6 mb-6">
              <Text className="mb-2 text-xs font-mono">-- TOKEN --</Text>
              <Text className="font-bold text-xl tracking-widest text-gray-800 text-center font-mono">
                {trx.sn?.split('/')[0] || '-'}
              </Text>
            </View>
          )}

          <View className="items-center mt-6 border-t border-dashed border-gray-400 pt-4">
            <Text className="text-xs text-gray-800 font-mono text-center">Terima Kasih</Text>
          </View>
        </View>

        <View className="w-full max-w-sm mt-6 space-y-3 pb-8">
          <TouchableOpacity 
            onPress={printReceipt}
            className="w-full bg-blue-600 flex-row justify-center items-center py-3.5 rounded-xl mb-3"
          >
            <Printer color="white" size={20} />
            <Text className="text-white font-bold ml-2">Cetak / Print</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => router.push('/history' as any)}
            className="w-full bg-white border border-gray-200 flex-row justify-center items-center py-3.5 rounded-xl"
          >
            <Text className="text-gray-700 font-bold">Kembali ke Riwayat</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Harga Modal */}
      <Modal visible={showEditModal} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-white w-full max-w-sm rounded-2xl p-5">
            <Text className="font-bold text-lg mb-4">Ubah Total Bayar</Text>
            <TextInput
              className="w-full border border-gray-300 rounded-xl p-3 text-lg font-bold mb-4"
              keyboardType="number-pad"
              value={tempHargaInput}
              onChangeText={(text) => setTempHargaInput(text.replace(/[^0-9]/g, ''))}
            />
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setShowEditModal(false)} className="flex-1 bg-gray-100 p-3 rounded-xl items-center">
                <Text className="font-bold text-gray-700">Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => {
                  setCustomHargaJual(parseInt(tempHargaInput) || 0)
                  setShowEditModal(false)
                }} 
                className="flex-1 bg-blue-600 p-3 rounded-xl items-center"
              >
                <Text className="font-bold text-white">Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Printer Selection Modal */}
      <Modal visible={showDeviceModal} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-2xl p-5 min-h-[50%] max-h-[80%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="font-bold text-lg">Pilih Printer</Text>
              <TouchableOpacity onPress={() => setShowDeviceModal(false)}>
                <X color="#4b5563" size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {devices.length === 0 ? (
                <Text className="text-center text-gray-500 py-4">Mencari printer...</Text>
              ) : (
                devices.map((device, index) => (
                  <TouchableOpacity 
                    key={index}
                    onPress={() => connectPrinter(device.address)}
                    className="p-4 border-b border-gray-100"
                  >
                    <Text className="font-bold">{device.name || 'Unknown Device'}</Text>
                    <Text className="text-xs text-gray-500">{device.address}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}
