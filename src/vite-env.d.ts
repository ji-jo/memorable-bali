/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * PUBLIC BY DESIGN — compiled into the client bundle and readable by anyone.
   * Protected by HTTP referrer restrictions and quota caps in Google Cloud,
   * not by secrecy. See docs/07-Google-Maps.md.
   */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  /** Vector Map ID. Required for AdvancedMarkerElement (our custom pins). */
  readonly VITE_GOOGLE_MAPS_MAP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
