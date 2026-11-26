import { type PrismaClient } from '../../src/generated/prisma/client';
import { type Seed } from './seeds';

export interface SeedResult {
  applied: string[];
  skipped: string[];
}

/** Arbitrary constant key for the Postgres advisory lock that serialises seeding. */
const SEED_LOCK_KEY = 4_217_001;

/**
 * Applies each seed not yet recorded in seed_runs, each inside its own transaction.
 * An advisory lock makes concurrent runners (e.g. two API containers starting together)
 * take turns, so a seed is never applied twice.
 */
export async function runSeeds(prisma: PrismaClient, seeds: readonly Seed[]): Promise<SeedResult> {
  const names = seeds.map((s) => s.name);
  if (new Set(names).size !== names.length) throw new Error('Seed names must be unique');

  const result: SeedResult = { applied: [], skipped: [] };
  for (const seed of [...seeds].sort((a, b) => a.name.localeCompare(b.name))) {
    const applied = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SEED_LOCK_KEY})`;
      if (await tx.seedRun.findUnique({ where: { name: seed.name } })) return false;
      await seed.run(tx);
      await tx.seedRun.create({ data: { name: seed.name } });
      return true;
    });
    (applied ? result.applied : result.skipped).push(seed.name);
  }
  return result;
}
