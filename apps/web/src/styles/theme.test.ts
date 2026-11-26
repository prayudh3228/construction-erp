import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tokensToCss } from '@erp/shared';
import { describe, expect, it } from 'vitest';

describe('generated theme stylesheet', () => {
  it('matches the shared tokens (run `pnpm --filter @erp/web theme` if this fails)', () => {
    const onDisk = readFileSync(resolve(process.cwd(), 'src/styles/theme.generated.css'), 'utf8');
    expect(onDisk.replace(/\r\n/g, '\n')).toBe(tokensToCss());
  });

  it('is the only place colours are defined: index.css has no hex colours', () => {
    const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
    expect(indexCss).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
