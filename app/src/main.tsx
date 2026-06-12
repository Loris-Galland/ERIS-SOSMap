/*
 * Application entry point for the ERIS Safety React app.
 * Mounts the root App component into the DOM under React StrictMode and
 * bootstraps the i18n module (./i18n) so translations are ready before any
 * component renders. This file is the Vite entry point referenced in index.html.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './i18n';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
