<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { usePrinterStore } from '@/stores/printer'
import { useAuthStore } from '@/stores/auth'
import { useBluetooth } from '@/composables/useBluetooth'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'

const route = useRoute()
const router = useRouter()
const printerStore = usePrinterStore()
const authStore = useAuthStore()
const bluetooth = useBluetooth()
const transactionId = route.params.id as string

const isNative = Capacitor.getPlatform() !== 'web'

const storeName = computed(() => {
  return authStore.userProfile?.nama_toko 
    || localStorage.getItem('custom_nama_toko') 
    || 'KONTER PULSA'
})

const loading = ref(true)
const trx = ref<any>(null)
const customHargaJual = ref(0)
const showEditModal = ref(false)
const tempHargaJualDisplay = ref('')

const openEditModal = () => {
  tempHargaJualDisplay.value = new Intl.NumberFormat('id-ID').format(customHargaJual.value).replace(/[\u00A0\u202F]/g, ' ')
  showEditModal.value = true
}

const onHargaJualInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  let val = target.value.replace(/\D/g, '')
  if (!val) val = '0'
  tempHargaJualDisplay.value = new Intl.NumberFormat('id-ID').format(parseInt(val, 10)).replace(/[\u00A0\u202F]/g, ' ')
}

const saveHargaJual = () => {
  const numericVal = parseInt(tempHargaJualDisplay.value.replace(/\D/g, ''), 10)
  if (!isNaN(numericVal)) {
    customHargaJual.value = numericVal
  }
  showEditModal.value = false
}

const isShareMode = computed(() => route.query.share === 'true')

const fetchTransaction = async () => {
  loading.value = true
  const { data } = await supabase
    .from('transactions')
    .select('*, products(*)')
    .eq('id', transactionId)
    .single()
  
  if (data) {
    const user = authStore.user
    const profile = authStore.userProfile

    const isOwner = data.user_id === user?.id
    const isStaffWhoMadeIt = data.staff_id === user?.id
    const isAdmin = profile?.role === 'superadmin' || profile?.role === 'admin'
    const isStaffUnderAdmin = profile?.role === 'staff' && profile?.admin_id === data.user_id

    if (!isOwner && !isStaffWhoMadeIt && !isAdmin && !isStaffUnderAdmin) {
      alert('Unauthorized access to receipt')
      router.push('/')
      return
    }
    trx.value = data
    customHargaJual.value = data.harga_jual
  } else {
    alert('Transaction not found')
    router.push('/')
  }
  loading.value = false
}

onMounted(() => {
  fetchTransaction()
  if (route.query.share === 'true') {
    setTimeout(() => {
      showShareModal.value = true
    }, 800)
  }
})

import { formatRp as baseFormatRp } from '@/utils/format'
const formatRp = (val: number) => {
  return baseFormatRp(val).replace('Rp', 'RP.')
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`
}

const isPln = computed(() => {
  return trx.value?.products?.category?.toLowerCase().includes('pln') || false
})

// Parse PLN data from Digiflazz SN format: TOKEN/NAMA/TARIF/DAYA/KWH
const plnData = computed(() => {
  if (!isPln.value || !trx.value?.sn) return null
  
  const snParts = trx.value.sn.split('/')
  let token = snParts[0] || '-'
  if (token.length >= 16 && !token.includes('-')) {
    token = token.match(/.{1,4}/g)?.join('-') || token
  }
  
  return {
    token: token,
    nama: snParts[1] || '-',
    tarif: snParts[2] || '-',
    daya: snParts[3] || '-',
    kwh: snParts[4] || '-',
  }
})

// Parse SN/REF data into structured parts for clean display
const snParts = computed(() => {
  const raw = trx.value?.sn || trx.value?.ref_id || ''
  const result: { label: string; value: string }[] = []

  // Try to parse "A/N name | SN: sn_value" format
  if (raw.includes('A/N ') && raw.includes(' | SN: ')) {
    const parts = raw.split(' | SN: ')
    const name = parts[0].replace('A/N ', '')
    result.push({ label: 'NAMA', value: name })
    if (parts[1]) result.push({ label: 'SN', value: parts[1] })
  }
  // Try to parse "Nama: x, No: y, Reff: z" format
  else if (raw.includes('Nama:') && raw.includes('Reff:')) {
    const namaMatch = raw.match(/Nama:\s*([^,]+)/)
    const noMatch = raw.match(/No:\s*([^,]+)/)
    const reffMatch = raw.match(/Reff:\s*(.+)/)
    if (namaMatch) result.push({ label: 'NAMA', value: namaMatch[1].trim() })
    if (noMatch) result.push({ label: 'NO', value: noMatch[1].trim() })
    if (reffMatch) result.push({ label: 'REFF', value: reffMatch[1].trim() })
  }
  // Fallback: show raw as single line
  else {
    result.push({ label: 'SN / REF', value: raw })
  }
  
  return result
})

// Truncate long values (e.g. REFF) for display
const truncateVal = (val: string, max = 30) => {
  if (!val) return '-'
  return val.length > max ? val.substring(0, max) + '...' : val
}

const printReceipt = async () => {
  if (!trx.value) return
  
  if (isNative) {
    if (!printerStore.connectedAddress) {
      alert('Printer Bluetooth belum dihubungkan. Silakan hubungkan printer di menu Pengaturan terlebih dahulu.')
      return
    }
    
    printerStore.isConnected = true
    try {
      await bluetooth.connect(printerStore.connectedAddress)
      
      const lines = await buildReceiptLines()
      const text = bluetooth.formatLines(lines)
      
      const success = await bluetooth.print(text)
      if (!success) {
        alert('Gagal mencetak. Pastikan printer menyala dan terjangkau.')
      }
    } catch (e: any) {
      console.error('Bluetooth print error:', e)
      alert('Gagal menyambung ke printer: ' + (e.message || e))
    }
  } else {
    // On web: use browser print
    window.print()
  }
}

const showShareModal = ref(false)
const isSharing = ref(false)

const buildReceiptLines = async () => {
  const fontTitle = 'bold 20px monospace'
  const fontSmall = '15px monospace'
  const lines: { text: string; bold?: boolean; center?: boolean; font?: string }[] = []
  
  const authStore = (await import('@/stores/auth')).useAuthStore()
  let storeName = authStore.userProfile?.nama_toko 
    || localStorage.getItem('custom_nama_toko') 
    || 'KONTER PULSA'
  storeName = storeName.toUpperCase()

  let finalStoreNameFont = fontTitle
  if (storeName.length > 20) {
    finalStoreNameFont = fontSmall
  } else if (storeName.length > 14) {
    finalStoreNameFont = 'bold 17px monospace'
  }

  lines.push({ text: storeName, bold: true, center: true, font: finalStoreNameFont })
  lines.push({ text: `${formatDate(trx.value.created_at)} (CU)`, center: true })
  lines.push({ text: '' })
  
  if (isPln.value) {
    lines.push({ text: 'STRUK PEMBELIAN LISTRIK', bold: true, center: true })
    lines.push({ text: 'PRABAYAR', bold: true, center: true })
  } else {
    lines.push({ text: 'STRUK PEMBELIAN', bold: true, center: true })
    lines.push({ text: (trx.value.products?.category || '').toUpperCase(), bold: true, center: true })
  }
  lines.push({ text: '' })
  
  const addRow = (label: string, value: string, bold = false) => {
    const maxValLen = 18
    if (value.length > maxValLen) {
      lines.push({ text: `${label.padEnd(12)}: ${value.substring(0, maxValLen)}`, bold })
      let remaining = value.substring(maxValLen)
      while (remaining.length > 0) {
        lines.push({ text: `              ${remaining.substring(0, maxValLen)}`, bold })
        remaining = remaining.substring(maxValLen)
      }
    } else {
      lines.push({ text: `${label.padEnd(12)}: ${value}`, bold })
    }
  }
  
  if (isPln.value) {
    addRow('IDPEL', trx.value.customer_no)
    addRow('NAMA', plnData.value?.nama || '-')
    addRow('TRF/DAYA', `${plnData.value?.tarif || '-'}/${plnData.value?.daya || '-'}`)
    addRow('NOMINAL', formatRp(trx.value.products?.harga_modal || 0))
    addRow('PPN', 'RP. 0,00')
    addRow('ANGS/MAT', 'RP. 0,00/0,00')
    addRow('RP TOKEN', formatRp(trx.value.products?.harga_modal || 0))
    addRow('JML KWH', plnData.value?.kwh || '-')
    addRow('BIAYA ADM', formatRp(customHargaJual.value - (trx.value.products?.harga_modal || 0)))
    addRow('TOTAL BAYAR', formatRp(customHargaJual.value), true)
  } else {
    addRow('PRODUK', trx.value.products?.product_name || '')
    addRow('NO TUJUAN', trx.value.customer_no)
    if (trx.value.customer_name) {
      addRow('NAMA AKUN', trx.value.customer_name)
    }
    for (const part of snParts.value) {
      addRow(part.label, part.value)
    }
    lines.push({ text: '' })
    addRow('TOTAL BAYAR', formatRp(customHargaJual.value), true)
  }
  
  if (isPln.value && plnData.value) {
    lines.push({ text: '' })
    lines.push({ text: '-- TOKEN --', center: true })
    const t = plnData.value.token || ''
    const parts = t.replace(/-/g, '').match(/.{1,4}/g) || []
    if (parts.length >= 5) {
      lines.push({ text: `${parts[0]}-${parts[1]}-${parts[2]}`, bold: true, center: true, font: 'bold 22px monospace' })
      lines.push({ text: `${parts[3]}-${parts[4]}`, bold: true, center: true, font: 'bold 22px monospace' })
    } else {
      lines.push({ text: t, bold: true, center: true, font: 'bold 22px monospace' })
    }
  }
  
  lines.push({ text: '' })
  lines.push({ text: '--------------------------------' })
  lines.push({ text: 'Info Hubungi Call Center 123', center: true, font: fontSmall })
  lines.push({ text: 'Atau Hubungi PLN Terdekat', center: true, font: fontSmall })
  lines.push({ text: '' })
  lines.push({ text: 'Terima Kasih', center: true, font: fontSmall })

  return lines
}

// Build receipt as plain canvas to avoid html2canvas CSS color issues
const drawReceiptToCanvas = async (): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  
  const w = 384 // Standard 58mm printer width (8 dots/mm * 48mm)
  const pad = 24
  const lineH = 26
  const font = '17px monospace'
  const fontBold = 'bold 17px monospace'
  
  const lines = await buildReceiptLines()
  
  // Calculate height
  const totalH = lines.length * lineH + pad * 2
  canvas.width = w
  canvas.height = totalH
  
  // Draw background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, totalH)
  
  // Draw lines
  let y = pad
  for (const line of lines) {
    ctx.font = line.font || (line.bold ? fontBold : font)
    ctx.fillStyle = '#000000'
    
    if (line.center) {
      const textW = ctx.measureText(line.text).width
      ctx.fillText(line.text, (w - textW) / 2, y)
    } else {
      ctx.fillText(line.text, pad, y)
    }
    y += lineH
  }
  
  return canvas
}

const shareReceipt = async (format: 'jpg' | 'pdf') => {
  if (!trx.value) return
  
  isSharing.value = true
  showShareModal.value = false
  
  try {
    // Wait for modal animation to complete
    await new Promise(r => setTimeout(r, 300))
    
    // Draw receipt directly to canvas
    const canvas = await drawReceiptToCanvas()
    
    if (isNative) {
      // Native (Capacitor): save file to device and use native share
      let base64Data: string
      let fileName: string
      
      if (format === 'jpg') {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
        base64Data = dataUrl.split(',')[1]
        fileName = `Nota-${trx.value.ref_id || 'transaksi'}.jpg`
      } else {
        const { jsPDF } = await import('jspdf')
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: [canvas.width / 2, canvas.height / 2]
        })
        const imgData = canvas.toDataURL('image/jpeg', 1.0)
        pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width / 2, canvas.height / 2)
        base64Data = pdf.output('datauristring').split(',')[1]
        fileName = `Nota-${trx.value.ref_id || 'transaksi'}.pdf`
      }

      // Write file to device cache directory
      await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      })
      
      // Get FileProvider-compatible URI for Android sharing
      const fileUri = await Filesystem.getUri({
        directory: Directory.Cache,
        path: fileName,
      })
      
      // Use 'files' array (not 'url') so Android can share local files
      const SharePlugin = (Capacitor as any).Plugins?.Share
      if (SharePlugin) {
        await SharePlugin.share({
          title: 'Bagikan Nota',
          files: [fileUri.uri],
          dialogTitle: 'Bagikan Nota',
        })
      } else {
        alert('Fitur berbagi tidak tersedia.')
      }
    } else {
      // Web: download file or use Web Share API
      let fileToShare: File

      if (format === 'jpg') {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
        if (!blob) throw new Error('Gagal membuat gambar JPG')
        fileToShare = new File([blob], `Nota-${trx.value.ref_id || 'transaksi'}.jpg`, { type: 'image/jpeg' })
      } else {
        const { jsPDF } = await import('jspdf')
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: [canvas.width / 2, canvas.height / 2]
        })
        const imgData = canvas.toDataURL('image/jpeg', 1.0)
        pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width / 2, canvas.height / 2)
        const pdfBlob = pdf.output('blob')
        fileToShare = new File([pdfBlob], `Nota-${trx.value.ref_id || 'transaksi'}.pdf`, { type: 'application/pdf' })
      }

      if (navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
        await navigator.share({
          title: 'Nota Transaksi',
          text: 'Berikut adalah nota transaksi Anda.',
          files: [fileToShare]
        })
      } else {
        const url = URL.createObjectURL(fileToShare)
        const a = document.createElement('a')
        a.href = url
        a.download = fileToShare.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        alert('File telah diunduh.')
      }
    }
  } catch (err: any) {
    if (err.message !== 'Share canceled') {
      alert(err.message || 'Terjadi kesalahan saat memproses file')
    }
  } finally {
    isSharing.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-neutral-100 flex flex-col font-sans">
    <!-- Header (no print button) -->
    <div class="bg-primary-600 text-white p-4 flex items-center gap-4 shadow-sm sticky top-0 z-10 print:hidden">
      <button @click="router.back()" class="p-2 -ml-2 rounded-full hover:bg-white/20 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <h1 class="text-xl font-bold">Nota Transaksi</h1>
    </div>

    <div class="flex-1 p-4 flex flex-col items-center justify-start print:p-0 print:bg-white overflow-y-auto">
      <div v-if="loading" class="animate-spin w-8 h-8 mt-10 border-[3px] border-primary-600 border-t-transparent rounded-full print:hidden"></div>

      <!-- THERMAL RECEIPT CONTAINER -->
      <div v-if="trx" class="w-full max-w-[320px] mx-auto print:pb-0 shrink-0">
        <div class="receipt-container bg-white p-6 shadow-lg font-mono text-sm leading-tight border border-neutral-200" style="color: #000; background: #fff;">
          
          <div class="text-center mb-4">
            <p class="font-bold text-base">** {{ storeName.toUpperCase() }} **</p>
            <p>{{ formatDate(trx.created_at) }} (CU)</p>
          </div>

          <div class="text-center mb-4 font-bold">
            <p v-if="isPln">STRUK PEMBELIAN LISTRIK</p>
            <p v-if="isPln">PRABAYAR</p>
            <p v-else>STRUK PEMBELIAN</p>
            <p v-if="!isPln" class="uppercase">{{ trx.products?.category }}</p>
          </div>

          <!-- PLN FORMAT -->
          <div v-if="isPln" class="space-y-1 mb-4">
            <div class="flex"><span class="w-24 shrink-0">IDPEL</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ trx.customer_no }}</span></div>
            <div class="flex"><span class="w-24 shrink-0">NAMA</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ plnData?.nama }}</span></div>
            <div class="flex"><span class="w-24 shrink-0">TRF/DAYA</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ plnData?.tarif }}/{{ plnData?.daya }}</span></div>
            <div class="flex"><span class="w-24 shrink-0">NOMINAL</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ formatRp(trx.products?.harga_modal || 0) }}</span></div>
            <div class="flex"><span class="w-24 shrink-0">PPN</span><span class="mr-2">:</span><span class="flex-1 break-words">RP. 0,00</span></div>
            <div class="flex"><span class="w-24 shrink-0">ANGS/MAT</span><span class="mr-2">:</span><span class="flex-1 break-words">RP. 0,00/0,00</span></div>
            <div class="flex"><span class="w-24 shrink-0">RP TOKEN</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ formatRp(trx.products?.harga_modal || 0) }}</span></div>
            <div class="flex"><span class="w-24 shrink-0">JML KWH</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ plnData?.kwh }}</span></div>
            <div class="flex"><span class="w-24 shrink-0">BIAYA ADM</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ formatRp(customHargaJual - (trx.products?.harga_modal || 0)) }}</span></div>
            <div class="flex font-bold cursor-pointer hover:bg-gray-100 p-1 -m-1 rounded transition-colors" @click="openEditModal" title="Klik untuk edit Total Bayar">
              <span class="w-24 shrink-0 mt-1">TOTAL BAYAR</span><span class="mr-2 mt-1">:</span>
              <span class="flex-1 break-words flex items-center gap-1 mt-1">
                {{ formatRp(customHargaJual) }}
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400 print:hidden"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </span>
            </div>
          </div>

          <!-- NON-PLN FORMAT -->
          <div v-else class="space-y-1 mb-4">
            <div class="flex"><span class="w-24 shrink-0">PRODUK</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ trx.products?.product_name }}</span></div>
            <div class="flex"><span class="w-24 shrink-0">NO TUJUAN</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ trx.customer_no }}</span></div>
            <div v-if="trx.customer_name" class="flex"><span class="w-24 shrink-0">NAMA AKUN</span><span class="mr-2">:</span><span class="flex-1 break-words">{{ trx.customer_name }}</span></div>
            <!-- SN / REF - each part on its own line -->
            <template v-if="snParts.length > 0 && snParts[0].label">
              <div v-for="(part, i) in snParts" :key="i" class="flex">
                <span class="w-24 shrink-0">{{ part.label }}</span><span class="mr-2">:</span><span class="flex-1 break-all">{{ truncateVal(part.value) }}</span>
              </div>
            </template>
            <div v-else class="flex"><span class="w-24 shrink-0">SN / REF</span><span class="mr-2">:</span><span class="flex-1 break-all">{{ truncateVal(trx.sn || trx.ref_id || '') }}</span></div>
            <div class="flex mt-2 font-bold cursor-pointer hover:bg-gray-100 p-1 -m-1 rounded transition-colors" @click="openEditModal" title="Klik untuk edit Total Bayar">
              <span class="w-24 shrink-0 mt-1">TOTAL BAYAR</span><span class="mr-2 mt-1">:</span>
              <span class="flex-1 break-words flex items-center gap-1 mt-1">
                {{ formatRp(customHargaJual) }}
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400 print:hidden"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </span>
            </div>
          </div>

          <!-- TOKEN DISPLAY -->
          <div v-if="isPln" class="text-center mt-6 mb-6">
            <p class="mb-2">-- TOKEN --</p>
            <div class="font-bold text-2xl tracking-widest break-words space-y-1">
              <template v-if="plnData?.token?.replace(/-/g, '').match(/.{1,4}/g)?.length >= 5">
                <p>{{ plnData?.token?.replace(/-/g, '').match(/.{1,4}/g)?.slice(0,3).join('-') }}</p>
                <p>{{ plnData?.token?.replace(/-/g, '').match(/.{1,4}/g)?.slice(3,5).join('-') }}</p>
              </template>
              <p v-else>{{ plnData?.token }}</p>
            </div>
          </div>

          <div class="text-center mt-6 border-t border-dashed border-black pt-4 text-xs">
            <p>Info Hubungi Call Center 123</p>
            <p>Atau Hubungi PLN Terdekat</p>
            <p class="mt-3">Terima Kasih</p>
          </div>
        </div>

        <!-- Action Buttons: show print OR share based on route, not both -->
        <div class="mt-6 flex flex-col gap-3 print:hidden px-4" data-html2canvas-ignore>
          <!-- Print mode: show print + back -->
          <template v-if="!isShareMode">
            <button @click="printReceipt" class="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-primary-600/20 transition-all flex justify-center items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Cetak / Print
            </button>
          </template>
          <!-- Share mode: show share + back -->
          <template v-else>
            <button @click="showShareModal = true" :disabled="isSharing" class="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-primary-600/20 transition-all flex justify-center items-center gap-2 disabled:opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              {{ isSharing ? 'Memproses...' : 'Kirim / Bagikan' }}
            </button>
          </template>
          <button @click="router.push('/history')" class="w-full bg-white hover:bg-neutral-50 text-neutral-700 font-bold py-3.5 px-4 rounded-xl shadow-sm border border-neutral-200 transition-all flex justify-center items-center gap-2">
            Kembali ke Riwayat
          </button>
        </div>
      </div>

      <div v-else class="text-center text-neutral-500">
        Transaksi tidak ditemukan
      </div>
    </div>

    <!-- Share Format Modal -->
    <Teleport to="body">
      <div v-if="showShareModal" class="share-modal-overlay" @click.self="showShareModal = false">
        <div class="share-modal-box">
          <div style="padding: 16px; border-bottom: 1px solid #f0f0f0;">
            <h3 style="font-weight: bold; font-size: 18px; text-align: center; color: #333;">Pilih Format Nota</h3>
          </div>
          <div style="padding: 8px;">
            <button @click="shareReceipt('jpg')" :disabled="isSharing" style="width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: none; background: none; cursor: pointer; border-radius: 12px; font-size: 14px; font-weight: 500; color: #333;" class="share-option">
              <div style="width: 32px; height: 32px; border-radius: 8px; background: #dbeafe; color: #2563eb; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              </div>
              Kirim sebagai Gambar (JPG)
            </button>
            <button @click="shareReceipt('pdf')" :disabled="isSharing" style="width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: none; background: none; cursor: pointer; border-radius: 12px; font-size: 14px; font-weight: 500; color: #333;" class="share-option">
              <div style="width: 32px; height: 32px; border-radius: 8px; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              </div>
              Kirim sebagai Dokumen (PDF)
            </button>
          </div>
          <div style="padding: 8px; border-top: 1px solid #f0f0f0;">
            <button @click="showShareModal = false" :disabled="isSharing" style="width: 100%; padding: 10px; border: none; background: none; cursor: pointer; border-radius: 12px; font-size: 13px; font-weight: bold; color: #999;">
              Batal
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    
    <!-- Edit Harga Jual Modal -->
    <div v-if="showEditModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 print:hidden">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 class="font-bold text-gray-800 text-lg">Ubah Total Bayar</h3>
          <button @click="showEditModal = false" class="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Nominal (Rp)</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span class="text-gray-500 font-medium">Rp</span>
              </div>
              <input type="text" v-model="tempHargaJualDisplay" @input="onHargaJualInput" inputmode="numeric" class="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-bold text-lg" />
            </div>
            <p class="text-xs text-gray-500 mt-2">Biaya admin akan otomatis disesuaikan.</p>
          </div>
          <div class="flex gap-3 pt-2">
            <button @click="showEditModal = false" class="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Batal</button>
            <button @click="saveHargaJual" class="flex-1 py-3 px-4 bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-600/30 hover:bg-primary-700 transition-all active:scale-95">Simpan</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.receipt-container {
  background-color: #ffffff !important;
  color: #000000 !important;
}
.receipt-container * {
  color: #000000 !important;
}

/* Share modal - pure CSS centering, no Tailwind color functions */
.share-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.5);
}
.share-modal-box {
  background: #ffffff;
  border-radius: 16px;
  width: 100%;
  max-width: 320px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
.share-option:hover {
  background-color: #f5f5f5 !important;
}

@media print {
  @page { margin: 0; }
  body { margin: 0; background-color: white; }
  .receipt-container {
    box-shadow: none !important;
    border: none !important;
    width: 100% !important;
    max-width: 100% !important;
  }
}
</style>
