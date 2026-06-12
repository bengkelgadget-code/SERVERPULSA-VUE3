import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';
import { HttpsProxyAgent } from 'https-proxy-agent';

dotenv.config();

async function check() {
  const username = process.env.DIGIFLAZZ_USERNAME;
  const apiKey = process.env.DIGIFLAZZ_API_KEY;
  const customerNo = '32130511218';
  
  const proxyHost = process.env.PROXY_HOST;
  const proxyPort = process.env.PROXY_PORT;
  const proxyUser = process.env.PROXY_USER;
  const proxyPass = process.env.PROXY_PASS;
  
  const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;
  const proxyAgent = new HttpsProxyAgent(proxyUrl);
  
  // Try transaction API with PLNCEK
  const refId = 'test_' + Date.now();
  const sign = md5(`${username}${apiKey}${refId}`);
  
  try {
    const res = await axios.post('https://api.digiflazz.com/v1/transaction', {
      username,
      buyer_sku_code: 'PLNCEK',
      customer_no: customerNo,
      ref_id: refId,
      sign
    }, { httpsAgent: proxyAgent });
    console.log("Success:", res.data);
  } catch (err) {
    console.log("Error:", err.response?.data || err.message);
  }
}

check();
