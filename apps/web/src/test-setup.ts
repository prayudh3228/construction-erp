import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetApiActivity } from './api/client';
import { demoProjectsSource, setProjectsSource } from './data/projects';
import { resetFakeAuth } from './test/fake-auth';

// jsdom lacks a few browser APIs that Radix UI and cmdk call.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

// The full suite runs files in parallel; give async queries room on a busy machine.
configure({ asyncUtilTimeout: 3000 });

// Every test starts signed out against an in-memory fake API (never the network).
beforeEach(() => {
  resetFakeAuth();
  resetApiActivity();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.localStorage.clear();
  window.sessionStorage.clear();
  setProjectsSource(demoProjectsSource);
});
