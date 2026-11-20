import { t } from '../../i18n/copy';
import './contact-paths.css';

export type ContactTreatment = 'original' | 'hairline-edge' | 'quiet-pill' | 'junction' | 'marginalia' | 'keybed';

const paths = [
  { role: 'visionary', question: 'need', subject: 'I need compute' },
  { role: 'accelerator', question: 'have', subject: 'I have compute' },
] as const;

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
    case 'marginalia':
      return <>{question}{role}<NoteArrow /></>;
    case 'keybed':
      return <><span className="key-face"><KeyMark inward={path.role === 'visionary'} />{question}</span>{role}</>;
    default:
      return <>{role}{question}</>;
  }
}

export function ContactPaths({ treatment }: { treatment: Exclude<ContactTreatment, 'junction'> }) {
  return <nav className={`opal-paths contact--${treatment}`} aria-label={t('landing.contact')}>
    {paths.map(path => <a key={path.role} data-role={path.role} href={`mailto:hello@satoramoto.com?subject=${encodeURIComponent(path.subject)}`}>
      <Inscription path={path} treatment={treatment} />
    </a>)}
  </nav>;
}
