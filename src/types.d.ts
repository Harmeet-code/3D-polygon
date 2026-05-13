/**
 * Global type augmentations for viewer_interactive.js
 */

declare global {
  interface Window {
    DEBUG: Record<string, any>;
    AUDIT: Record<string, any>;
  }
}

export {};
