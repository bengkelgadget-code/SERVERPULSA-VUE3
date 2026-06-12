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

  const { customer_no } = req.body;

  if (!customer_no) {
    return res.status(400).json({ success: false, error: 'Customer Number is required' });
  }

  try {
    const proxyHost = process.env.PROXY_HOST;
    const proxyPort = process.env.PROXY_PORT;
    const proxyUser = process.env.PROXY_USER;
    const proxyPass = process.env.PROXY_PASS;

    const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;
    const proxyAgent = new HttpsProxyAgent(proxyUrl);

    const username = process.env.DIGIFLAZZ_USERNAME;
    const apiKey = process.env.DIGIFLAZZ_API_KEY; // This should be the production key usually
    
    // For inquiry-pln, the signature is md5(username + apiKey + customer_no)
    const sign = md5(`${username}${apiKey}${customer_no}`);

    console.log(`Checking PLN for customer: ${customer_no}`);
    const response = await axios.post(
      'https://api.digiflazz.com/v1/inquiry-pln',
      {
        username: username,
        customer_no: customer_no,
        sign: sign
      },
      { httpsAgent: proxyAgent }
    );

    const digiflazzData = response.data.data;
    
    // Check for Digiflazz API Error
    if (digiflazzData && digiflazzData.rc && digiflazzData.rc !== '00') {
      return res.status(400).json({ 
        success: false, 
        message: digiflazzData.message || 'Gagal mengecek nama',
        rc: digiflazzData.rc
      });
    }

    // Success
    return res.status(200).json({ 
      success: true, 
      name: digiflazzData.name,
      segment_power: digiflazzData.segment_power,
      subscriber_id: digiflazzData.subscriber_id
    });
    
  } catch (error) {
    console.error('Error in inquiry-pln:', error.response?.data || error.message);
    const errorMsg = error.response?.data?.data?.message || 'Terjadi kesalahan pada server';
    return res.status(500).json({ success: false, message: errorMsg });
  }
}
