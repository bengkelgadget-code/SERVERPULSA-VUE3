import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import md5 from 'md5';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { customer_no, provider } = req.body;

  if (!customer_no || !provider) {
    return res.status(400).json({ success: false, error: 'Customer Number and Provider are required' });
  }

  try {
    const proxyHost = process.env.PROXY_HOST;
    const proxyPort = process.env.PROXY_PORT;
    const proxyUser = process.env.PROXY_USER;
    const proxyPass = process.env.PROXY_PASS;

    const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;
    const proxyAgent = new HttpsProxyAgent(proxyUrl);

    const username = process.env.DIGIFLAZZ_USERNAME;
    const apiKey = process.env.DIGIFLAZZ_API_KEY; 

    // Pemetaan SKU Prabayar Cek E-Wallet berdasarkan provider
    // Anda bisa menyesuaikan kode SKU ini dengan yang tersedia di akun Digiflazz Anda
    const skuMapping = {
      'DANA': 'CEKDANA',
      'OVO': 'CEKOVO',
      'GOPAY': 'CEKGOPAY',
      'SHOPEEPAY': 'CEKSPAY',
      'LINKAJA': 'CEKAJA',
      'CEKAJA': 'CEKAJA' // fallback
    };

    const buyerSkuCode = skuMapping[provider.toUpperCase()] || `CEK${provider.toUpperCase()}`;
    const refId = `CEK${provider.toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const sign = md5(`${username}${apiKey}${refId}`);

    console.log(`Checking E-Wallet Name via Transaction: ${buyerSkuCode} for ${customer_no}`);
    const response = await axios.post(
      'https://api.digiflazz.com/v1/transaction',
      {
        username: username,
        buyer_sku_code: buyerSkuCode,
        customer_no: customer_no,
        ref_id: refId,
        sign: sign
      },
      { httpsAgent: proxyAgent }
    );

    const digiflazzData = response.data.data;
    
    if (digiflazzData && digiflazzData.rc && digiflazzData.rc !== '00' && digiflazzData.rc !== '03') {
      return res.status(400).json({ 
        success: false, 
        message: digiflazzData.message || 'Gagal mengecek nama e-wallet (Pastikan SKU Cek tersedia)',
        rc: digiflazzData.rc
      });
    }

    // Ekstrak nama dari SN atau pesan
    let rawName = digiflazzData.sn || digiflazzData.message || '';
    let extractedName = rawName;

    // Biasanya SN berbentuk: A/N Budi Santoso / 0812... 
    // Atau: SN: BUDI SANTOSO / ...
    // Kita coba bersihkan teksnya agar hanya nama yang tersisa
    if (rawName.toUpperCase().includes('A/N')) {
      const parts = rawName.toUpperCase().split('A/N');
      if (parts[1]) {
        extractedName = parts[1].split('/')[0].trim();
      }
    } else if (rawName.includes('/')) {
      extractedName = rawName.split('/')[0].trim();
    }

    return res.status(200).json({ 
      success: true, 
      name: extractedName,
      raw_sn: rawName
    });
    
  } catch (error) {
    console.error('Error in inquiry-ewallet:', error.response?.data || error.message);
    const errorMsg = error.response?.data?.data?.message || 'Terjadi kesalahan pada server Digiflazz';
    return res.status(500).json({ success: false, message: errorMsg });
  }
}
