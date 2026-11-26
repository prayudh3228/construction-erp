/** Current time, injectable so tests can move time forward (session timeouts, lockouts). */
export const CLOCK = Symbol('CLOCK');

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
