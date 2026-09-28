/*
 * Service worker de Zaya : uniquement pour les notifications système.
 * Sur Android, `new Notification()` est interdit dans la page ; il faut passer
 * par `registration.showNotification()`. Aucun cache, aucune interception réseau.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Clic sur une notification : on ramène l'app au premier plan sur la bonne page
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const lien = e.notification.data?.lien || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      const fenetre = fenetres[0];
      if (fenetre) {
        fenetre.postMessage({ type: 'zaya:naviguer', lien });
        return fenetre.focus();
      }
      return self.clients.openWindow(lien);
    }),
  );
});
