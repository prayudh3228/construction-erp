/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" turns on fake demo data and the one-click demo sign-in. */
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
