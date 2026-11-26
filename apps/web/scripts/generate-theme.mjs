// Writes src/styles/theme.generated.css from the shared design tokens.
// Run: pnpm --filter @erp/web theme   (the shared package must be built first)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tokensToCss } from '@erp/shared';

const target = fileURLToPath(new URL('../src/styles/theme.generated.css', import.meta.url));
writeFileSync(target, tokensToCss());
console.warn(`Wrote ${target}`);
