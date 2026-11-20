import { createRoot } from 'react-dom/client';
import { Landing } from './Landing/Landing';
import { contactTransport } from './Landing/contact-client';
import './site.css';

// The site key is public and the widget only runs on the canonical hostname.
const sendContact = location.origin === 'https://satoramoto.com' ? contactTransport('0x4AAAAAAGJ-JO5WoaQGhDO1') : undefined;

createRoot(document.getElementById('root')!).render(<Landing variant="observatory" palette="silver-gold" labels="junction" sendContact={sendContact} />);
