import { t } from '../../i18n/copy';
import './contact-paths.css';

export type ContactTreatment = 'original' | 'hairline-edge' | 'quiet-pill' | 'junction' | 'marginalia' | 'keybed';

const paths = [
  { role: 'visionary', question: 'need', subject: 'I need compute' },
  { role: 'accelerator', question: 'have', subject: 'I have compute' },
] as const;

// The two pins meet the route SVGs at ±6px from the center of the die.
function JunctionDie() {
  return <svg className="junction-die" viewBox="0 0 56 48" preserveAspectRatio="none" fill="none" aria-hidden="true">
    <g strokeLinejoin="round">
      <path className="die-pin die-pin--upper" d="M38 16l6-4 6 6h6" />
      <path className="die-pin die-pin--lower" d="m38 29 6 3 6-2h6" />
      <path d="m3 24 20 11 20-11v5L23 40 3 29Z" fill="#11151c" stroke="#6b7381" />
      <path d="m3 19 20 11 20-11v5L23 35 3 24Z" fill="#141923" stroke="#818b9b" />
      <path d="M3 18 23 7l20 11-20 12Z" fill="#202732" stroke="#b3bac6" />
      <path d="m14 18 9-5 9 5-9 5Z" stroke="#788292" />
    </g>
  </svg>;
}

function JunctionRoute({ upper }: { upper: boolean }) {
  return <svg className="junction-route" viewBox="0 0 64 48" preserveAspectRatio="none" fill="none" aria-hidden="true">
    <g transform={upper ? undefined : 'translate(0 48) scale(1 -1)'}>
      <path d="M0 42h12l18-18h14" />
      <path d="M44 24h13" strokeDasharray="2 3" />
      <circle cx="60" cy="24" r="2.5" />
    </g>
  </svg>;
}

function NoteArrow() {
  return <span className="note-arrow" aria-hidden="true">
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M4 10h11m-5-5 5 5-5 5" />
    </svg>
  </span>;
}

// Two marks from the same printing plate: fan in / fan out.
function KeyMark({ inward }: { inward: boolean }) {
  return <svg className="key-mark" viewBox="0 0 25 15" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <g transform={inward ? undefined : 'translate(25 0) scale(-1 1)'}>
      <path d="M1 2h5l7 5.5H24M1 7.5h12M1 13h5l7-5.5" />
    </g>
  </svg>;
}

function Inscription({ path, treatment }: { path: typeof paths[number]; treatment: ContactTreatment }) {
  const role = <span className="opal-path-label">{t(`landing.${path.role}`)}</span>;
  const withArrow = treatment === 'original' || treatment === 'hairline-edge';
  const question = <strong className="contact-question">
    {t(`landing.${path.question}`)}{withArrow && <> <i aria-hidden="true">↗</i></>}
  </strong>;

  switch (treatment) {
    case 'junction':
      return <><JunctionRoute upper={path.role === 'visionary'} /><span className="junction-end">{question}{role}</span></>;
    case 'marginalia':
      return <>{question}{role}<NoteArrow /></>;
    case 'keybed':
      return <><span className="key-face"><KeyMark inward={path.role === 'visionary'} />{question}</span>{role}</>;
    default:
      return <>{role}{question}</>;
  }
}

export function ContactPaths({ treatment }: { treatment: ContactTreatment }) {
  return <nav className={`opal-paths contact--${treatment}`} aria-label={t('landing.contact')}>
    {treatment === 'junction' && <JunctionDie />}
    {paths.map(path => <a key={path.role} data-role={path.role} href={`mailto:hello@satoramoto.com?subject=${encodeURIComponent(path.subject)}`}>
      <Inscription path={path} treatment={treatment} />
    </a>)}
  </nav>;
}
