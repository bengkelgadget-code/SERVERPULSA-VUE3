require('dotenv').config();
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const md5 = require('md5');

async function testDigiflazz() {
  const proxyHost = process.env.PROXY_HOST;
  const proxyPort = process.env.PROXY_PORT;
  const proxyUser = process.env.PROXY_USER;
  const proxyPass = process.env.PROXY_PASS;

  const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;
  const proxyAgent = new HttpsProxyAgent(proxyUrl);

  const username = process.env.DIGIFLAZZ_USERNAME;
  const apiKey = process.env.DIGIFLAZZ_API_KEY;
  
  // Test Prepaid Price List
  const sign = md5(`${username}${apiKey}depo`);

  try {
    const response = await axios.post(
      'https://api.digiflazz.com/v1/price-list',
      {
        cmd: 'depo',
        username: username,
        sign: sign
      },
      { httpsAgent: proxyAgent }
    );
    console.log('Response:', response.data);
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testDigiflazz();
