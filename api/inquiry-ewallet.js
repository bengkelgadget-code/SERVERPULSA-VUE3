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

  if (!customer_no) {
    return res.status(400).json({ success: false, error: 'Customer Number is required' });
  }

  try {
    // Karena Digiflazz tidak memiliki API Pengecekan Nama E-Wallet gratis bawaan (seperti inquiry-pln),
    // pengecekan nama E-Wallet biasanya menggunakan API pihak ketiga (seperti cekmutasi, ibuzz, dll) 
    // atau produk pascabayar khusus.
    // 
    // Di sini kita kembalikan respons "Belum Dikonfigurasi" agar UI dapat menanganinya.
    
    return res.status(400).json({ 
      success: false, 
      message: "Fitur Cek Nama E-Wallet belum memiliki jalur API Backend (Digiflazz tidak mendukung cek nama ewallet secara bawaan). Silakan tambahkan provider API Cek Nama Anda." 
    });
    
  } catch (error) {
    console.error('Error in inquiry-ewallet:', error);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
}
