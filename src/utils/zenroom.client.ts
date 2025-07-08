/**
 * @fileoverview Client-side wrapper for Zenroom to handle SSR compatibility
 */

import { browser } from '$app/environment';

// Only import zenroom on the client side
let zenroomPkg: any = null;

if (browser) {
  try {
    // Dynamic import to avoid SSR issues
    zenroomPkg = await import('zenroom');
  } catch (error) {
    console.warn('Failed to load zenroom:', error);
  }
}

export const zencode_exec = zenroomPkg?.zencode_exec || (() => {
  throw new Error('Zenroom not available in SSR context');
});

export const zenroom_exec = zenroomPkg?.zenroom_exec || (() => {
  throw new Error('Zenroom not available in SSR context');
});

export const introspect = zenroomPkg?.introspect || (() => {
  throw new Error('Zenroom not available in SSR context');
});

export const isZenroomAvailable = () => !!zenroomPkg;
