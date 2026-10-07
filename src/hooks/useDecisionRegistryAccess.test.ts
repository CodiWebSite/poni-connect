import { describe, expect, it } from 'vitest';
import { useDecisionRegistryAccess } from './useDecisionRegistryAccess';

describe('temporary decision registry visibility', () => {
  it('denies frontend access to everyone without waiting for a role check', () => {
    expect(useDecisionRegistryAccess()).toEqual({ canAccess: false, loading: false });
  });
});