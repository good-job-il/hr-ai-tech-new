// Remove Hebrew cantillation and vowel points, retaining Hebrew punctuation.
export function withoutNiqqud(value) {
 return String(value ?? '').normalize('NFC').replace(/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, '');
}

export function unpointedContent(value) {
 if (typeof value === 'string') return withoutNiqqud(value);
 if (Array.isArray(value)) return value.map(unpointedContent);
 if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /(^|_)(id|url|path|email|phone|token|hash|key|secret|signature)$/i.test(key) ? item : unpointedContent(item)]));
 return value;
}

// Presentation boundary only: leave requests, stored data, Auth and files intact.
export function unpointedSupabaseFetch(fetcher) {
 return async (input, init) => {
  const response = await fetcher(input, init);
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (!url.pathname.startsWith('/rest/v1/') || !response.ok || !response.headers.get('content-type')?.includes('json') || response.status === 204) return response;
  let data;
  try { data = await response.clone().json(); } catch { return response; }
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(JSON.stringify(unpointedContent(data)), {status:response.status,statusText:response.statusText,headers});
 };
}
