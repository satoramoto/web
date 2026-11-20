import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from 'react';
import { Copy, t } from '../../i18n/copy';
import type { JunctionRole } from './junctionCircuit';
import './junction-contact.css';

const roles = ['visionary', 'accelerator'] as const;
const inbox = t('junction.recipient');

// The WebGL conductors use these same polylines as their layout coordinates.
function Die() {
  return <svg className="junction-die" viewBox="0 0 56 48" preserveAspectRatio="none" fill="none" aria-hidden="true">
    <g strokeLinejoin="round">
      <polyline className="die-pin die-pin--upper" points="38,16 44,12 50,18 56,18" />
      <polyline className="die-pin die-pin--lower" points="38,29 44,32 50,30 56,30" />
      <path d="m3 24 20 11 20-11v5L23 40 3 29Z" fill="#11151c" stroke="#6b7381" />
      <path d="m3 19 20 11 20-11v5L23 35 3 24Z" fill="#141923" stroke="#818b9b" />
      <path d="M3 18 23 7l20 11-20 12Z" fill="#202732" stroke="#b3bac6" />
      <path className="die-core" d="m14 18 9-5 9 5-9 5Z" />
    </g>
  </svg>;
}

function Route({ upper }: { upper: boolean }) {
  return <svg className="junction-route" viewBox="0 0 64 64" preserveAspectRatio="none" fill="none" aria-hidden="true">
    <g transform={upper ? undefined : 'translate(0 64) scale(1 -1)'}>
      <polyline points="0,58 10,58 36,32 44,32" />
      <path d="M44 32h13" strokeDasharray="2 3" />
      <circle cx="60" cy="32" r="2.5" />
    </g>
  </svg>;
}

type Props = { junctionRef: RefObject<HTMLDivElement | null>; onRoute: (role: JunctionRole | null) => boolean };

export function JunctionContact({ junctionRef, onRoute }: Props) {
  const [step, setStep] = useState<'choose' | 'charge' | 'reply'>('choose');
  const [role, setRole] = useState<JunctionRole>('visionary');
  const [email, setEmail] = useState('');
  const [messages, setMessages] = useState({ visionary: '', accelerator: '' });
  const emailRef = useRef<HTMLInputElement>(null), messageRef = useRef<HTMLTextAreaElement>(null);
  const returning = useRef(false);
  const formId = useId(), headingId = useId();
  const reply = step === 'reply';

  function choose(who: JunctionRole) {
    if (step !== 'choose') return;
    setRole(who);
    setStep(onRoute(who) ? 'charge' : 'reply');
  }
  useEffect(() => {
    if (step === 'charge') {
      const timer = window.setTimeout(() => setStep('reply'), 380);
      return () => window.clearTimeout(timer);
    }
    if (step === 'reply') emailRef.current?.focus({ preventScroll: true });
    else if (returning.current) {
      junctionRef.current?.querySelector<HTMLButtonElement>(`[data-role="${role}"]`)?.focus({ preventScroll: true });
      returning.current = false;
    }
  }, [step, role, junctionRef]);

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

  return <section className="junction-console" data-step={step} data-selected={role} aria-label={t('landing.contact')}>
    <div className="junction-panel" data-open={!reply} inert={reply} aria-hidden={reply}>
      <div className="junction-clip">
        <h2 id={headingId} className="junction-heading">{t('landing.contact')}</h2>
        <div className="contact--junction" role="group" aria-labelledby={headingId} ref={junctionRef}>
          <Die />
          {roles.map(who => <button key={who} type="button" className="junction-choice" data-role={who}
            aria-controls={formId} aria-expanded={reply && who === role} aria-disabled={step === 'charge' || undefined}
            onClick={() => choose(who)}>
            <Route upper={who === 'visionary'} /><span className="junction-question"><Copy k={`junction.question.${who}`} /></span>
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
  </section>;
}
