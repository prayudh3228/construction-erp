import { type ProjectSummary } from '@erp/shared';

/**
 * FAKE demo data. Every name here is invented; none refers to a real project, client or person.
 */
export const DEMO_PROJECTS: readonly ProjectSummary[] = [
  {
    id: 'PRJ-001',
    code: 'PRJ-001',
    name: 'Riverside Business Park, Block A',
    type: 'contract',
    status: 'active',
    city: 'Pune',
  },
  {
    id: 'PRJ-002',
    code: 'PRJ-002',
    name: 'Greenfield Homes, Phase 1',
    type: 'development',
    status: 'active',
    city: 'Nashik',
  },
  {
    id: 'PRJ-003',
    code: 'PRJ-003',
    name: 'District Hospital Annexe',
    type: 'contract',
    status: 'active',
    city: 'Aurangabad',
  },
  {
    id: 'PRJ-004',
    code: 'PRJ-004',
    name: 'Lakeview Residency Towers',
    type: 'development',
    status: 'planned',
    city: 'Pune',
  },
  {
    id: 'PRJ-005',
    code: 'PRJ-005',
    name: 'Ring Road Flyover Pier Works',
    type: 'contract',
    status: 'on_hold',
    city: 'Nagpur',
  },
  {
    id: 'PRJ-006',
    code: 'PRJ-006',
    name: 'Sunrise Row Houses',
    type: 'development',
    status: 'completed',
    city: 'Kolhapur',
  },
];

export interface DemoUser {
  name: string;
  roleLabel: string;
}

/** The one-click demo user. Sees every department (Director-like) until Phase 3 adds roles. */
export const DEMO_USER: DemoUser = { name: 'Demo Director', roleLabel: 'Director (demo)' };
