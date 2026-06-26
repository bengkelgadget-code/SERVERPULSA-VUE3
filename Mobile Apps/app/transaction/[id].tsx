import { useState, useEffect, useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useProductsStore } from '../../src/store/products'
import { useAuthStore } from '../../src/store/auth'
import { supabase } from '../../src/services/supabase'
import { ChevronLeft, Box, CheckCircle2 } from 'lucide-react-native'

export default function Transaction() {
  const { id: sku, phone, name } = useLocalSearchParams<{ id: string, phone: string, name?: string }>()
  const router = useRouter()
  const { products } = useProductsStore()
  const { user, session } = useAuthStore()

  const [customerName, setCustomerName] = useState(name || '')
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [selectedPayment, setSelectedPayment] = useState('saldo')
  const [profile, setProfile] = useState<any>(null)

  // Pasca states
  const [pascaRefId, setPascaRefId] = useState('')
  const [pascaAmount, setPascaAmount] = useState(0)
  const [pascaAdmin, setPascaAdmin] = useState(0)
  const [isPascaInquiryDone, setIsPascaInquiryDone] = useState(false)

  const product = useMemo(() => products.find(p => p.sku_code === sku), [products, sku])
  const isPasca = useMemo(() => product?.category?.toLowerCase().includes('pasca') || false, [product])

  const adminFee = selectedPayment === 'qris' ? 1500 : 0
  const totalPrice = isPasca ? pascaAmount + adminFee : (product?.harga_jual || 0) + adminFee

  const formatRp = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num)
  }

  useEffect(() => {
    fetchProfile()
    if (isPasca && phone) inquiryPasca()
    else if (product?.category?.toLowerCase().includes('pln') && !isPasca && !customerName && phone && phone.length >= 11) {
      checkPLN()
    }
  }, [])

  const fetchProfile = async () => {
    if (!user) return
    const { data } = await supabase.from('profiles').select('saldo').eq('id', user.id).single()
    if (data) setProfile(data)
  }

  const checkPLN = async () => {
    if (!phone || phone.length < 11) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/api/inquiry-pln`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ customer_no: phone })
      })
      const data = await res.json()
      if (data.success && data.name) {
        setCustomerName(data.segment_power ? `${data.name} / ${data.segment_power}` : data.name)
      }
    } catch (e) {
      console.log(e)
    }
  }

  const inquiryPasca = async () => {
    if (!phone) return
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/api/inquiry-pasca`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ customer_no: phone, sku_code: sku })
      })
      const data = await res.json()
      if (data.success) {
        setCustomerName(data.name || '-')
        setPascaAmount(data.amount)
        setPascaAdmin(data.admin)
        setPascaRefId(data.ref_id)
        setIsPascaInquiryDone(true)
        if (data.amount === 0) setErrorMsg('Tagihan sudah lunas atau tidak ditemukan.')
      } else {
        setErrorMsg(data.message || 'Gagal mengecek tagihan')
      }
    } catch (e) {
      setErrorMsg('Gagal terhubung ke server')
    } finally {
      setLoading(false)
    }
  }

  const buyProduct = async () => {
    if (isSubmitting) return

    if (selectedPayment === 'saldo') {
      const currentSaldo = profile?.saldo || 0
      if (currentSaldo < totalPrice) {
        Alert.alert('Saldo Tidak Cukup', `Sisa saldo: ${formatRp(currentSaldo)}\nButuh: ${formatRp(totalPrice)}`)
        return
      }
    }

    Alert.alert(
      'Konfirmasi Pembelian',
      `Produk: ${product?.product_name}\nNomor: ${phone}\nHarga: ${formatRp(totalPrice)}\nMetode: ${selectedPayment === 'saldo' ? 'Saldo Aplikasi' : 'QRIS'}`,
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Lanjutkan',
          onPress: processTransaction
        }
      ]
    )
  }

  const processTransaction = async () => {
    setIsSubmitting(true)
    setErrorMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/api/mobile/transaction/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ 
          customer_no: phone, 
          sku_code: sku, 
          payment_method: selectedPayment,
          customer_name: customerName,
          ...(isPasca ? { pasca_ref_id: pascaRefId, pasca_amount: pascaAmount } : {})
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        Alert.alert('Gagal', data.error || 'Gagal melakukan transaksi')
        setErrorMsg(data.error || 'Gagal melakukan transaksi')
      } else {
        // Refresh saldo
        fetchProfile()
        if (['pending', 'proses'].includes(data.status?.toLowerCase())) {
          router.replace('/history' as any)
        } else {
          router.replace(`/receipt/${data.transactionId}` as any)
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Terjadi kesalahan jaringan')
      setErrorMsg(e.message || 'Terjadi kesalahan jaringan')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!product) return null

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-blue-600 text-white p-4 pt-12 flex-row items-center shadow-sm">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ChevronLeft color="white" size={28} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">Checkout Pembayaran</Text>
      </View>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Info Tujuan */}
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
          <Text className="text-xs font-bold text-gray-500 uppercase mb-3">Informasi Tujuan</Text>
          <View className="space-y-3">
            <View>
              <Text className="text-[10px] text-gray-400 font-medium">Nomor Tujuan</Text>
              <Text className="font-bold text-gray-800 text-base">{phone}</Text>
            </View>
            {customerName ? (
              <View className="mt-2">
                <Text className="text-[10px] text-gray-400 font-medium">Nama Pelanggan/Akun</Text>
                <Text className="font-bold text-gray-800 text-sm">{customerName}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Detail Produk */}
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
          <Text className="text-xs font-bold text-gray-500 uppercase mb-3">Detail Pembelian</Text>
          
          <View className="flex-row items-center mb-3">
            <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center mr-3">
              <Box color="#2563eb" size={20} />
            </View>
            <View className="flex-1">
              <Text className="font-bold text-sm text-gray-800">{product.product_name}</Text>
              <Text className="text-xs text-gray-500 mt-1">{product.brand}</Text>
            </View>
          </View>
          
          <View className="h-[1px] bg-gray-200 border-dashed my-3" />
          
          <View className="space-y-2">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-gray-500">{isPasca ? 'Tagihan/Nominal' : 'Harga Produk'}</Text>
              <Text className="text-sm font-semibold text-gray-800">
                {formatRp(isPasca ? pascaAmount - pascaAdmin : product.harga_jual)}
              </Text>
            </View>
            {isPasca && (
              <View className="flex-row justify-between items-center mt-2">
                <Text className="text-sm text-gray-500">Admin Provider</Text>
                <Text className="text-sm font-semibold text-gray-800">{formatRp(pascaAdmin)}</Text>
              </View>
            )}
            <View className="flex-row justify-between items-center mt-2">
              <Text className="text-sm text-gray-500">Biaya Aplikasi</Text>
              <Text className="text-sm font-semibold text-gray-800">{adminFee === 0 ? 'Gratis' : formatRp(adminFee)}</Text>
            </View>
          </View>
          
          <View className="h-[1px] bg-gray-200 border-dashed my-3" />
          
          <View className="flex-row justify-between items-center">
            <Text className="font-bold text-gray-800">Total Pembayaran</Text>
            <Text className="font-extrabold text-blue-600 text-lg">{formatRp(totalPrice)}</Text>
          </View>
        </View>

        {/* Metode Pembayaran */}
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
          <Text className="text-xs font-bold text-gray-500 uppercase mb-3">Pilih Pembayaran</Text>
          
          <TouchableOpacity 
            onPress={() => setSelectedPayment('saldo')}
            className={`flex-row p-3 rounded-xl border-2 mb-3 items-center ${selectedPayment === 'saldo' ? 'border-blue-500 bg-blue-50' : 'border-gray-100'}`}
          >
            <View className="flex-1 ml-2">
              <View className="flex-row justify-between items-center">
                <Text className="font-bold text-sm text-gray-800">Saldo Aplikasi</Text>
                <View className="bg-white px-2 py-0.5 rounded-full border border-blue-200">
                  <Text className="text-[10px] font-bold text-blue-600">Sisa: {formatRp(profile?.saldo || 0)}</Text>
                </View>
              </View>
              <Text className="text-[10px] text-gray-500 mt-1">Potong dari saldo deposit</Text>
            </View>
            {selectedPayment === 'saldo' && <CheckCircle2 color="#2563eb" size={20} />}
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setSelectedPayment('qris')}
            className={`flex-row p-3 rounded-xl border-2 items-center ${selectedPayment === 'qris' ? 'border-blue-500 bg-blue-50' : 'border-gray-100'}`}
          >
            <View className="flex-1 ml-2">
              <Text className="font-bold text-sm text-gray-800">QRIS</Text>
              <Text className="text-[10px] text-gray-500 mt-1">Bayar pakai E-Wallet/M-Banking</Text>
            </View>
            {selectedPayment === 'qris' && <CheckCircle2 color="#2563eb" size={20} />}
          </TouchableOpacity>
        </View>

        {errorMsg ? (
          <View className="bg-red-50 p-3 rounded-xl border border-red-100 items-center">
            <Text className="text-xs font-semibold text-red-600">{errorMsg}</Text>
          </View>
        ) : null}

        {loading && (
          <View className="items-center p-4">
            <ActivityIndicator size="small" color="#2563eb" />
            <Text className="text-xs text-gray-500 mt-2">Mengecek data...</Text>
          </View>
        )}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-100 pb-8">
        <TouchableOpacity 
          onPress={buyProduct}
          disabled={loading || isSubmitting || !phone || (isPasca && (!isPascaInquiryDone || pascaAmount === 0))}
          className={`flex-row justify-between items-center px-4 py-3.5 rounded-xl ${
            (loading || isSubmitting || !phone || (isPasca && (!isPascaInquiryDone || pascaAmount === 0))) ? 'bg-gray-300' : 'bg-blue-600'
          }`}
        >
          <View>
            <Text className="text-[10px] font-medium text-white/80">Total Bayar</Text>
            <Text className="text-sm font-extrabold text-white">{formatRp(totalPrice)}</Text>
          </View>
          <View className="flex-row items-center">
            {isSubmitting ? (
              <ActivityIndicator color="white" size="small" className="mr-2" />
            ) : null}
            <Text className="text-white font-bold">{isSubmitting ? 'Memproses...' : 'Bayar Sekarang'}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  )
}
