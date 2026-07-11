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
    }

    const bodyString = JSON.stringify(body);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Content-Length': bodyString.length.toString()
        },
        body: bodyString,
        client,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Always try to parse JSON body — Digiflazz returns HTTP 400 for
      // business errors (RC codes) but still includes valid JSON data
      // (customer name, amount, ref_id, etc). We must NOT throw on non-200
      // status codes before parsing, or we lose that data.
      let json;
      try {
        json = await response.json();
      } catch (e) {
        // Only if JSON parsing fails do we check the HTTP status
        if (!response.ok) {
          throw new Error(`DigiFlazz Error ${response.status}: Could not parse response`);
        }
        throw new Error('Invalid JSON response from Digiflazz');
      }
      return json;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Digiflazz API timeout after 30s');
      }
      throw err;
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
    if (!json?.data) return null;
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
    if (!json?.data) throw new Error('Invalid response from Digiflazz');
    return json.data;
  }

  async inquiryPln(customer_no: string): Promise<{ name: string; segment_power: string } | null> {
    const signature = this.generateSignature(customer_no);
    try {
      const json = await this.fetchWithProxy('/inquiry-pln', {
        username: this.username,
        customer_no: customer_no,
        sign: signature
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
    if (!json?.data) return [];
    return json.data;
  }

  async getPascaList(): Promise<any> {
    const signature = this.generateSignature('pricelist');
    const json = await this.fetchWithProxy('/price-list', {
      cmd: 'pasca',
      username: this.username,
      sign: signature
    });
    if (!json?.data) return [];
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
