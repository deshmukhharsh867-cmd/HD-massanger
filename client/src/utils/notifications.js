// ── Browser Push Notifications ─────────────────────────────────

let permission = 'default';

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') { permission = 'granted'; return true; }
  if (Notification.permission === 'denied')  { permission = 'denied';  return false; }
  const result = await Notification.requestPermission();
  permission = result;
  return result === 'granted';
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function sendNotification(title, body, options = {}) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return; // Don't notify when tab is active

  const n = new Notification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: options.tag || 'hd-msg',   // same tag = replaces previous notification
    renotify: true,
    silent: false,
    ...options
  });

  n.onclick = () => {
    window.focus();
    n.close();
    if (options.onClick) options.onClick();
  };

  // Auto close after 5s
  setTimeout(() => n.close(), 5000);
}

export function notifyMessage(fromName, text, onClick) {
  const preview = text.length > 60 ? text.slice(0, 57) + '...' : text;
  sendNotification(`💬 ${fromName}`, preview, { tag: `chat-${fromName}`, onClick });
}
