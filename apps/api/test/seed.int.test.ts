import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runSeeds } from '../prisma/seed/runner';
import { type Seed, seeds } from '../prisma/seed/seeds';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
});
const TEST_PREFIX = 'zz-test-';

async function cleanTestRows(): Promise<void> {
  await prisma.seedRun.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
}

describe('seed runner', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });
  beforeEach(cleanTestRows);
  afterAll(async () => {
    await cleanTestRows();
    await prisma.$disconnect();
  });

  it('applies each seed once, in name order, and skips it next time', async () => {
    const order: string[] = [];
    const testSeeds: Seed[] = [
      { name: `${TEST_PREFIX}b`, description: '', run: async () => void order.push('b') },
      { name: `${TEST_PREFIX}a`, description: '', run: async () => void order.push('a') },
    ];
    const first = await runSeeds(prisma, testSeeds);
    expect(first.applied).toEqual([`${TEST_PREFIX}a`, `${TEST_PREFIX}b`]);
    expect(order).toEqual(['a', 'b']);

    const second = await runSeeds(prisma, testSeeds);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual([`${TEST_PREFIX}a`, `${TEST_PREFIX}b`]);
    expect(order).toEqual(['a', 'b']);
  });

  it('rolls back a failing seed and does not record it', async () => {
    const failing: Seed = {
      name: `${TEST_PREFIX}fail`,
      description: '',
      run: async (tx) => {
        await tx.seedRun.create({ data: { name: `${TEST_PREFIX}side-effect` } });
        throw new Error('boom');
      },
    };
    await expect(runSeeds(prisma, [failing])).rejects.toThrow('boom');
    const rows = await prisma.seedRun.count({ where: { name: { startsWith: TEST_PREFIX } } });
    expect(rows).toBe(0);
  });

  it('rejects duplicate seed names', async () => {
    const dup: Seed = { name: `${TEST_PREFIX}dup`, description: '', run: async () => {} };
    await expect(runSeeds(prisma, [dup, dup])).rejects.toThrow(/unique/);
  });

  it('ships only uniquely named seeds', () => {
    const names = seeds.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
