/**
 * A small Axios for the lab previews and the code editor's phone emulator, so code written for the real Axios
 * runs without installing it: axios(config) / axios.get / post / put / patch / delete, axios.create({ baseURL,
 * headers }), params, JSON bodies, `res.data`, and — like Axios — a thrown error for any status outside 200–299
 * with `err.response = { status, data, headers }` (no `err.response` when there was no answer at all).
 */
type Config = {
  url?: string;
  method?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  data?: unknown;
  timeout?: number;
  validateStatus?: (status: number) => boolean;
};
export type AxiosResponse = { data: unknown; status: number; statusText: string; headers: Record<string, string>; config: Config };
export type AxiosError = Error & { isAxiosError: true; config: Config; response?: AxiosResponse; code?: string };
type Get = (url: string, config?: Config) => Promise<AxiosResponse>;
type Send = (url: string, data?: unknown, config?: Config) => Promise<AxiosResponse>;
export type AxiosInstance = ((urlOrConfig: string | Config, config?: Config) => Promise<AxiosResponse>) & {
  get: Get; delete: Get; head: Get; options: Get;
  post: Send; put: Send; patch: Send;
  request: (config: Config) => Promise<AxiosResponse>;
  create: (config?: Config) => AxiosInstance;
  defaults: Config;
  isAxiosError: (e: unknown) => e is AxiosError;
};

function fullUrl(c: Config): string {
  const url = c.url ?? '';
  // like Axios: an absolute url ignores baseURL, an empty one is baseURL itself
  const joined = /^[a-z][a-z0-9+.-]*:/i.test(url) || !c.baseURL ? url : !url ? c.baseURL : `${c.baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
  const params = Object.entries(c.params ?? {}).filter(([, v]) => v !== undefined && v !== null);
  if (!params.length) return joined;
  const qs = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
  return `${joined}${joined.includes('?') ? '&' : '?'}${qs}`;
}

function makeError(message: string, config: Config, response?: AxiosResponse, code?: string): AxiosError {
  const err = new Error(message) as AxiosError;
  err.name = 'AxiosError';
  err.isAxiosError = true;
  err.config = config;
  if (response) err.response = response;
  if (code) err.code = code;
  return err;
}

export function createAxios(defaults: Config = {}): AxiosInstance {
  async function request(config: Config): Promise<AxiosResponse> {
    const c: Config = { ...defaults, ...config, headers: { ...(defaults.headers ?? {}), ...(config.headers ?? {}) } };
    const method = (c.method ?? 'get').toUpperCase();
    const headers: Record<string, string> = { Accept: 'application/json, text/plain, */*', ...c.headers };
    let body: BodyInit | undefined;
    if (c.data !== undefined && method !== 'GET' && method !== 'HEAD') {
      if (typeof c.data === 'string' || c.data instanceof FormData || c.data instanceof URLSearchParams || c.data instanceof Blob) body = c.data as BodyInit;
      else {
        body = JSON.stringify(c.data);
        if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
      }
    }
    let res: Response;
    const ctrl = c.timeout ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), c.timeout) : null;
    try {
      res = await fetch(fullUrl(c), { method, headers, body, signal: ctrl?.signal });
    } catch (e) {
      throw makeError(ctrl?.signal.aborted ? `timeout of ${c.timeout}ms exceeded` : 'Network Error', c, undefined, ctrl?.signal.aborted ? 'ECONNABORTED' : 'ERR_NETWORK');
    } finally {
      if (timer) clearTimeout(timer);
    }
    const text = await res.text();
    let data: unknown = text;
    if (text) { try { data = JSON.parse(text); } catch { /* not JSON: keep the text */ } }
    const response: AxiosResponse = { data, status: res.status, statusText: res.statusText, headers: Object.fromEntries(res.headers.entries()), config: c };
    const ok = (c.validateStatus ?? ((s: number) => s >= 200 && s < 300))(res.status);
    if (!ok) throw makeError(`Request failed with status code ${res.status}`, c, response, res.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST');
    return response;
  }

  const call = (urlOrConfig: string | Config, config: Config = {}) =>
    typeof urlOrConfig === 'string' ? request({ ...config, url: urlOrConfig }) : request(urlOrConfig);
  const get = (method: string): Get => (url, config = {}) => request({ ...config, url, method });
  const send = (method: string): Send => (url, data, config = {}) => request({ ...config, url, data, method });
  return Object.assign(call, {
    get: get('get'), delete: get('delete'), head: get('head'), options: get('options'),
    post: send('post'), put: send('put'), patch: send('patch'),
    request,
    create: (config: Config = {}) => createAxios({ ...defaults, ...config, headers: { ...(defaults.headers ?? {}), ...(config.headers ?? {}) } }),
    defaults,
    isAxiosError: (e: unknown): e is AxiosError => Boolean(e && typeof e === 'object' && (e as AxiosError).isAxiosError),
  });
}

export const axios = createAxios();
