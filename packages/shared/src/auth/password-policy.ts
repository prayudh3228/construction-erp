/**
 * Password rules for SETTING a password (not for signing in). Follows NIST SP 800-63B: long
 * passwords and a block-list instead of forced symbols/digits or regular expiry.
 * The same rules run in the browser (instant feedback) and in the API (the real check).
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** Well-known passwords that meet the length rule but are guessed first by attackers. */
const COMMON_PASSWORDS = new Set([
  '123456789012',
  '1234567890123',
  '12345678901234',
  '123456789012345',
  '1234567890qwerty',
  'qwertyuiop12',
  'qwertyuiop123',
  'qwerty123456',
  'qwertyuiopasdf',
  '1q2w3e4r5t6y',
  '1qaz2wsx3edc',
  'zaq12wsxcde3',
  'asdfghjkl123',
  'password1234',
  'password12345',
  'password@123',
  'password@1234',
  'passw0rd1234',
  'p@ssw0rd1234',
  'p@ssword1234',
  'iloveyou1234',
  'welcome12345',
  'welcome@1234',
  'welcome@123',
  'admin@123456',
  'administrator',
  'administrator1',
  'letmein12345',
  'changeme1234',
  'abcdefghijkl',
  'abcd1234abcd',
  'abc123abc123',
  'india@123456',
  'india1234567',
  'construction',
  'construction1',
  'construction@123',
  'company@1234',
  'trustno1trustno1',
  'football1234',
  'cricket12345',
  'sunshine1234',
  'princess1234',
  'monkey123456',
  'dragon123456',
  'starwars1234',
  'superman1234',
  'baseball1234',
  'whatever1234',
  'computer1234',
]);

/** Words that make a password easy to guess wherever they appear. */
const WEAK_FRAGMENTS = ['password', 'passw0rd', 'qwerty', 'letmein', '123456789'];

export interface PasswordContext {
  username?: string | null | undefined;
  email?: string | null | undefined;
  displayName?: string | null | undefined;
}

export type PasswordProblem =
  'too_short' | 'too_long' | 'common' | 'repetitive' | 'contains_personal_info';

export const PASSWORD_PROBLEM_MESSAGES: Record<PasswordProblem, string> = {
  too_short: `Use at least ${PASSWORD_MIN_LENGTH} characters. A short sentence works well.`,
  too_long: `Use at most ${PASSWORD_MAX_LENGTH} characters.`,
  common: 'This password is too common. Choose something less predictable.',
  repetitive: 'Avoid repeated characters or simple sequences like "aaaa" or "1234".',
  contains_personal_info: 'Do not use your name, username or email in your password.',
};

/** Length in characters as a person counts them (emoji and Devanagari count once). */
function charLength(value: string): number {
  return [...value].length;
}

function isRepetitive(lower: string): boolean {
  const chars = [...lower];
  if (new Set(chars).size <= 3) return true; // e.g. "aaaaaaaaaaaa", "abababababab"
  // A single run up or down a character sequence, e.g. "abcdefghijklm" or "987654321098".
  let ascending = 0;
  let descending = 0;
  for (let i = 1; i < chars.length; i++) {
    const d = chars[i]!.codePointAt(0)! - chars[i - 1]!.codePointAt(0)!;
    if (d === 1) ascending++;
    if (d === -1) descending++;
  }
  return ascending >= chars.length - 2 || descending >= chars.length - 2;
}

function personalTokens(ctx: PasswordContext): string[] {
  const tokens = new Set<string>();
  const add = (v: string | null | undefined) => {
    const t = v?.trim().toLowerCase();
    if (t && t.length >= 4) tokens.add(t);
  };
  add(ctx.username);
  add(ctx.email?.split('@')[0]);
  for (const part of ctx.displayName?.split(/\s+/) ?? []) add(part);
  return [...tokens];
}

/** All problems with a new password, most important first. An empty list means it is acceptable. */
export function checkPassword(password: string, ctx: PasswordContext = {}): PasswordProblem[] {
  const problems: PasswordProblem[] = [];
  const length = charLength(password);
  if (length < PASSWORD_MIN_LENGTH) problems.push('too_short');
  if (length > PASSWORD_MAX_LENGTH) problems.push('too_long');
  const lower = password.toLowerCase();
  const compact = lower.replace(/\s+/g, '');
  if (COMMON_PASSWORDS.has(lower) || COMMON_PASSWORDS.has(compact)) {
    problems.push('common');
  } else if (WEAK_FRAGMENTS.some((w) => compact.includes(w))) {
    problems.push('common');
  }
  if (length >= 1 && isRepetitive(compact)) problems.push('repetitive');
  if (personalTokens(ctx).some((t) => lower.includes(t))) problems.push('contains_personal_info');
  return problems;
}
