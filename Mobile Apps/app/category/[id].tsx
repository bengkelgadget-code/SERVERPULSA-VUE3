import { useState, useEffect, useMemo } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useProductsStore } from '../../src/store/products'
import { ChevronLeft, Mic, ScanLine, Contact, X } from 'lucide-react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Speech from 'expo-speech-recognition'
// import * as Contacts from 'expo-contacts' // We'll skip native contacts picker for simplicity unless requested

export default function CategoryInput() {
  const { id: categoryParam } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { products, fetchProducts } = useProductsStore()
  
  const [customerNo, setCustomerNo] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()

  useEffect(() => {
    if (products.length === 0) fetchProducts()
  }, [])

  const getPageTitle = () => {
    if (categoryParam === 'pulsa') return 'Isi Pulsa'
    if (categoryParam === 'data') return 'Paket Data'
    if (categoryParam === 'telpon') return 'Telpon & SMS'
    if (categoryParam === 'pln') return 'Token PLN'
    if (categoryParam === 'pln_postpaid') return 'Tagihan Listrik'
    if (categoryParam === 'pdam') return 'Tagihan PDAM'
    if (categoryParam === 'bpjs') return 'Tagihan BPJS'
    return 'Transaksi'
  }

  const getProvider = (phone: string) => {
    if (!phone || phone.length < 4) return ''
    const prefix = phone.substring(0, 4)
    if (['0811','0812','0813','0821','0822','0823','0852','0853','0851'].includes(prefix)) return 'Telkomsel'
    if (['0814','0815','0816','0855','0856','0857','0858'].includes(prefix)) return 'Indosat'
    if (['0817','0818','0819','0859','0877','0878'].includes(prefix)) return 'XL'
    if (['0838','0831','0832','0833'].includes(prefix)) return 'Axis'
    if (['0895','0896','0897','0898','0899'].includes(prefix)) return 'Tri'
    if (['0881','0882','0883','0884','0885','0886','0887','0888','0889'].includes(prefix)) return 'Smartfren'
    return ''
  }

  const detectedProvider = useMemo(() => {
    if (categoryParam === 'pln') return 'PLN'
    return getProvider(customerNo)
  }, [customerNo, categoryParam])

  const filteredProducts = useMemo(() => {
    const isPpob = ['pdam', 'pln_postpaid', 'bpjs'].includes(categoryParam)
    if (categoryParam !== 'pln' && !isPpob && !detectedProvider) return []

    let result = products.filter(p => {
      let matchesCategory = false
      const catLower = p.category.toLowerCase()
      if (categoryParam === 'pulsa') matchesCategory = catLower.includes('pulsa')
      else if (categoryParam === 'data') matchesCategory = catLower.includes('data') && !catLower.includes('pasca')
      else if (categoryParam === 'telpon') matchesCategory = catLower.includes('telpon') || catLower.includes('sms')
      else if (categoryParam === 'pln') matchesCategory = catLower.includes('pln') && !catLower.includes('pasca')
      else if (categoryParam === 'pdam') matchesCategory = p.brand.toLowerCase().includes('pdam') || catLower.includes('pdam')
      else if (categoryParam === 'pln_postpaid') matchesCategory = (catLower.includes('pln') && catLower.includes('pasca')) || p.brand.toLowerCase().includes('pln pasca')
      else if (categoryParam === 'bpjs') matchesCategory = p.brand.toLowerCase().includes('bpjs') || catLower.includes('bpjs')

      if (!matchesCategory) return false
      if (categoryParam === 'pln' || isPpob) return true
      return p.brand.toLowerCase() === detectedProvider.toLowerCase()
    })

    result.sort((a, b) => (a.harga_jual || 0) - (b.harga_jual || 0))
    return result
  }, [products, categoryParam, detectedProvider])

  const formatRp = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num)
  }

  const startScan = async () => {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission()
      if (!res.granted) {
        Alert.alert('Izin Ditolak', 'Aplikasi butuh akses kamera untuk scan barcode.')
        return
      }
    }
    setIsScanning(true)
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setIsScanning(false)
    setCustomerNo(data.replace(/[^0-9]/g, ''))
  }

  const startSpeech = async () => {
    try {
      const permissions = await Speech.ExpoSpeechRecognition.requestPermissionsAsync();
      if (!permissions.granted) {
        Alert.alert('Izin Ditolak', 'Butuh akses mikrofon untuk input suara.');
        return;
      }
      setIsListening(true);
      Speech.ExpoSpeechRecognition.start({
        lang: 'id-ID',
        interimResults: true,
      });

      Speech.ExpoSpeechRecognition.addListener('result', (event) => {
        const text = event.results[0]?.transcript;
        if (text) {
          setCustomerNo(text.replace(/[^0-9]/g, ''));
        }
      });

      Speech.ExpoSpeechRecognition.addListener('end', () => {
        setIsListening(false);
        Speech.ExpoSpeechRecognition.removeAllListeners();
      });
    } catch (e) {
      console.log(e);
      setIsListening(false);
    }
  }

  const selectProduct = (sku: string) => {
    if (!customerNo) {
      Alert.alert('Error', 'Silakan isi Nomor Handphone atau ID Pelanggan terlebih dahulu!')
      return
    }
    router.push(`/transaction/${sku}?phone=${customerNo}` as any)
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-blue-600 text-white p-4 pt-12 flex-row items-center shadow-sm">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ChevronLeft color="white" size={28} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">{getPageTitle()}</Text>
      </View>

      <ScrollView className="p-4" keyboardShouldPersistTaps="handled">
        <View className="bg-white p-4 rounded-2xl shadow-sm mb-4">
          <Text className="text-xs font-bold text-gray-700 mb-2">
            {categoryParam === 'pln' ? 'Nomor Meter / ID Pelanggan' : 'Nomor Handphone'}
          </Text>
          <TextInput
            className="w-full p-4 text-lg font-bold tracking-wider bg-gray-50 rounded-xl border border-gray-200 focus:border-blue-500"
            placeholder={categoryParam === 'pln' ? '5123xxxxxxx' : '0812xxxxxxx'}
            value={customerNo}
            onChangeText={setCustomerNo}
            keyboardType="number-pad"
          />

          <View className="flex-row items-center gap-2 mt-4 pt-4 border-t border-gray-100">
            <TouchableOpacity 
              onPress={startSpeech}
              className={`flex-1 items-center p-2 rounded-xl ${isListening ? 'bg-red-50' : 'bg-gray-50'}`}
            >
              <Mic color={isListening ? "#dc2626" : "#6b7280"} size={20} />
              <Text className={`text-[10px] font-bold mt-1 ${isListening ? 'text-red-600' : 'text-gray-500'}`}>Suara</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={startScan}
              className="flex-1 items-center p-2 rounded-xl bg-gray-50"
            >
              <ScanLine color="#6b7280" size={20} />
              <Text className="text-[10px] font-bold mt-1 text-gray-500">Scan</Text>
            </TouchableOpacity>
          </View>
        </View>

        {detectedProvider && categoryParam !== 'pln' && (
          <View className="flex-row items-center gap-2 mb-3 px-2">
            <Text className="text-xs font-bold text-gray-500 uppercase">Provider Terdeteksi:</Text>
            <Text className="text-sm font-extrabold text-blue-600">{detectedProvider}</Text>
          </View>
        )}

        {filteredProducts.length > 0 ? (
          <View className="space-y-3 pb-8">
            {filteredProducts.map(product => (
              <TouchableOpacity
                key={product.sku_code}
                onPress={() => selectProduct(product.sku_code)}
                className="bg-white p-4 rounded-xl shadow-sm flex-row justify-between items-center mb-3"
              >
                <View className="flex-1 pr-4">
                  <Text className="font-bold text-gray-800 text-sm mb-1">{product.product_name}</Text>
                  <Text className="text-xs text-gray-500">{product.brand}</Text>
                </View>
                <Text className="font-extrabold text-blue-600">{formatRp(product.harga_jual)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          customerNo.length > 3 && (
            <View className="py-10 items-center">
              <Text className="text-gray-400 font-medium text-sm">Produk tidak ditemukan</Text>
            </View>
          )
        )}
      </ScrollView>

      <Modal visible={isScanning} animationType="slide" onRequestClose={() => setIsScanning(false)}>
        <View className="flex-1 bg-black">
          <View className="absolute top-12 left-4 z-10">
            <TouchableOpacity onPress={() => setIsScanning(false)} className="bg-black/50 p-2 rounded-full">
              <X color="white" size={24} />
            </TouchableOpacity>
          </View>
          {isScanning && (
            <CameraView 
              style={{ flex: 1 }} 
              barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39"] }}
              onBarcodeScanned={handleBarCodeScanned}
            />
          )}
          <View className="absolute bottom-12 self-center bg-black/50 px-6 py-3 rounded-full">
            <Text className="text-white font-bold">Arahkan kamera ke Barcode/QR</Text>
          </View>
        </View>
      </Modal>
    </View>
  )
}
