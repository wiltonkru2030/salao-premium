/**
 * Módulo: notificationService.js
 * Responsabilidade: consultar e atualizar notificações destinadas à cliente.
 * Lembretes futuros devem ser disparados pelo backend, mesmo com o app fechado.
 */
function notReady() {
  const error = new Error("A central de notificações ainda está sendo preparada.");
  error.code = "NOTIFICATIONS_NOT_READY";
  return error;
}
export async function listNotifications() { throw notReady(); }
export async function markNotificationRead() { throw notReady(); }
export async function markAllNotificationsRead() { throw notReady(); }
