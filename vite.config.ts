import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	optimizeDeps: {
		include: ['elliptic', 'ethers']
	},
	ssr: {
		noExternal: ['elliptic']
	},
	define: {
		global: 'globalThis',
	},
	build: {
		rollupOptions: {
			external: ['crypto', 'fs', 'path', 'os']
		}
	}
});
