import { io } from 'socket.io-client';

let socket = null;

export function connectSocket(token) {
  // Always disconnect any existing socket before creating a new one
  if (socket) {
    socket.off();        // remove all listeners
    socket.disconnect();
    socket = null;
  }
  socket = io('/', {
    auth: { token },
    transports: ['websocket'],
    forceNew: true       // always create a fresh connection
  });
  return socket;
}

export function getSocket() { return socket; }

export function disconnectSocket() {
  if (socket) {
    socket.off();
    socket.disconnect();
    socket = null;
  }
}
