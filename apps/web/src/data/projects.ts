import { type ProjectSummary, projectSummarySchema } from '@erp/shared';
import { useQuery } from '@tanstack/react-query';
import { DEMO_PROJECTS } from '@/demo/fixtures';
import { isDemoMode } from '@/lib/env';

/**
 * Where the shells get their project list. Phase 1 uses fake demo projects; Phase 5 swaps in an
 * API-backed source (and Phase 3 limits it to the projects assigned to the user) without the
 * screens changing.
 */
export interface ProjectsSource {
  list(signal?: AbortSignal): Promise<ProjectSummary[]>;
}

/** Fake projects in demo mode; nothing otherwise, so a non-demo build never shows fake data. */
export const demoProjectsSource: ProjectsSource = {
  list: () =>
    Promise.resolve(isDemoMode() ? DEMO_PROJECTS.map((p) => projectSummarySchema.parse(p)) : []),
};

let activeSource: ProjectsSource = demoProjectsSource;

/** Tests use this to simulate slow, failing or empty sources. */
export function setProjectsSource(source: ProjectsSource): void {
  activeSource = source;
}

export const projectsQueryKey = ['projects', 'summary'] as const;

export function useProjects() {
  return useQuery({
    queryKey: projectsQueryKey,
    queryFn: ({ signal }) => activeSource.list(signal),
    staleTime: 60_000,
  });
}
