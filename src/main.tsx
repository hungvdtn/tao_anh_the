import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import ReactGA from 'react-ga4';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

// Polyfill global for libraries that expect it
if (typeof (window as any).global === 'undefined') {
  (window as any).global = window;
}

// Initialize GA4
const GA_MEASUREMENT_ID = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_GA_MEASUREMENT_ID : undefined;
if (GA_MEASUREMENT_ID) {
  try {
    ReactGA.initialize(GA_MEASUREMENT_ID);
    ReactGA.send({ hitType: "pageview", page: window.location.pathname });
  } catch (gaError) {
    console.error("GA4 Initialization Error:", gaError);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
