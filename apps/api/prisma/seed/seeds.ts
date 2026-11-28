import { type PrismaClient } from '../../src/generated/prisma/client';
import { demoTwoFactorRekeySeed, demoTwoFactorSeed } from './demo-two-factor';
import { demoUsersSeed } from './demo-users';

/**
 * A seed adds FAKE demo data only. Never put real names, PANs, GSTINs or bank details here.
 * Seeds run in name order, once each; the name is recorded in seed_runs.
 * To change demo data later, add a new seed rather than editing an applied one.
 */
export interface Seed {
  name: string;
  description: string;
  run(
    tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>,
  ): Promise<void>;
}

export const seeds: Seed[] = [
  {
    name: '0000-baseline',
    description: 'Marks the empty baseline. Later phases add demo data in new seeds.',
    async run() {
      // Nothing to insert yet: Phase 0 has no business tables.
    },
  },
  demoUsersSeed(),
  demoTwoFactorSeed(),
  demoTwoFactorRekeySeed(),
];
