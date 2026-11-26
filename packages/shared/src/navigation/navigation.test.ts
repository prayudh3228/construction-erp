import { describe, expect, it } from 'vitest';
import { loginFormSchema } from '../auth/login.js';
import { brandingSchema, defaultBranding } from '../branding.js';
import {
  DEPARTMENTS,
  DEPARTMENT_GROUP_LABELS,
  DEPARTMENT_IDS,
  departmentAppliesTo,
  getDepartment,
  isDepartmentId,
  visibleDepartments,
} from './departments.js';
import {
  ALL_PROJECTS,
  COMPANY_WIDE,
  parseProjectScope,
  projectIdSchema,
  projectSummarySchema,
  sameScope,
  serializeProjectScope,
} from './project-scope.js';

describe('department registry', () => {
  it('lists the 13 departments from the brief, once each, in id order', () => {
    expect(DEPARTMENTS).toHaveLength(13);
    expect(DEPARTMENTS.map((d) => d.id)).toEqual([...DEPARTMENT_IDS]);
  });

  it('gives every department a label, description and known group', () => {
    for (const d of DEPARTMENTS) {
      expect(d.label.trim()).not.toBe('');
      expect(d.description.trim()).not.toBe('');
      expect(DEPARTMENT_GROUP_LABELS[d.group]).toBeDefined();
    }
  });

  it('marks Sales as development-only and Admin as not project-scoped', () => {
    expect(getDepartment('sales').appliesTo).toBe('development');
    expect(getDepartment('admin').projectScoped).toBe(false);
    expect(DEPARTMENTS.filter((d) => d.appliesTo !== 'all').map((d) => d.id)).toEqual(['sales']);
  });

  it('getDepartment throws on an unknown id', () => {
    expect(() => getDepartment('payroll' as never)).toThrow('Unknown department');
  });

  it('isDepartmentId accepts only registry ids', () => {
    expect(isDepartmentId('finance')).toBe(true);
    expect(isDepartmentId('Finance')).toBe(false);
    expect(isDepartmentId('')).toBe(false);
    expect(isDepartmentId(undefined)).toBe(false);
  });
});

describe('visibleDepartments', () => {
  it('shows everything for full access', () => {
    expect(visibleDepartments({ all: true })).toHaveLength(13);
  });

  it('shows only allowed departments, in registry order not list order', () => {
    const v = visibleDepartments({ departments: ['hr', 'finance'] });
    expect(v.map((d) => d.id)).toEqual(['finance', 'hr']);
  });

  it('shows nothing for an empty list and ignores unknown ids', () => {
    expect(visibleDepartments({ departments: [] })).toEqual([]);
    expect(
      visibleDepartments({ departments: ['nope' as never, 'stores'] }).map((d) => d.id),
    ).toEqual(['stores']);
  });

  it('returns a copy, so callers cannot change the registry', () => {
    const v = visibleDepartments({ all: true });
    v.pop();
    expect(DEPARTMENTS).toHaveLength(13);
  });
});

describe('departmentAppliesTo', () => {
  it('Sales takes development projects only; Finance takes both', () => {
    expect(departmentAppliesTo(getDepartment('sales'), 'development')).toBe(true);
    expect(departmentAppliesTo(getDepartment('sales'), 'contract')).toBe(false);
    expect(departmentAppliesTo(getDepartment('finance'), 'contract')).toBe(true);
    expect(departmentAppliesTo(getDepartment('finance'), 'development')).toBe(true);
  });
});

describe('project scope in the URL', () => {
  it.each([
    [undefined, ALL_PROJECTS],
    ['', ALL_PROJECTS],
    ['all', ALL_PROJECTS],
    ['company', COMPANY_WIDE],
    ['PRJ-001', { kind: 'project', projectId: 'PRJ-001' }],
    ['p_2', { kind: 'project', projectId: 'p_2' }],
  ])('parses %j', (input, expected) => {
    expect(parseProjectScope(input)).toEqual(expected);
  });

  it.each([['../etc'], ['a b'], ['-leading-dash'], ['x'.repeat(65)], [42], [null], [['PRJ-001']]])(
    'falls back to all projects for malformed %j',
    (input) => {
      expect(parseProjectScope(input)).toEqual(ALL_PROJECTS);
    },
  );

  it('leaves "all" out of the URL and round-trips the others', () => {
    expect(serializeProjectScope(ALL_PROJECTS)).toBeUndefined();
    expect(serializeProjectScope(COMPANY_WIDE)).toBe('company');
    const p = { kind: 'project', projectId: 'PRJ-007' } as const;
    expect(parseProjectScope(serializeProjectScope(p))).toEqual(p);
    expect(parseProjectScope(serializeProjectScope(COMPANY_WIDE))).toEqual(COMPANY_WIDE);
    expect(parseProjectScope(serializeProjectScope(ALL_PROJECTS))).toEqual(ALL_PROJECTS);
  });

  it('compares scopes by value', () => {
    expect(
      sameScope({ kind: 'project', projectId: 'A' }, { kind: 'project', projectId: 'A' }),
    ).toBe(true);
    expect(
      sameScope({ kind: 'project', projectId: 'A' }, { kind: 'project', projectId: 'B' }),
    ).toBe(false);
    expect(sameScope(ALL_PROJECTS, COMPANY_WIDE)).toBe(false);
  });

  it('"all" and "company" are reserved and can never be project ids', () => {
    for (const id of ['all', 'company', 'Company', 'ALL']) {
      expect(projectIdSchema.safeParse(id).success).toBe(false);
    }
    expect(projectIdSchema.safeParse('company-hq').success).toBe(true);
  });
});

describe('projectSummarySchema', () => {
  const ok = {
    id: 'PRJ-001',
    code: 'PRJ-001',
    name: 'Demo Tower',
    type: 'contract',
    status: 'active',
    city: 'Pune',
  };
  it('accepts a valid project and rejects a bad type or id', () => {
    expect(projectSummarySchema.parse(ok)).toEqual(ok);
    expect(projectSummarySchema.safeParse({ ...ok, type: 'both' }).success).toBe(false);
    expect(projectSummarySchema.safeParse({ ...ok, id: 'a b' }).success).toBe(false);
  });
});

describe('loginFormSchema', () => {
  it('trims the username and requires both fields', () => {
    expect(loginFormSchema.parse({ username: '  asha ', password: 'x' })).toEqual({
      username: 'asha',
      password: 'x',
    });
    const r = loginFormSchema.safeParse({ username: '   ', password: '' });
    expect(r.success).toBe(false);
    const messages = r.error?.issues.map((i) => i.message);
    expect(messages).toEqual(['Enter your username or email.', 'Enter your password.']);
  });

  it('does not trim the password (spaces can be part of it)', () => {
    expect(loginFormSchema.parse({ username: 'a', password: ' p ' }).password).toBe(' p ');
  });

  it('rejects over-long input', () => {
    expect(loginFormSchema.safeParse({ username: 'a'.repeat(121), password: 'x' }).success).toBe(
      false,
    );
    expect(loginFormSchema.safeParse({ username: 'a', password: 'x'.repeat(201) }).success).toBe(
      false,
    );
  });
});

describe('branding', () => {
  it('ships neutral placeholders that pass its own schema', () => {
    expect(brandingSchema.parse(defaultBranding)).toEqual(defaultBranding);
    expect(defaultBranding.companyName).toBe('Your Company Name');
  });
  it('rejects a blank company name', () => {
    expect(brandingSchema.safeParse({ ...defaultBranding, companyName: '  ' }).success).toBe(false);
  });
});
