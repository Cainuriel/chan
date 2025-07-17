export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.svg"]),
	mimeTypes: {".svg":"image/svg+xml"},
	_: {
		client: {start:"_app/immutable/entry/start.CDfP3y48.js",app:"_app/immutable/entry/app.E2dJYp7G.js",imports:["_app/immutable/entry/start.CDfP3y48.js","_app/immutable/chunks/3SiB7MME.js","_app/immutable/chunks/SnSw6M-6.js","_app/immutable/chunks/BH1NpXL2.js","_app/immutable/entry/app.E2dJYp7G.js","_app/immutable/chunks/B8s9FPDR.js","_app/immutable/chunks/BH1NpXL2.js","_app/immutable/chunks/SnSw6M-6.js","_app/immutable/chunks/CWj6FrbW.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
		],
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
