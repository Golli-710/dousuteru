import { readFile } from 'node:fs/promises';

export async function loadSite(root) {
  const site = JSON.parse(await readFile(new URL('../../data/site.json', import.meta.url), 'utf8'));
  const cloudflare = process.env.DEPLOY_TARGET === 'cloudflare';
  const indexing = process.env.SITE_INDEXING || (cloudflare ? 'staging' : 'production');
  if (!['staging', 'production'].includes(indexing)) throw new Error('SITE_INDEXING must be staging or production.');
  const preview = cloudflare && process.env.CF_PAGES_BRANCH && process.env.CF_PAGES_BRANCH !== (process.env.PRODUCTION_BRANCH || 'main');
  site.noindex = indexing === 'staging' || Boolean(preview);
  site.cloudflare = cloudflare;
  site.base_path = process.env.SITE_BASE_PATH ?? (cloudflare ? '' : site.base_path);
  site.base_path = (site.base_path || '').replace(/\/$/, '');
  if (site.base_path && !/^\/[a-zA-Z0-9/_-]+$/.test(site.base_path)) throw new Error('Invalid SITE_BASE_PATH.');
  site.base_url = process.env.SITE_ORIGIN || (cloudflare ? process.env.CF_PAGES_URL : site.base_url);
  if (!site.base_url) throw new Error('Set SITE_ORIGIN or CF_PAGES_URL for Cloudflare.');
  const origin = new URL(site.base_url);
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw new Error('SITE_ORIGIN must be an HTTPS origin without path or credentials.');
  site.base_url = origin.origin;
  if (cloudflare && !site.noindex && !process.env.SITE_ORIGIN) throw new Error('Production indexing requires an explicit SITE_ORIGIN.');
  return site;
}
