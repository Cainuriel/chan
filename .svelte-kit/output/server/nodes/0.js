

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.DK7gpE6B.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/BH1NpXL2.js"];
export const stylesheets = ["_app/immutable/assets/0.BDjrH9C2.css"];
export const fonts = [];
