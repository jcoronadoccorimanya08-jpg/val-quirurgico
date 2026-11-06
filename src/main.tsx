import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initStore } from './lib/store';
import './styles/app.css';

void initStore();

// La versión 1 de la app usaba su propio caché ("valq-v1"); se borra para que no quede ocupando espacio.
if ('caches' in window) void caches.delete('valq-v1').catch(() => undefined);

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
