import { ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning'

export function useBarcodeScanner() {
  const isSupported = ref(false)
  const isScanning = ref(false)

  async function checkAvailability() {
    if (Capacitor.getPlatform() !== 'android') return
    try {
      const { supported } = await BarcodeScanner.isSupported()
      isSupported.value = supported
    } catch (e) {
      console.error('Barcode support check error:', e)
    }
  }

  async function requestPermissions(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') return false
    try {
      const { camera } = await BarcodeScanner.requestPermissions()
      return camera === 'granted' || camera === 'limited'
    } catch (e) {
      console.error('Barcode permission error:', e)
      return false
    }
  }

  async function scan(): Promise<string | null> {
    if (Capacitor.getPlatform() !== 'android') {
      alert('Fitur scan barcode hanya tersedia di aplikasi Android.')
      return null
    }

    const hasPermission = await requestPermissions()
    if (!hasPermission) {
      alert('Izin kamera diperlukan untuk scan barcode.')
      return null
    }

    isScanning.value = true
    try {
      // Start scanning
      const { barcodes } = await BarcodeScanner.scan()
      if (barcodes.length > 0) {
        return barcodes[0].displayValue
      }
      return null
    } catch (e) {
      console.error('Scan barcode error:', e)
      return null
    } finally {
      isScanning.value = false
    }
  }

  // Check support on initialization
  checkAvailability()

  return {
    isSupported,
    isScanning,
    requestPermissions,
    scan
  }
}
