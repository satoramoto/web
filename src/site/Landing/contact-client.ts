import type { SendContact } from './JunctionContact';

type Turnstile = {
  render(container: HTMLElement, options: {
    sitekey: string; action: string; execution: 'execute'; appearance: 'interaction-only';
    theme: 'dark'; size: 'normal' | 'compact'; retry: 'never'; 'response-field': false;
    callback: (token: string) => void;
    'error-callback': () => void; 'expired-callback': () => void; 'timeout-callback': () => void;
  }): string;
  execute(id: string): void;
  remove(id: string): void;
};

const turnstileWindow = window as Window & { turnstile?: Turnstile };
let loading: Promise<Turnstile> | undefined;

function getTurnstile(): Promise<Turnstile> {
  if (turnstileWindow.turnstile) return Promise.resolve(turnstileWindow.turnstile);
  if (!loading) {
    loading = new Promise<Turnstile>((resolve, reject) => {
      const script = document.createElement('script');
      const failed = () => { script.remove(); reject(new Error('Contact verification could not load')); };
      const timeout = window.setTimeout(failed, 8_000);
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => {
        window.clearTimeout(timeout);
        if (turnstileWindow.turnstile) resolve(turnstileWindow.turnstile);
        else failed();
      };
      script.onerror = () => { window.clearTimeout(timeout); failed(); };
      document.head.append(script);
    }).catch(error => { loading = undefined; throw error; });
  }
  return loading;
}

async function verify(sitekey: string, container: HTMLElement) {
  const turnstile = await getTurnstile();
  let id: string | undefined;
  let timeout: number | undefined;
  try {
    return await new Promise<string>((resolve, reject) => {
      const failed = () => reject(new Error('Contact verification did not complete'));
      timeout = window.setTimeout(failed, 120_000);
      id = turnstile.render(container, {
        sitekey, action: 'junction_contact', execution: 'execute', appearance: 'interaction-only',
        theme: 'dark', size: (container.parentElement?.clientWidth ?? 0) < 325 ? 'compact' : 'normal',
        retry: 'never', 'response-field': false,
        callback: resolve, 'error-callback': failed, 'expired-callback': failed, 'timeout-callback': failed,
      });
      turnstile.execute(id);
    });
  } finally {
    window.clearTimeout(timeout);
    if (id !== undefined) turnstile.remove(id);
  }
}

export function contactTransport(sitekey: string): SendContact {
  return async (draft, challenge) => {
    if (!challenge) throw new Error('Contact verification is unavailable');
    const token = await verify(sitekey, challenge);
    const result = await fetch('https://contact.satoramoto.com/', {
      method: 'POST', mode: 'cors', credentials: 'omit',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, token }),
      signal: AbortSignal.timeout(15_000),
    });
    if (result.status !== 202 || (await result.json()).accepted !== true) throw new Error('Delivery was not confirmed');
  };
}
