export const COLORS = ['#7c5cbf','#ff6b35','#e84393','#2dd4a0','#ffd166','#3a9bd5'];

export function avatarColor(name = '') {
  let h = 0;
  for (const c of name) h = Math.imul(31, h) + c.charCodeAt(0) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

export function initials(name = '') {
  return name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

export function roomId(a, b) { return [a, b].sort().join('_'); }

export function fmtFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImage(mimeType) {
  return mimeType?.startsWith('image/');
}
