export function useDecisionRegistryAccess() {
  // Temporarily hidden for everyone, including super-admins. Keep stored access intact.
  return { canAccess: false, loading: false };
}
