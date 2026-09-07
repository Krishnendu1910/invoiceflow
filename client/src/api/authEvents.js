// Lets the axios layer (outside the React tree) tell AuthContext that the
// session ended — e.g. a silent refresh failed while the user was mid-session.
const listeners = new Set();

export function onSessionExpired(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSessionExpired() {
  listeners.forEach((listener) => listener());
}
