// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://your-group.pages.dev', // ← 部署前改为你的 Cloudflare Pages 域名
  integrations: [tailwind(), react(), sitemap()],
  output: 'static',
  build: { inlineStylesheets: 'auto' },
});
