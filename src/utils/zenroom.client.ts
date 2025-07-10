/**
 * @fileoverview Client-side wrapper for Zenroom to handle SSR compatibility
 */

import { browser } from '$app/environment';

// Only import zenroom on the client side
let zenroomPkg: any = null;
let zenroomLoaded = false;

async function loadZenroom() {
  if (!browser || zenroomLoaded) return zenroomPkg;
  
  try {
    console.log('🔧 Loading Zenroom package...');
    zenroomPkg = await import('zenroom');
    zenroomLoaded = true;
    console.log('✅ Zenroom loaded successfully');
    return zenroomPkg;
  } catch (error) {
    console.warn('❌ Failed to load zenroom:', error);
    return null;
  }
}

export const zencode_exec = async (zencode: string, options: any = {}) => {
  const pkg = await loadZenroom();
  if (!pkg) {
    throw new Error('Zenroom not available');
  }
  
  console.log('🔧 Executing Zencode:', zencode.substring(0, 100) + '...');
  console.log('🔧 With options:', options);
  
  try {
    const result = await pkg.zencode_exec(zencode, options);
    console.log('✅ Zencode executed successfully:', result);
    return result;
  } catch (error) {
    console.error('❌ Zencode execution failed:', error);
    throw error;
  }
};

export const zenroom_exec = async (lua: string, options: any = {}) => {
  const pkg = await loadZenroom();
  if (!pkg) {
    throw new Error('Zenroom not available');
  }
  
  try {
    const result = await pkg.zenroom_exec(lua, options);
    console.log('✅ Zenroom Lua executed successfully:', result);
    return result;
  } catch (error) {
    console.error('❌ Zenroom Lua execution failed:', error);
    throw error;
  }
};

export const introspect = async () => {
  const pkg = await loadZenroom();
  if (!pkg) {
    throw new Error('Zenroom not available');
  }
  return pkg.introspect();
};

export const isZenroomAvailable = async () => {
  if (!browser) return false;
  const pkg = await loadZenroom();
  return !!pkg;
};
