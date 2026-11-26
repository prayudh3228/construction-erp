import { describe, expect, it } from 'vitest';
import { projectSummarySchema } from '../navigation/project-scope.js';
import { DEMO_PROJECTS, DEMO_USER } from './index.js';

describe('demo data', () => {
  it('every demo project is valid, with unique ids and codes', () => {
    for (const p of DEMO_PROJECTS) expect(projectSummarySchema.parse(p)).toEqual(p);
    expect(new Set(DEMO_PROJECTS.map((p) => p.id)).size).toBe(DEMO_PROJECTS.length);
    expect(new Set(DEMO_PROJECTS.map((p) => p.code)).size).toBe(DEMO_PROJECTS.length);
  });

  it('covers both project types and every status, so each screen state can be reviewed', () => {
    expect(new Set(DEMO_PROJECTS.map((p) => p.type))).toEqual(new Set(['contract', 'development']));
    expect(new Set(DEMO_PROJECTS.map((p) => p.status))).toEqual(
      new Set(['planned', 'active', 'on_hold', 'completed']),
    );
  });

  it('the demo user is clearly labelled as a demo', () => {
    expect(DEMO_USER.roleLabel).toMatch(/demo/i);
  });
});
