import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { sessionStore } from './app/session';
import { demoProjectsSource, setProjectsSource } from './data/projects';

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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.localStorage.clear();
  window.sessionStorage.clear();
  sessionStore.reset();
  setProjectsSource(demoProjectsSource);
});
