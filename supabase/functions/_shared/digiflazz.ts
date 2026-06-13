import { createHash } from 'https://deno.land/std@0.119.0/hash/mod.ts';

export class DigiFlazzClient {
  private username: string;
  private apiKey: string;
  private baseUrl = 'https://api.digiflazz.com/v1';

  constructor() {
    this.username = (Deno.env.get('DIGIFLAZZ_USERNAME') || '').trim();
    this.apiKey = (Deno.env.get('DIGIFLAZZ_API_KEY') || Deno.env.get('DIGIFLAZZ_PRODUCTION_KEY') || '').trim();
    
    if (!this.username || !this.apiKey) {
      console.warn("DigiFlazz credentials are not set in environment variables");
    }
  }

  private generateSignature(command: string): string {
    const hash = createHash('md5');
    hash.update(this.username + this.apiKey + command);
    return hash.toString('hex');
  }

  private async fetchWithProxy(path: string, body: any): Promise<any> {
    const proxyHost = (Deno.env.get('PROXY_HOST') || '').trim();
    const proxyPort = (Deno.env.get('PROXY_PORT') || '').trim();
    const proxyUser = (Deno.env.get('PROXY_USERNAME') || Deno.env.get('PROXY_USER') || '').trim();
    const proxyPass = (Deno.env.get('PROXY_PASSWORD') || Deno.env.get('PROXY_PASS') || '').trim();

    let client: Deno.HttpClient | undefined;

    if (proxyHost && proxyPort) {
      const auth = proxyUser && proxyPass ? `${proxyUser}:${proxyPass}@` : '';
      const proxyUrl = `http://${auth}${proxyHost}:${proxyPort}`;
      // @ts-ignore: Deno createHttpClient is available in Edge Runtime
      client = typeof Deno.createHttpClient === 'function' ? Deno.createHttpClient({ proxy: { url: proxyUrl } }) : undefined;
      console.log('Is Deno.createHttpClient available?', typeof Deno.createHttpClient, client ? 'Client created' : 'Client NOT created');
    }

    const bodyString = JSON.stringify(body);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Content-Length': bodyString.length.toString()
        },
        body: bodyString,
        client
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DigiFlazz Error ${response.status}: ${errorText}`);
      }

      return await response.json();
    } finally {
      if (client) {
        client.close();
      }
    }
  }

  async getBalance(): Promise<any> {
    const signature = this.generateSignature('depo');
    const json = await this.fetchWithProxy('/cek-saldo', {
      cmd: 'deposit',
      username: this.username,
      sign: signature
    });
    return json.data.deposit;
  }

  async createTransaction(sku_code: string, customer_no: string, ref_id: string, commands?: string): Promise<any> {
    const signature = this.generateSignature(ref_id);
    const isDev = this.apiKey.startsWith('dev-');
    
    const payload: any = {
      username: this.username,
      buyer_sku_code: sku_code,
      customer_no: customer_no,
      ref_id: ref_id,
      sign: signature,
      ...(isDev ? { testing: true } : {})
    };
    if (commands) payload.commands = commands;

    const json = await this.fetchWithProxy('/transaction', payload);
    return json.data;
  }

  async inquiryPln(customer_no: string): Promise<{ name: string; segment_power: string } | null> {
    const hash = createHash('md5');
    hash.update(this.username + this.apiKey + customer_no);
    const signature = hash.toString();

    try {
      const json = await this.fetchWithProxy('/inquiry-pln', {
        username: this.username,
        customer_no: customer_no,
        sign: signature,
      });

      if (json && json.data && json.data.name) {
        return {
          name: json.data.name,
          segment_power: json.data.segment_power || '',
        };
      }
      return null;
    } catch (e) {
      console.error('inquiryPln error:', e);
      return null;
    }
  }

  async getPriceList(): Promise<any> {
    const signature = this.generateSignature('pricelist');
    const json = await this.fetchWithProxy('/price-list', {
      cmd: 'prepaid',
      username: this.username,
      sign: signature
    });
    return json.data;
  }

  async getPascaList(): Promise<any> {
    const signature = this.generateSignature('pricelist');
    const json = await this.fetchWithProxy('/price-list', {
      cmd: 'pasca',
      username: this.username,
      sign: signature
    });
    return json.data;
  }

  async inquiryPasca(sku_code: string, customer_no: string, ref_id: string): Promise<any> {
    return this.createTransaction(sku_code, customer_no, ref_id, 'inq-pasca');
  }

  async payPasca(sku_code: string, customer_no: string, ref_id: string): Promise<any> {
    return this.createTransaction(sku_code, customer_no, ref_id, 'pay-pasca');
  }
}

export const digiflazz = new DigiFlazzClient();
