

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.9fOnjFOe.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/kDIz_Wqo.js"];
export const stylesheets = ["_app/immutable/assets/0.CzC0Tkon.css"];
export const fonts = [];
