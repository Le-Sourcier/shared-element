import type { ReactNode } from 'react';

export type Frame = { x: number; y: number; width: number; height: number };

export type SnapshotKind = 'view' | 'image';

export type Snapshot = {
  id: string;
  frame: Frame;
  // The element to clone into the overlay during transition.
  render: () => ReactNode;
  // Style hints copied so the overlay clone matches visually.
  borderRadius?: number;
};

/**
 * Built-in transition styles. Choose based on what's actually changing:
 * - `morph`  (default): rectangle → rectangle. Crossfades content while
 *   springing position + size + radius. Best for image/card hero transitions.
 * - `fade`:   no movement. Pure crossfade in place. Use when source and
 *   destination occupy roughly the same screen position.
 * - `shape`:  emphasizes radius + scale with a softer spring. Designed for
 *   "button → FAB", "tag → chip-detail", or any transform where the *shape*
 *   is the story (not the position).
 * - `push`:   slides from source to destination with minimal scaling. Good
 *   for elements that should feel like they're being repositioned (e.g.
 *   carousel item → list row in the same column).
 */
export type TransitionPreset = 'morph' | 'fade' | 'shape' | 'push';

export type TransitionConfig = {
  preset?: TransitionPreset;
  duration?: number;
  damping?: number;
  stiffness?: number;
  mass?: number;
  /** Override the crossfade duration (default tuned per preset). */
  crossfadeDuration?: number;
};
