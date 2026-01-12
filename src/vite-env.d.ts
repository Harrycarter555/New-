/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  // add more env variables if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
