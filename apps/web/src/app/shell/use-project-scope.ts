import {
  type Department,
  type ProjectScope,
  getDepartment,
  isDepartmentId,
  parseProjectScope,
  serializeProjectScope,
} from '@erp/shared';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';

/** The current project scope (from `?project=`) and a setter that keeps the rest of the URL. */
export function useProjectScope() {
  const search = useSearch({ strict: false }) as { project?: string };
  const navigate = useNavigate();
  const scope = parseProjectScope(search.project);

  const setScope = useCallback(
    (next: ProjectScope) => {
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => {
          const { project: _drop, ...rest } = prev;
          const value = serializeProjectScope(next);
          return value === undefined ? rest : { ...rest, project: value };
        },
      });
    },
    [navigate],
  );

  return { scope, setScope };
}

/** The department in the URL, if the current page is one. */
export function useCurrentDepartment(): Department | undefined {
  const params = useParams({ strict: false }) as { departmentId?: string };
  return isDepartmentId(params.departmentId) ? getDepartment(params.departmentId) : undefined;
}
