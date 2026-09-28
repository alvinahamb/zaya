/** Notifications système du navigateur (rappels de tâches). */

export const permissionNavigateur = () => (typeof Notification === 'undefined' ? 'indisponible' : Notification.permission);

export function enregistrerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {
    /* sans service worker, on retombe sur new Notification() (ordinateur uniquement) */
  });
}

async function enregistrementActif() {
  if (!('serviceWorker' in navigator)) return null;
  // ready ne se résout jamais si l'enregistrement a échoué : on borne l'attente
  return Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 2000))]);
}

/** Affiche une notification ; `lien` est ouvert dans l'app au clic. */
export async function afficherNotification(titre, { corps, tag, lien = '/' } = {}) {
  if (permissionNavigateur() !== 'granted') return;
  const options = { body: corps, tag, icon: '/icone.png', badge: '/icone.png', data: { lien } };
  try {
    const enregistrement = await enregistrementActif();
    if (enregistrement) {
      await enregistrement.showNotification(titre, options);
      return;
    }
    const notification = new Notification(titre, options);
    notification.onclick = () => {
      window.focus();
      window.location.assign(lien);
    };
  } catch {
    /* navigateur sans notifications système */
  }
}
