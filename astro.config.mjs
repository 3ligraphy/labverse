// @ts-check
import { defineConfig } from 'astro/config';
import {
  transformerNotationHighlight,
  transformerNotationDiff,
  transformerNotationFocus,
  transformerMetaHighlight,
} from '@shikijs/transformers';
import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel';
import rehypeCallouts from './src/plugins/rehype-callouts.mjs';
import runner from './src/integrations/runner.mjs';
import { labRuntime } from './scripts/lab-runtime.mjs';

export default defineConfig({
  site: 'https://mobdev.vercel.app',
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  // Each module has its own address: the built-in course is /mobile-development, builder modules /<slug>.
  // The old addresses (shared in chats, QR codes and bookmarks) forward to the new ones.
  redirects: {
    '/course': '/mobile-development',
    ...Object.fromEntries(
      ['labs', 'coursework', 'tools', 'setup', 'project', 'commands', 'resources', 'troubleshooting', 'extra', 'attendance'].map((s) => [`/${s}`, `/mobile-development/${s}`]),
    ),
    ...Object.fromEntries(['labs', 'coursework', 'tools', 'setup', 'submit'].map((s) => [`/${s}/[id]`, `/mobile-development/${s}/[id]`])),
    '/m/[module]': '/[module]',
    '/m/[module]/[lab]': '/[module]/[lab]',
  },
  // runner(): builds the Lab playground runtime (public/runner/runtime.js)
  integrations: [mdx(), runner()],
  // Static site; only /admin and /api/* run on the server (they set `prerender = false`).
  adapter: vercel({ maxDuration: 60 }),
  // builds public/lab-runtime/runtime.js (the interactive labs' preview) and rebuilds it in dev
  vite: { plugins: [labRuntime()] },
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-default' },
      defaultColor: false,
      wrap: false,
      transformers: [
        {
          // ```tsx title="App.tsx"  → shows the filename in the code header
          name: 'meta-title',
          pre(node) {
            const m = this.options.meta?.__raw?.match(/title="([^"]+)"/);
            if (m) node.properties['data-title'] = m[1];
          },
        },
        transformerMetaHighlight(),
        transformerNotationHighlight(),
        transformerNotationDiff(),
        transformerNotationFocus(),
      ],
    },
    processor: unified({ rehypePlugins: [rehypeCallouts] }),
  },
});
