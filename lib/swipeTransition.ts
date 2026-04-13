/**
 * Tiny module-level store that signals swipe direction from an exiting Screen
 * to the entering Screen across a router.replace() boundary.
 *
 * Usage:
 *   swipeTransition.set(1)   — call before navigating to next tab
 *   swipeTransition.set(-1)  — call before navigating to prev tab
 *   swipeTransition.consume() — call on the entering screen; returns dir then clears it
 */
let _pendingDir: -1 | 1 | null = null;

export const swipeTransition = {
  set(dir: -1 | 1): void {
    _pendingDir = dir;
  },
  consume(): -1 | 1 | null {
    const d = _pendingDir;
    _pendingDir = null;
    return d;
  },
};
