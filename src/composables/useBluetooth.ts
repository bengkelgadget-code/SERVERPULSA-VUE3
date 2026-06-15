import { ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial'

export interface BluetoothDevice {
  name: string;
  address: string;
  id?: string;
  class?: number;
}

export function useBluetooth() {
  const devices = ref<BluetoothDevice[]>([])
  const connectedDevice = ref<BluetoothDevice | null>(null)
  const isConnecting = ref(false)
  const isScanning = ref(false)

  async function checkPermissions(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') {
      return false
    }
    try {
      const isEnabled = await BluetoothSerial.isEnabled()
      if (!isEnabled) {
        await BluetoothSerial.enable()
      }
      return true
    } catch (e) {
      console.error('Bluetooth permission error:', e)
      return false
    }
  }

  async function scanDevices(): Promise<BluetoothDevice[]> {
    if (!await checkPermissions()) return []
    
    isScanning.value = true
    try {
      const result = await BluetoothSerial.scan()
      devices.value = result.devices || []
      return devices.value
    } catch (e) {
      console.error('Scan error:', e)
      return []
    } finally {
      isScanning.value = false
    }
  }

  async function connect(address: string): Promise<boolean> {
    if (!await checkPermissions()) return false
    
    isConnecting.value = true
    try {
      await BluetoothSerial.connect({ address })
      const device = devices.value.find(d => d.address === address)
      if (device) {
        connectedDevice.value = device
      } else {
        connectedDevice.value = { name: 'Unknown', address }
      }
      return true
    } catch (e) {
      console.error('Connect error:', e)
      return false
    } finally {
      isConnecting.value = false
    }
  }

  async function disconnect(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android' || !connectedDevice.value) return
    try {
      await BluetoothSerial.disconnect({ address: connectedDevice.value.address })
      connectedDevice.value = null
    } catch (e) {
      console.error('Disconnect error:', e)
    }
  }

  async function print(text: string): Promise<boolean> {
    if (!connectedDevice.value || Capacitor.getPlatform() !== 'android') return false
    try {
      await BluetoothSerial.write({ address: connectedDevice.value.address, value: text })
      return true
    } catch (e) {
      console.error('Print error:', e)
      return false
    }
  }

  function formatReceipt(transaction: any, storeName: string): string {
    const ESC = '\x1b'
    const LF = '\n'
    const INIT = ESC + '@'
    const ALIGN_CENTER = ESC + 'a' + '\x01'
    const ALIGN_LEFT = ESC + 'a' + '\x00'
    const BOLD_ON = ESC + 'E' + '\x01'
    const BOLD_OFF = ESC + 'E' + '\x00'
    
    let text = INIT
    text += ALIGN_CENTER + BOLD_ON + storeName + BOLD_OFF + LF
    text += '--------------------------------' + LF
    text += ALIGN_LEFT
    text += `Tgl   : ${new Date(transaction.created_at).toLocaleString('id-ID')}` + LF
    text += `SN    : ${transaction.sn || '-'}` + LF
    text += `Produk: ${transaction.product_name || transaction.product_id}` + LF
    text += `Nomor : ${transaction.target_number}` + LF
    text += `Status: ${transaction.status}` + LF
    text += '--------------------------------' + LF
    text += ALIGN_CENTER + BOLD_ON
    text += `TOTAL : Rp ${transaction.price.toLocaleString('id-ID')}` + LF
    text += BOLD_OFF + LF
    text += 'Terima Kasih' + LF
    text += LF + LF + LF
    
    return text
  }

  return {
    devices,
    connectedDevice,
    isConnecting,
    isScanning,
    scanDevices,
    connect,
    disconnect,
    print,
    formatReceipt
  }
}
