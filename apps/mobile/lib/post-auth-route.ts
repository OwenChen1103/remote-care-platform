/**
 * Post-authentication routing (Section 4.1.9).
 *
 * Called after login() / register() succeed. Routes the user to their role-appropriate
 * landing screen. For provider, additionally probes /provider/me to decide whether to
 * land on the task list (approved) or the onboarding/profile screen (pending/rejected/suspended).
 *
 * Why no JWT-based decision: the JWT only contains role, not provider review_status.
 * Probing /provider/me is one extra request after auth — acceptable cost for one nav decision.
 */
import type { Router } from 'expo-router';
import { api, ApiError } from './api-client';

interface ProviderMeProbe {
  review_status: string;
  submitted_at: string | null;
}

export async function routeAfterAuth(
  user: { role: string },
  router: Router,
): Promise<void> {
  if (user.role === 'provider') {
    try {
      const me = await api.get<ProviderMeProbe>('/provider/me');
      if (me.review_status === 'approved') {
        router.replace('/(tabs)/services/provider-tasks');
      } else {
        // pending / rejected / suspended → land on profile so provider sees status banner
        router.replace('/(tabs)/services/provider-profile');
      }
    } catch (e) {
      // Network/auth failure during probe → fall back to profile screen.
      // Provider will see the same screen they'd see if onboarding incomplete.
      void e; // intentional: silently fall back
      if (e instanceof ApiError) {
        router.replace('/(tabs)/services/provider-profile');
      } else {
        router.replace('/(tabs)/services/provider-profile');
      }
    }
    return;
  }
  if (user.role === 'patient') {
    router.replace('/(tabs)/patient/summary');
    return;
  }
  // caregiver (default) and admin (admin uses web; mobile fallback)
  router.replace('/(tabs)/home');
}
