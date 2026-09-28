import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { FournisseurAuth } from './contexts/AuthContext.jsx';
import { FournisseurToast } from './contexts/ToastContext.jsx';
import { enregistrerServiceWorker } from './lib/notifications.js';

enregistrerServiceWorker();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <FournisseurToast>
        <FournisseurAuth>
          <App />
        </FournisseurAuth>
      </FournisseurToast>
    </BrowserRouter>
  </StrictMode>,
);
