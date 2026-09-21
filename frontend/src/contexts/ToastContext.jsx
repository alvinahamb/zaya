import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

const ContexteToast = createContext(null);

const ICONES = { succes: CheckCircle2, erreur: AlertCircle, info: Info };

export function FournisseurToast({ children }) {
  const [toasts, setToasts] = useState([]);
  const compteur = useRef(0);

  const fermer = useCallback((id) => setToasts((liste) => liste.filter((t) => t.id !== id)), []);

  const notifier = useCallback(
    (message, type = 'succes') => {
      const id = ++compteur.current;
      setToasts((liste) => [...liste, { id, message, type }]);
      setTimeout(() => fermer(id), type === 'erreur' ? 6000 : 3500);
    },
    [fermer],
  );

  const valeur = useMemo(() => ({ notifier }), [notifier]);

  return (
    <ContexteToast.Provider value={valeur}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icone = ICONES[t.type] ?? Info;
          return (
            <div key={t.id} className={`toast toast--${t.type}`} onClick={() => fermer(t.id)}>
              <Icone size={18} />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ContexteToast.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ContexteToast);
}
