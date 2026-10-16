const crypto = require('crypto');
const username = 'levopegORjdW';
const key = 'a0148461-f845-592c-8e44-d455a1f8e89d';
const sku = 'PDAMKABKUTAIKERTANEGARA';
const no = '045380';
const ref_id = 'INQPASCA-' + Date.now();
const sign = crypto.createHash('md5').update(username + key + ref_id).digest('hex');

const HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent;
const agent = new HttpsProxyAgent('http://wrmldnfr:jwendz5xqb0h@38.154.203.95:5863');

async function test() {
  const inq = await fetch('https://api.digiflazz.com/v1/transaction', {
    method: 'POST', body: JSON.stringify({ commands: 'inq-pasca', username, buyer_sku_code: sku, customer_no: no, ref_id, sign }),
    agent
  }).then(r => r.json());
  console.log('Inquiry 1:', inq);
  
  const inq2 = await fetch('https://api.digiflazz.com/v1/transaction', {
    method: 'POST', body: JSON.stringify({ commands: 'inq-pasca', username, buyer_sku_code: sku, customer_no: no, ref_id, sign }),
    agent
  }).then(r => r.json());
  console.log('Inquiry 2:', inq2);
  
  const stat = await fetch('https://api.digiflazz.com/v1/transaction', {
    method: 'POST', body: JSON.stringify({ commands: 'status-pasca', username, buyer_sku_code: sku, customer_no: no, ref_id, sign }),
    agent
  }).then(r => r.json());
  console.log('Status:', stat);
}
test();
