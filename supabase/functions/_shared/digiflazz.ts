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
      const proxyConfig: any = { url: proxyUrl };
      // Also set basicAuth for newer Deno versions that may require it
      if (proxyUser && proxyPass) {
        proxyConfig.basicAuth = { username: proxyUser, password: proxyPass };
      }
      // @ts-ignore: Deno createHttpClient is available in Edge Runtime
      client = typeof Deno.createHttpClient === 'function' ? Deno.createHttpClient({ proxy: proxyConfig }) : undefined;
      console.log(`[proxy] Using proxy: ${proxyHost}:${proxyPort} user=${proxyUser} hasPass=${!!proxyPass} clientCreated=${!!client}`);
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

  async inquiryPln(customer_no: string): Promise<{ success: boolean; name?: string; segment_power?: string; message?: string; rc?: string } | null> {
    const signature = this.generateSignature(customer_no);
    try {
      const json = await this.fetchWithProxy('/inquiry-pln', {
        username: this.username,
        customer_no: customer_no,
        sign: signature
      });

      console.log(`[inquiryPln] Response for ${customer_no}:`, JSON.stringify(json?.data || json));

      if (json && json.data) {
        const name = json.data.name || json.data.customer_name;
        const isSuccess = json.data.rc === '00' || (!json.data.rc && name) || json.data.status?.toLowerCase() === 'sukses';
        
        if (name && isSuccess) {
          return {
            success: true,
            name: String(name).trim(),
            segment_power: json.data.segment_power || '',
            message: json.data.message || 'Sukses',
            rc: json.data.rc || '00'
          };
        }

        let failureMessage = json.data.message || 'Nomor Pelanggan Tidak Ditemukan';
        if (json.data.rc === '02' || failureMessage.toLowerCase().includes('transaksi gagal')) {
          failureMessage = 'Nama pelanggan tidak dapat dicek (Server PLN sedang gangguan). Pembelian token tetap dapat dilanjutkan.';
        } else if (json.data.rc === '54' || failureMessage.toLowerCase().includes('tujuan salah')) {
          failureMessage = 'Nomor ID / Meter salah. Mohon periksa kembali.';
        }

        return {
          success: false,
          message: failureMessage,
          rc: json.data.rc
        };
      }
      return null;
    } catch (e: any) {
      console.error('[inquiryPln] Error:', e?.message || e);
      return {
        success: false,
        message: e?.message?.includes('timeout') 
          ? 'Pengecekan nama timeout. Pembelian token tetap dapat dilanjutkan.' 
          : 'Server PLN belum merespons. Pembelian token tetap dapat dilanjutkan.'
      };
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

  async statusPasca(sku_code: string, customer_no: string, ref_id: string): Promise<any> {
    return this.createTransaction(sku_code, customer_no, ref_id, 'status-pasca');
  }
}

export const digiflazz = new DigiFlazzClient();
