const origin = 'https://satoramoto.com';
const action = 'junction_contact';
const roles = new Set(['visionary', 'accelerator']);
const bodyLimit = 24_000;
const emailPattern = /^[^\s@<>;,"():\\\x00-\x1f\x7f]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function response(status, error, headers = {}) {
  return Response.json(error ? { error } : { accepted: true }, {
    status,
    headers: { 'Cache-Control': 'no-store', 'Vary': 'Origin', ...headers },
  });
}

async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > bodyLimit) { await reader.cancel(); throw new RangeError('request too large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

function submission(value) {
  if (!value || typeof value !== 'object' || !roles.has(value.role)) return null;
  const { role, email, message, token } = value;
  if (typeof email !== 'string' || typeof message !== 'string' || typeof token !== 'string') return null;
  const replyTo = email.trim(), text = message.trim();
  if (replyTo.length > 254 || !emailPattern.test(replyTo) || !text || text.length > 4_000 || !token || token.length > 2_048) return null;
  return { role, replyTo, text, token };
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== '/') return response(404, 'not_found');
    if (request.headers.get('Origin') !== origin) return response(403, 'forbidden');
    const cors = { 'Access-Control-Allow-Origin': origin };
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        ...cors, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600',
      } });
    }
    if (request.method !== 'POST') return response(405, 'method_not_allowed', { ...cors, Allow: 'POST, OPTIONS' });
    if (request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') return response(415, 'unsupported_media_type', cors);
    if (Number(request.headers.get('Content-Length')) > bodyLimit) return response(413, 'too_large', cors);

    try {
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip) return response(403, 'forbidden', cors);
      const limit = await env.CONTACT_RATE.limit({ key: ip });
      if (!limit.success) return response(429, 'rate_limited', { ...cors, 'Retry-After': '60' });

      let value;
      try { value = await readBody(request); }
      catch (error) { return error instanceof RangeError ? response(413, 'too_large', cors) : response(400, 'invalid_request', cors); }
      const entry = submission(value);
      if (!entry) return response(400, 'invalid_request', cors);

      const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: entry.token, remoteip: ip }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!check.ok) return response(503, 'verification_unavailable', cors);
      const verified = await check.json();
      if (!verified.success || verified.action !== action || verified.hostname !== new URL(origin).hostname) return response(403, 'verification_failed', cors);

      await env.CONTACT_EMAIL.send({
        from: 'hello@satoramoto.com',
        to: env.CONTACT_TO,
        replyTo: entry.replyTo,
        subject: `Junction: ${entry.role} inquiry`,
        text: entry.text,
      });
      return response(202, null, cors);
    } catch {
      // The provider can accept an email even if its response is lost. Do not retry here.
      return response(503, 'send_unconfirmed', cors);
    }
  },
};
