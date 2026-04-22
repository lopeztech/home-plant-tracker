// Motion tokens — single source of truth for all animation timing and easing.
// fast=120ms  normal=200ms  slow=320ms  (values are in seconds for framer-motion)

export const DURATION = {
  fast: 0.12,
  normal: 0.2,
  slow: 0.32,
}

export const EASE = {
  out: [0, 0, 0.2, 1],
  inOut: [0.4, 0, 0.2, 1],
}

export const SPRING = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
}

export const STAGGER_DELAY = 0.04

export const variants = {
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: DURATION.normal, ease: EASE.out } },
    exit: { opacity: 0, transition: { duration: DURATION.fast } },
  },
  slideInRight: {
    hidden: { opacity: 0, x: 32 },
    visible: { opacity: 1, x: 0, transition: { duration: DURATION.normal, ease: EASE.out } },
    exit: { opacity: 0, x: 32, transition: { duration: DURATION.fast } },
  },
  pageEnter: {
    hidden: { opacity: 0, x: 8 },
    visible: { opacity: 1, x: 0, transition: { duration: DURATION.normal, ease: EASE.out } },
    exit: { opacity: 0, x: -8, transition: { duration: DURATION.fast } },
  },
  scaleUp: {
    hidden: { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1, transition: { duration: DURATION.normal, ease: EASE.out } },
    exit: { opacity: 0, scale: 0.96, transition: { duration: DURATION.fast } },
  },
  listItem: {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: DURATION.normal, ease: EASE.out } },
  },
}
