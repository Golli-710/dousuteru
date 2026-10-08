process.env.DEPLOY_TARGET = 'cloudflare';
await import('./build.mjs');
await import('./audit.mjs');
