import { createRoot } from 'react-dom/client';
import { Landing } from './Landing/Landing';
import './site.css';

createRoot(document.getElementById('root')!).render(<Landing variant="observatory" palette="silver-gold" labels="junction" />);
