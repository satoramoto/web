import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Copy, t } from '../../i18n/copy';
import './junction-contact.css';

const roles = ['visionary', 'accelerator'] as const;
const inbox = t('junction.recipient');

type JunctionRole = typeof roles[number];
export type RouteSignal = (role: JunctionRole | null, origin?: DOMRect) => boolean;
export type SendContact = (contact: { role: JunctionRole; email: string; message: string }, challenge: HTMLDivElement | null) => Promise<void>;

export function JunctionContact({ onRoute, sendContact }: { onRoute: RouteSignal; sendContact?: SendContact }) {
  const [step, setStep] = useState<'choose' | 'charge' | 'reply' | 'sent'>('choose');
  const [role, setRole] = useState<JunctionRole>('visionary');
  const [email, setEmail] = useState('');
  const [messages, setMessages] = useState({ visionary: '', accelerator: '' });
  const [status, setStatus] = useState<'ready' | 'sending' | 'failed'>('ready');
  const emailRef = useRef<HTMLInputElement>(null), messageRef = useRef<HTMLTextAreaElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null), receiptRef = useRef<HTMLHeadingElement>(null);
  const challengeRef = useRef<HTMLDivElement>(null);
  const choicesRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null), previousTop = useRef<number | null>(null);
  const returning = useRef(false);
  const inFlight = useRef(false);
  const formId = useId();
  const reply = step === 'reply';
  const sent = step === 'sent';
  const sending = status === 'sending';
  const emailPrompt = t('junction.email');
  const messagePrompt = t(`junction.message.${role}`);

  useLayoutEffect(() => {
    if (sent) receiptRef.current?.focus({ preventScroll: true });
  }, [sent]);

  // Lay out the new panel once. Move the centered hero from its old position
  // on the compositor rather than relaying out the form on every frame.
  useLayoutEffect(() => {
    const from = previousTop.current;
    previousTop.current = null;
    if (from === null || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const intro = consoleRef.current?.closest<HTMLElement>('.opal-intro');
    if (!intro) return;
    const offset = from - intro.getBoundingClientRect().top;
    const animation = intro.animate([{ transform: `translateY(${offset}px)` }, { transform: 'none' }],
      { duration: 280, easing: 'cubic-bezier(.18,.7,.22,1)' });
    return () => animation.cancel();
  }, [reply, sent]);

  function rememberPosition() {
    previousTop.current = consoleRef.current?.closest('.opal-intro')?.getBoundingClientRect().top ?? null;
  }

  function choose(who: JunctionRole, button: HTMLButtonElement) {
    if (step !== 'choose') return;
    setRole(who);
    const origin = (button.querySelector('strong') ?? button).getBoundingClientRect();
    rememberPosition();
    setStep(onRoute(who, origin) ? 'charge' : 'reply');
  }
  useEffect(() => {
    if (step === 'charge') {
      const timer = window.setTimeout(() => setStep('reply'), 380);
      return () => window.clearTimeout(timer);
    }
    if (step === 'reply') emailRef.current?.focus({ preventScroll: true });
    else if (returning.current) {
      choicesRef.current?.querySelector<HTMLButtonElement>(`[data-role="${role}"]`)?.focus({ preventScroll: true });
      returning.current = false;
    }
  }, [step, role]);

  function returnToChoices() {
    if (inFlight.current) return;
    rememberPosition();
    returning.current = true;
    onRoute(null);
    messageRef.current?.setCustomValidity('');
    setStatus('ready');
    setStep('choose');
  }

  async function compose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reply || inFlight.current) return;
    const message = messages[role].trim();
    if (!message) {
      messageRef.current?.setCustomValidity(t('junction.emptyMessage'));
      messageRef.current?.reportValidity();
      return;
    }
    if (!sendContact) {
      const values = { role: t(`landing.${role}`), email: email.trim(), message: message.replace(/\r?\n/g, '\r\n') };
      window.location.assign(`mailto:${inbox}?subject=${encodeURIComponent(t('junction.subject', values))}&body=${encodeURIComponent(t('junction.body', values))}`);
      return;
    }
    inFlight.current = true;
    setStatus('sending');
    try {
      await sendContact({ role, email: email.trim(), message }, challengeRef.current);
      onRoute(role, sendRef.current?.getBoundingClientRect());
      rememberPosition();
      setMessages(current => ({ ...current, [role]: '' }));
      setStep('sent');
      setStatus('ready');
    } catch {
      setStatus('failed');
    } finally {
      inFlight.current = false;
    }
  }

  return <div className="junction-console" data-step={step} data-selected={role} ref={consoleRef}>
    <div className="junction-panel" data-open={!reply && !sent} inert={reply || sent} aria-hidden={reply || sent}>
      <div className="junction-clip">
        <div className="junction-choices" ref={choicesRef} role="group" aria-label={t('junction.choose')}>
          {roles.map(who => <button key={who} type="button" className="junction-choice" data-role={who}
            aria-controls={formId} aria-expanded={reply && who === role} aria-disabled={step === 'charge' || undefined}
            onClick={event => choose(who, event.currentTarget)}>
            <Copy k={`junction.question.${who}`} />
          </button>)}
        </div>
      </div>
    </div>
    <div className="junction-panel" data-open={reply} inert={!reply} aria-hidden={!reply}>
      <div className="junction-clip">
        <form id={formId} className="junction-form" data-status={status} aria-labelledby={`${formId}-role`} onSubmit={compose}>
          <input ref={emailRef} name="email" type="email" autoComplete="email" aria-label={emailPrompt} placeholder={emailPrompt}
            value={email} maxLength={254} required readOnly={sending} onChange={event => setEmail(event.target.value)} />
          <textarea ref={messageRef} name="message" rows={3} aria-label={messagePrompt} placeholder={messagePrompt}
            value={messages[role]} maxLength={4000} required readOnly={sending} onChange={event => {
              event.target.setCustomValidity(''); setMessages({ ...messages, [role]: event.target.value });
            }} />
          {sendContact && <div className="junction-challenge" ref={challengeRef} />}
          {status === 'failed' && <p className="junction-error" role="alert">{t('junction.sendFailed')}</p>}
          <p className="junction-status" role="status">{sending ? t('junction.sending') : ''}</p>
          {!sendContact && <p className="junction-address">{inbox}</p>}
          <footer>
            <div className="junction-path">
              <h2 id={`${formId}-role`}>{t(`landing.${role}`)}</h2>
              <span aria-hidden="true">·</span>
              <button type="button" className="junction-back" disabled={sending} onClick={returnToChoices}>{t('junction.change')}</button>
            </div>
            <button type="submit" className="junction-send" ref={sendRef} aria-disabled={sending || undefined}>
              <span>{t(sendContact ? 'junction.send' : 'junction.draft')}</span><span className="junction-send-mark" aria-hidden="true" />
            </button>
          </footer>
        </form>
      </div>
    </div>
    {sent && <div className="junction-panel junction-receipt" data-open="true">
      <p className="junction-receipt-label"><span aria-hidden="true" />{t('junction.receiptLabel')}</p>
      <h2 ref={receiptRef} tabIndex={-1}>{t('junction.receiptTitle')}</h2>
      <p className="junction-receipt-body">{t('junction.receiptBody')}</p>
      <button type="button" className="junction-back" onClick={returnToChoices}>{t('junction.receiptBack')}</button>
    </div>}
  </div>;
}
