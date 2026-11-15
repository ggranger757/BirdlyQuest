import { createRoot } from 'react-dom/client';
import './ui/styles.css';
import { App, ErrorBoundary } from './ui/App';
import { initStore } from './app/store';

initStore();
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary><App /></ErrorBoundary>,
);
