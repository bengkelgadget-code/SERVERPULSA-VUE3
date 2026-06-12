import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';
import { HttpsProxyAgent } from 'https-proxy-agent';

dotenv.config();

async function check() {
  const username = process.env.VITE_DIGIFLAZZ_USERNAME;
  const apiKey = process.env.VITE_DIGIFLAZZ_PRODUCTION_KEY;
  const customerNo = '530000000001';
  
  const proxyHost = process.env.PROXY_HOST;
  const proxyPort = process.env.PROXY_PORT;
  const proxyUser = process.env.PROXY_USER;
  const proxyPass = process.env.PROXY_PASS;

  const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;
  const proxyAgent = new HttpsProxyAgent(proxyUrl);
  
  const sign = md5(`${username}${apiKey}${customerNo}`);
  
  try {
    const res = await axios.post('https://api.digiflazz.com/v1/inquiry-pln', {
      username,
      customer_no: customerNo,
      testing: true,
      sign
    }, { httpsAgent: proxyAgent });
    console.log("Success:", res.data);
  } catch (err) {
    console.log("Error:", err.response?.data || err.message);
  }
}

check();
