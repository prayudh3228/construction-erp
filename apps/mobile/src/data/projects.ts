import { type ProjectSummary } from '@erp/shared';
import { DEMO_PROJECTS } from '@erp/shared/demo';
import { useCallback, useEffect, useState } from 'react';
import { isDemoMode } from '@/lib/demo';

/**
 * Where the app gets the user's projects. Demo projects now (none outside demo mode); Phase 5
 * swaps in the API and Phase 28 caches it on the phone for offline use.
 */
export interface ProjectsSource {
  list(): Promise<ProjectSummary[]>;
}

export const demoProjectsSource: ProjectsSource = {
  list: () => Promise.resolve(isDemoMode() ? [...DEMO_PROJECTS] : []),
};

let activeSource: ProjectsSource = demoProjectsSource;

/** Tests use this to simulate slow, failing or empty sources. */
export function setProjectsSource(source: ProjectsSource): void {
  activeSource = source;
}

export type ProjectsResult =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'success'; data: ProjectSummary[] };

export function useProjects(): ProjectsResult {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<
    { attempt: number; data: ProjectSummary[] } | { attempt: number; error: true } | null
  >(null);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    let live = true;
    activeSource.list().then(
      (data) => live && setResult({ attempt, data }),
      () => live && setResult({ attempt, error: true }),
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  // A result from an earlier attempt means a retry is in flight: show loading again.
  if (!result || result.attempt !== attempt) return { status: 'loading' };
  if ('error' in result) return { status: 'error', retry };
  return { status: 'success', data: result.data };
}
