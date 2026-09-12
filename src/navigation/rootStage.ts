/**
 * Which group of screens the root navigator shows (docs/ARCHITECTURE.md §5).
 * Kept pure so the gating order is unit tested.
 */
export type RootStage = 'splash' | 'auth' | 'lock' | 'org' | 'app';

export interface RootStageInput {
  /** AuthProvider is still reading the persisted session. */
  initializing: boolean;
  signedIn: boolean;
  /** BiometricLockProvider has loaded the signed-in user's preference. */
  lockReady: boolean;
  locked: boolean;
  /** OrgProvider has started loading memberships for the signed-in user. */
  orgStarted: boolean;
  orgLoading: boolean;
  /** Memberships currently known (server or offline cache). */
  membershipCount: number;
  hasActiveOrg: boolean;
  /** Per-user walkthrough flag; null while it is being read. */
  walkthroughSeen: boolean | null;
}

export function getRootStage(input: RootStageInput): RootStage {
  if (input.initializing) {
    return 'splash';
  }
  if (!input.signedIn) {
    return 'auth';
  }
  if (!input.lockReady) {
    return 'splash';
  }
  if (input.locked) {
    return 'lock';
  }
  if (!input.orgStarted || (input.orgLoading && input.membershipCount === 0)) {
    return 'splash';
  }
  if (!input.hasActiveOrg) {
    return 'org';
  }
  if (input.walkthroughSeen === null) {
    return 'splash';
  }
  return 'app';
}
