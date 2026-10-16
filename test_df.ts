import { createHash } from "https://deno.land/std@0.160.0/hash/mod.ts";
const username = 'levopegORjdW';
const key = 'a0148461-f845-592c-8e44-d455a1f8e89d';
const sku = 'PDAMKABKUTAIKERTANEGARA';
const no = '045380';
const ref_id = 'INQPASCA-' + Date.now();
const msg = new TextEncoder().encode(username + key + ref_id);
const hash = createHash("md5").update(msg).toString();

const client = Deno.createHttpClient({
  proxy: { url: "http://wrmldnfr:jwendz5xqb0h@38.154.203.95:5863" }
});

const inq1 = await fetch('https://api.digiflazz.com/v1/transaction', {
  method: 'POST', body: JSON.stringify({ commands: 'inq-pasca', username, buyer_sku_code: sku, customer_no: no, ref_id, sign: hash }),
  client
}).then(r => r.json());
console.log('Inq1:', inq1);

const inq2 = await fetch('https://api.digiflazz.com/v1/transaction', {
  method: 'POST', body: JSON.stringify({ commands: 'inq-pasca', username, buyer_sku_code: sku, customer_no: no, ref_id, sign: hash }),
  client
}).then(r => r.json());
console.log('Inq2:', inq2);

const stat = await fetch('https://api.digiflazz.com/v1/transaction', {
  method: 'POST', body: JSON.stringify({ commands: 'status-pasca', username, buyer_sku_code: sku, customer_no: no, ref_id, sign: hash }),
  client
}).then(r => r.json());
console.log('Status:', stat);
