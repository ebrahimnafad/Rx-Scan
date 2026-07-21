// shared/config/motion-tokens.ts

/** Duration ranges (ms) — keep every UI animation between 100–500ms */
export const duration = {
  instant: 100,   // button press, checkbox toggle
  fast: 150,      // tooltip, hover states, micro-interactions
  normal: 250,    // card expand, list item enter, bottom nav switch
  moderate: 350,  // page transition, modal appear
  slow: 500,      // complex layout shift (scan card flip)
} as const;

/** Easing curves — natural deceleration feels physical */
export const ease = {
  /** Default for most UI — fast in, gentle out */
  standard: [0.4, 0, 0.2, 1] as [number, number, number, number],

  /** Exiting elements — faster start, lingers at end */
  exit: [0.4, 0, 1, 1] as [number, number, number, number],

  /** Entering elements — starts slow, accelerates in */
  enter: [0, 0, 0.2, 1] as [number, number, number, number],

  /** Spring for playful interactions (card flip, button bounce) */
  spring: { type: 'spring' as const, stiffness: 300, damping: 24 },

  /** Gentle spring for layout shifts */
  springGentle: { type: 'spring' as const, stiffness: 200, damping: 20 },
};

/** Shared transition preset — reuse everywhere, no ad-hoc values */
export const transition = {
  /** Page crossfade — 350ms standard easing */
  page: {
    duration: duration.moderate / 1000,
    ease: ease.standard,
  },
  /** Card flip — spring physics for natural feel */
  flip: ease.spring,
  /** Micro-interaction — button press, toggle, 150ms */
  micro: {
    duration: duration.fast / 1000,
    ease: ease.standard,
  },
  /** List item stagger — 250ms per item */
  stagger: {
    duration: duration.normal / 1000,
    ease: ease.standard,
  },
};
