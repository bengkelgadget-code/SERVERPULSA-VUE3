import axios from 'axios';
import md5 from 'md5';
import dotenv from 'dotenv';

dotenv.config();

async function check() {
  const username = process.env.DIGIFLAZZ_USERNAME;
  const apiKey = process.env.DIGIFLAZZ_API_KEY;
  const sign = md5(`${username}${apiKey}pricelist`);
  
  try {
    const res = await axios.post('https://api.digiflazz.com/v1/price-list', {
      cmd: 'prepaid',
      username,
      sign
    });
    console.log("Success:", res.data);
  } catch (err) {
    console.log("Error:", err.response?.data || err.message);
  }
}

check();
