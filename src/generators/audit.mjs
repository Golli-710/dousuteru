import { loadSite } from './site-config.mjs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const [municipalities, items, site, disposal] = await Promise.all([
  readJson('data/municipalities.json'), readJson('data/items.json'), loadSite(root), readJson('data/disposal.json'),
]);
const out = resolve(root, 'public');
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const verified = disposal.filter(row => row.status === 'verified');
const targetNames = new Set(['ベッド','マットレス','ソファ','タンス','本棚','テーブル','机','椅子','電子レンジ','炊飯器','掃除機','扇風機','自転車','布団','カーペット','スーツケース','衣装ケース','ベビーカー','チャイルドシート','ゴルフクラブ']);
const targetRows = disposal.filter(row => targetNames.has(row.item));
const byCity = Object.fromEntries(municipalities.map(city => [city.name, targetRows.filter(row => row.municipality === city.name)]));
check(targetRows.length === 60, `Expected 60 target records; found ${targetRows.length}.`);
check(new Set(targetRows.map(row => `${row.municipality}|${row.item}`)).size === 60, 'Target municipality/item pairs are duplicated or missing.');
for (const row of verified) {
  for (const field of ['municipality','prefecture','item','category','disposal_method','fee','application_required','collection','dropoff','size_condition','notes','official_url','source_name','verified_at','status']) {
    check(String(row[field] ?? '').trim().length > 0, `Verified row missing ${field}: ${row.municipality} / ${row.item}`);
  }
  check(row.status === 'verified', `Unexpected published status: ${row.municipality} / ${row.item}`);
  check(/^https:\/\//.test(row.official_url || ''), `Official URL is not HTTPS: ${row.municipality} / ${row.item}`);
  const host = new URL(row.official_url).hostname;
  check(['city.kawasaki.jp','yokohama.lg.jp','city.osaka.lg.jp'].some(domain => host === domain || host.endsWith(`.${domain}`)), `Official URL is not a municipal source: ${row.municipality} / ${row.item} (${host})`);
  check(Array.isArray(row.source_urls) && row.source_urls.length > 0, `Verified row has no evidence URLs: ${row.municipality} / ${row.item}`);
  check(Boolean(row.verified_at), `Verified row has no verification date: ${row.municipality} / ${row.item}`);
}
const expected = {'川崎市':[20,0], '横浜市':[18,2], '大阪市':[20,0]};
for (const [name,[v,d]] of Object.entries(expected)) {
  const rows = byCity[name] || [];
  check(rows.filter(row => row.status === 'verified').length === v, `${name} verified target count mismatch.`);
  check(rows.filter(row => row.status === 'draft').length === d, `${name} draft target count mismatch.`);
}
const basePath = (site.base_path || '').replace(/\/$/, '');
const canonical = path => `${site.base_url.replace(/\/$/, '')}${basePath}${path}`;
const allFiles = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) await walk(path); else allFiles.push(path);
  }
}
await walk(out);
const htmlFiles = allFiles.filter(file => extname(file) === '.html');
check(htmlFiles.length === verified.length + municipalities.length + 5, `Expected ${verified.length} detail + ${municipalities.length} municipality + home + 404 HTML files; found ${htmlFiles.length}.`);
check(allFiles.some(file => file === resolve(out, '404.html')), '404.html is missing.');
check(allFiles.some(file => file === resolve(out, 'robots.txt')), 'robots.txt is missing.');
check(allFiles.some(file => file === resolve(out, '.nojekyll')), '.nojekyll is missing.');
const titles = new Map();
const headings = new Map();
const pathsSet = new Set(allFiles.map(file => file.slice(out.length).replaceAll('\\','/')));
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const rel = file.slice(out.length).replaceAll('\\','/');
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1] || '';
  const h1s = [...html.matchAll(/<h1\b[^>]*>(.*?)<\/h1>/gs)].map(match => match[1].replace(/<[^>]*>/g,'').trim());
  const description = html.match(/<meta name="description" content="([^"]*)">/);
  const is404 = rel === '/404.html';
  check(Boolean(title), `Missing title: ${rel}`);
  if (title) { titles.set(title, [...(titles.get(title)||[]), rel]); }
  check(h1s.length === 1, `Expected one H1 in ${rel}; found ${h1s.length}.`);
  if (h1s[0]) headings.set(h1s[0], [...(headings.get(h1s[0])||[]), rel]);
  check(Boolean(description?.[1]), `Missing description: ${rel}`);
  if (is404 || site.noindex) check(html.includes('noindex,follow'), '404 should be noindex.');
  else check(html.includes(`<link rel="canonical" href="${canonical(rel === '/index.html' ? '/' : rel.replace(/\/index\.html$/, '/'))}">`), `Canonical missing or mismatched: ${rel}`);
  check(html.includes('<meta property="og:url" content="' + canonical(rel === '/index.html' || is404 ? '/' : rel.replace(/\/index\.html$/, '/')) + '">'), `OGP URL mismatch: ${rel}`);
  check(html.includes('application/ld+json') && html.includes('WebSite'), `WebSite JSON-LD missing: ${rel}`);
  if (!is404 && rel !== '/index.html') check(html.includes('BreadcrumbList'), `Breadcrumb JSON-LD missing: ${rel}`);
  if (!is404 && rel !== '/index.html') {
    const schemas = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    const crumbs = schemas.find(schema => schema['@type'] === 'BreadcrumbList')?.itemListElement || [];
    const visible = html.match(/<nav class="breadcrumbs"[^>]*>(.*?)<\/nav>/s)?.[1] || '';
    const entries = [...visible.matchAll(/<li>(.*?)<\/li>/gs)].map(match => match[1]);
    check(crumbs.length >= 2 && entries.length === crumbs.length, `Visible/schema breadcrumb count mismatch: ${rel}`);
    crumbs.forEach((crumb, i) => {
      check(crumb.position === i + 1 && entries[i]?.replace(/<[^>]*>/g, '') === crumb.name, `Breadcrumb name/position mismatch: ${rel}`);
      if (i < crumbs.length - 1) check(entries[i]?.includes(`href="${basePath}${new URL(crumb.item).pathname.slice(basePath.length)}"`), `Breadcrumb URL mismatch: ${rel}`);
    });
    check(entries.at(-1)?.includes('aria-current="page"'), `Current breadcrumb missing: ${rel}`);
  }
  const internalAttrs = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(match => match[1]).filter(value => value.startsWith('/'));
  for (const href of internalAttrs) {
    check(href.startsWith(`${basePath}/`) || (basePath === '' && href.startsWith('/')), `Internal URL does not use base path (${basePath}): ${rel} -> ${href}`);
    const withoutBase = basePath && href.startsWith(basePath) ? href.slice(basePath.length) : href;
    const pathname = decodeURIComponent(withoutBase.split(/[?#]/)[0]);
    const target = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    check(pathsSet.has(target), `Broken internal link or asset: ${rel} -> ${href} (${target})`);
  }
}
for (const [title, pages] of titles) check(pages.length === 1, `Duplicate title '${title}': ${pages.join(', ')}`);
for (const [heading, pages] of headings) check(pages.length === 1, `Duplicate H1 '${heading}': ${pages.join(', ')}`);
const sitemap = await readFile(resolve(out,'sitemap.xml'),'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
const expectedUrls = [canonical('/'), ...['about','advertising','privacy'].map(p => canonical(`/${p}/`)), ...municipalities.map(city => canonical(`/${city.slug}/`)), ...verified.map(row => { const city=municipalities.find(m=>m.name===row.municipality), item=items.find(i=>i.name===row.item); return canonical(`/${city.slug}/${encodeURIComponent(item?.slug || row.item)}/`); })].sort();
check(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>') && sitemap.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">') && sitemap.endsWith('</urlset>'), 'Sitemap XML document structure is invalid.');
check(sitemapUrls.length === (sitemap.match(/<url>/g)||[]).length, 'Some sitemap entries are missing a single <loc> URL.');
check(sitemapUrls.length === 65, `Expected 65 sitemap URLs; found ${sitemapUrls.length}.`);
check(new Set(sitemapUrls).size === sitemapUrls.length, 'Duplicate sitemap URLs found.');
check(JSON.stringify([...sitemapUrls].sort()) === JSON.stringify(expectedUrls), 'Sitemap URLs do not match home, municipality, and verified pages.');
check(sitemapUrls.every(url => url.startsWith(`${site.base_url.replace(/\/$/, '')}${basePath}/`)), 'Sitemap contains a URL outside the configured HTTPS base path.');
check(!sitemap.includes('/yokohama/rice-cooker/') && !sitemap.includes('/yokohama/child-seat/'), 'Draft item appears in sitemap.');
const robots = await readFile(resolve(out,'robots.txt'),'utf8');
check(robots.includes(`Sitemap: ${canonical('/sitemap.xml')}`), 'robots.txt sitemap URL is incorrect.');
check(/User-agent: \*\nAllow: \/\n/.test(robots) && !/^Disallow:\s*\/$/mi.test(robots), 'robots.txt must allow crawling and not block the whole site.');
if (site.cloudflare) {
  const headers = await readFile(resolve(out, '_headers'), 'utf8');
  check(!site.noindex || headers.includes('X-Robots-Tag: noindex, follow'), 'Staging HTTP noindex header missing.');
  const redirects = await readFile(resolve(out, '_redirects'), 'utf8');
  check(basePath !== '' || redirects.includes('/dousuteru/* /:splat 301'), 'Legacy-path compatibility redirect missing.');
}
const app = await readFile(resolve(out,'app.js'),'utf8');
let submit;
const result = { innerHTML: '' };
const values = {'item-query':'電子レンジ','municipality-query':'','prefecture-query':'','category-query':''};
const form = { parentElement:{querySelector:selector=>selector==='#results'?result:null}, querySelector:selector=>({value:values[selector.slice(1)]??''}), addEventListener:(name,callback)=>{if(name==='submit')submit=callback;} };
vm.runInNewContext(app,{window:{},document:{querySelectorAll:()=>[form]}});
submit({preventDefault(){}});
check((result.innerHTML.match(/class="result"/g)||[]).length===3,'Search should return one verified microwave result per city.');
values['item-query']='チャイルドシート'; values['municipality-query']='yokohama'; submit({preventDefault(){}});
check(result.innerHTML.includes('公式情報を確認中'),'Draft-only Yokohama item should not appear in search results.');
const css = await readFile(resolve(out,'styles.css'),'utf8');
check(css.includes('@media(max-width:767px)') && css.includes('@media(max-width:480px)'), 'Responsive breakpoints for tablet and phone are missing.');
check(await stat(resolve(out,'index.html')).then(() => true).catch(() => false), 'Homepage missing.');
if (errors.length) {
  console.error(`Audit failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Audit passed: ${verified.length} verified / ${disposal.length-verified.length} draft records, ${municipalities.length} municipality pages, ${verified.length} details, home, 404, 65 sitemap URLs, SEO metadata, JSON-LD, internal links, search, and responsive CSS.`);
}
