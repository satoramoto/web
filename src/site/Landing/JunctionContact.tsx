import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Copy, t } from '../../i18n/copy';
import './junction-contact.css';

const roles = ['visionary', 'accelerator'] as const;
const inbox = t('junction.recipient');

type JunctionRole = typeof roles[number];
export type RouteSignal = (role: JunctionRole | null, origin?: DOMRect) => boolean;

export function JunctionContact({ onRoute }: { onRoute: RouteSignal }) {
  const [step, setStep] = useState<'choose' | 'charge' | 'reply'>('choose');
  const [role, setRole] = useState<JunctionRole>('visionary');
  const [email, setEmail] = useState('');
  const [messages, setMessages] = useState({ visionary: '', accelerator: '' });
  const emailRef = useRef<HTMLInputElement>(null), messageRef = useRef<HTMLTextAreaElement>(null);
  const choicesRef = useRef<HTMLDivElement>(null);
  const returning = useRef(false);
  const formId = useId();
  const reply = step === 'reply';

  function choose(who: JunctionRole, button: HTMLButtonElement) {
    if (step !== 'choose') return;
    setRole(who);
    const origin = (button.querySelector('strong') ?? button).getBoundingClientRect();
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

  function compose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reply) return;
    const message = messages[role].trim();
    if (!message) {
      messageRef.current?.setCustomValidity(t('junction.emptyMessage'));
      messageRef.current?.reportValidity();
      return;
    }
    const values = { role: t(`landing.${role}`), email: email.trim(), message: message.replace(/\r?\n/g, '\r\n') };
    window.location.assign(`mailto:${inbox}?subject=${encodeURIComponent(t('junction.subject', values))}&body=${encodeURIComponent(t('junction.body', values))}`);
  }

  return <div className="junction-console" data-step={step} data-selected={role}>
    <div className="junction-panel" data-open={!reply} inert={reply} aria-hidden={reply}>
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
        <form id={formId} className="junction-form" aria-labelledby={`${formId}-role`} onSubmit={compose}>
          <header>
            <h2 id={`${formId}-role`}>{t(`landing.${role}`)}</h2>
            <button type="button" className="junction-back" onClick={() => {
              returning.current = true; onRoute(null); messageRef.current?.setCustomValidity(''); setStep('choose');
            }}>{t('junction.change')}</button>
          </header>
          <label>{t('junction.email')}
            <input ref={emailRef} name="email" type="email" autoComplete="email" value={email} required onChange={event => setEmail(event.target.value)} />
          </label>
          <label>{t(`junction.message.${role}`)}
            <textarea ref={messageRef} name="message" rows={3} value={messages[role]} required onChange={event => {
              event.target.setCustomValidity(''); setMessages({ ...messages, [role]: event.target.value });
            }} />
          </label>
          <footer><span>{inbox}</span><button type="submit">{t('junction.draft')} <span aria-hidden="true">↗</span></button></footer>
        </form>
      </div>
    </div>
  </div>;
}
