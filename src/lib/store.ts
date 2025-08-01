import { writable } from 'svelte/store';
type NetworkKey = 'amoy' | 'alastria';
export const selectedNetwork = writable<NetworkKey>('amoy');
  