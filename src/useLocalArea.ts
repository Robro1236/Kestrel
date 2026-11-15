import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import type { Area } from '../app/plan';
import type { PlacesResult } from './components/NearbyHelp';
import type { ResolvedLocation } from './data/location';
import type { Warnings } from './data/nws';
import type { Household } from './kit/rules';
import { load, loadResult, saveResult } from './storage';
import { lookup } from './supabase';

export type LocalArea = {
  place: ResolvedLocation;
  household: Household;
  area: Area | null;
  areaFailed: boolean;
  inUs: boolean;
  warnings: Warnings | null;
  places: PlacesResult | null;
};

// What the detail screens (hazards, water, help, county) need: the saved plan data, read once.
// Shows the saved area at once, then refreshes it like the plan does, so a changed location never sticks to the old county.
export function useLocalArea(): LocalArea | null {
  const router = useRouter();
  const [state, setState] = useState<LocalArea | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const [l, h, a, w, p] = await Promise.all([
        load<ResolvedLocation>('location'),
        load<Household>('household'),
        loadResult<Area>('area'),
        loadResult<Warnings>('warnings'),
        loadResult<PlacesResult>('places'),
      ]);
      if (!live) return;
      if (!l || !h) return router.replace('/setup');
      // Same rule as the plan: until the area answers, trust the saved country (ZIPs are US); GPS has none, so assume US.
      const guessUs = (l.countryCode ?? 'US') === 'US';
      setState({
        place: l,
        household: h,
        area: a?.data ?? null,
        areaFailed: false,
        inUs: a ? a.data.in_us : guessUs,
        // Storage keeps one warnings copy; only use it for the same point.
        warnings: w && w.data.lat === l.lat && w.data.lon === l.lon ? w.data : null,
        places: p?.data ?? null,
      });
      try {
        const fresh = await lookup<Area>('area', l.lat, l.lon);
        await saveResult('area', fresh);
        if (live) setState((s) => s && { ...s, area: fresh, inUs: fresh.in_us });
      } catch {
        if (live) setState((s) => s && { ...s, areaFailed: true });
      }
    })();
    return () => {
      live = false;
    };
  }, [router]);
  return state;
}
