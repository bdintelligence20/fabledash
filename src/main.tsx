import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoadingPage } from './components/ui/LoadingPage';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<LoadingPage />}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </Suspense>
    </ErrorBoundary>
  </StrictMode>
);
