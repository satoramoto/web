import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from './contact.mjs';

const origin = 'https://satoramoto.com';
const endpoint = 'https://contact.satoramoto.com/';
const inquiry = { role: 'accelerator', email: 'visitor@example.test', message: '  I can offer compute.  ', token: 'challenge' };

function submit(value = inquiry, headers = {}) {
  return new Request(endpoint, { method: 'POST', body: JSON.stringify(value), headers: {
    Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...headers,
  } });
}

function fixtures(t, { proof = true, reject = false, limited = false } = {}) {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(init.body.get('response'), inquiry.token);
    return Response.json({ success: proof, hostname: 'satoramoto.com', action: 'junction_contact' });
  });
  return {
    CONTACT_TO: 'inbox@example.test', TURNSTILE_SECRET: 'test-only',
    CONTACT_RATE: { limit: t.mock.fn(async () => ({ success: !limited })) },
    CONTACT_EMAIL: { send: t.mock.fn(async () => { if (reject) throw new Error('provider error'); }) },
  };
}

test('a verified inquiry is accepted by the fixed inbox with the visitor as Reply-To', async t => {
  const env = fixtures(t);
  const res = await worker.fetch(submit({ ...inquiry, to: 'ignored@example.test' }), env);
  assert.equal(res.status, 202);
  assert.deepEqual(await res.json(), { accepted: true });
  assert.deepEqual(env.CONTACT_EMAIL.send.mock.calls[0].arguments[0], {
    from: 'hello@satoramoto.com', to: 'inbox@example.test', replyTo: 'visitor@example.test',
    subject: 'Junction: accelerator inquiry', text: 'I can offer compute.',
  });
});

test('invalid payloads and origins cannot send', async t => {
  const env = fixtures(t);
  for (const item of [{ ...inquiry, role: 'other' }, { ...inquiry, email: 'bad\r\n@example.test' }, { ...inquiry, message: '  ' }, { ...inquiry, token: '' }]) {
    assert.equal((await worker.fetch(submit(item), env)).status, 400);
  }
  assert.equal((await worker.fetch(submit({ ...inquiry, message: 'x'.repeat(25_000) }), env)).status, 413);
  const forbidden = await worker.fetch(submit(inquiry, { Origin: 'https://unrelated.example.test' }), env);
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(env.CONTACT_EMAIL.send.mock.callCount(), 0);
});

for (const [name, options, status, sent] of [
  ['unverified challenge', { proof: false }, 403, 0],
  ['rate limit', { limited: true }, 429, 0],
  ['provider error', { reject: true }, 503, 1],
]) {
  test(`${name} is never acknowledged as accepted`, async t => {
    const env = fixtures(t, options);
    const res = await worker.fetch(submit(), env);
    assert.equal(res.status, status);
    assert.equal(env.CONTACT_EMAIL.send.mock.callCount(), sent);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), origin);
  });
}
