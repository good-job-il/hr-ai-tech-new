// Employer recruitment uses the accessible organization pool, never personal ownership.
// This only selects a UI filter; server permissions remain authoritative.
export function candidatePoolScope(kind, requested) {
  return kind === 'agency' && ['all', 'mine', 'shared', 'personal'].includes(requested) ? requested : 'all';
}
