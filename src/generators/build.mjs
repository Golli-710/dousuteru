import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const [municipalities, items, site, disposal] = await Promise.all([
  read('data/municipalities.json'), read('data/items.json'), read('data/site.json'), read('data/disposal.json'),
]);
const basePath = (site.base_path || '').replace(/\/$/, '');
const out = resolve(root, 'public');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const verified = disposal.filter(row => row.status === 'verified');
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const safeJson = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const slug = value => value.toLowerCase().replaceAll(' ', '-').replaceAll('　', '-');
const itemSlug = value => items.find(item => item.name === value)?.slug || slug(value);
const pathPart = value => encodeURIComponent(itemSlug(value));
const localUrl = path => `${basePath}${path.startsWith('/') ? path : `/${path}`}`;
const canonicalUrl = path => `${site.base_url.replace(/\/$/, '')}${localUrl(path)}`;
const nav = `<header><a class="brand" href="${localUrl('/')}">どう捨てる？</a><span>自治体別のゴミ・不用品の捨て方検索</span></header>`;
const footer = `<footer>自治体公式情報を確認しやすく整理した検索サイトです。<br>最新情報は各自治体の公式案内をご確認ください。</footer>`;
const ad = label => `<aside class="ad-slot" aria-label="広告枠">広告 <small>${label}</small></aside>`;
function websiteSchema() {
  return { '@context': 'https://schema.org', '@type': 'WebSite', name: site.site_name, description: site.subtitle, url: canonicalUrl('/') };
}
function breadcrumbSchema(crumbs) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, ...(crumb.path ? { item: canonicalUrl(crumb.path) } : {}) })) };
}
function breadcrumbHtml(crumbs) {
  return `<nav class="breadcrumbs" aria-label="パンくず"><ol>${crumbs.map((crumb, index) => `<li>${index === crumbs.length - 1 ? `<span aria-current="page">${esc(crumb.name)}</span>` : crumb.path ? `<a href="${localUrl(crumb.path)}">${esc(crumb.name)}</a>` : `<span>${esc(crumb.name)}</span>`}</li>`).join('')}</ol></nav>`;
}
function shell({ title, description, body, path = '/', crumbs = [], noindex = false }) {
  const schemas = [websiteSchema(), ...(crumbs.length ? [breadcrumbSchema(crumbs)] : [])];
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}">${noindex ? '<meta name="robots" content="noindex,follow">' : `<link rel="canonical" href="${esc(canonicalUrl(path))}">`}<link rel="stylesheet" href="${localUrl('/styles.css')}"><script type="application/ld+json">${safeJson(schemas)}</script></head><body>${nav}<main>${body}</main>${footer}<script type="module" src="${localUrl('/app.js')}"></script></body></html>`;
}
const countFor = municipality => verified.filter(row => row.municipality === municipality).length;
const cityOptions = municipalities.map(m => `<option value="${esc(m.slug)}">${esc(m.name)}</option>`).join('');
const categoryOptions = [...new Set(items.map(item => item.category))].map(category => `<option>${esc(category)}</option>`).join('');
const itemOptions = items.map(item => `<option value="${esc(item.name)}">`).join('');
function searchForm(id = 'search-form') {
  return `<form id="${id}" class="search-panel"><label>品目<input id="item-query" type="search" placeholder="例：電子レンジ" list="item-options"><datalist id="item-options">${itemOptions}</datalist></label><label>自治体<select id="municipality-query"><option value="">すべての自治体</option>${cityOptions}</select></label><label>都道府県<select id="prefecture-query"><option value="">すべて</option><option>神奈川県</option><option>大阪府</option></select></label><label>カテゴリ<select id="category-query"><option value="">すべて</option>${categoryOptions}</select></label><button>検索する</button></form>`;
}
const homeCrumbs = [{ name: site.site_name, path: '/' }];
const home = `<section class="hero"><p class="eyebrow">自治体 × 品目で探す</p><h1>何を捨てたい？</h1><p>自治体別のゴミ・不用品の捨て方を、公式情報から探せます。</p></section>${ad('ページ上部')}<section aria-labelledby="search-title"><h2 id="search-title">品目と自治体を選んで検索</h2>${searchForm()}</section><section id="results" aria-live="polite"><h2>自治体から探す</h2><div class="city-grid">${municipalities.map(m => `<a class="city-card" href="${localUrl(`/${m.slug}/`)}"><strong>${esc(m.name)}</strong><span>${esc(m.prefecture)}・確認済み${countFor(m.name)}品目</span></a>`).join('')}</div><p class="notice">確認済み情報のみ検索結果に表示します。未確認品目は公式情報を確認中です。</p></section>${ad('ページ下部')}`;
await writeFile(resolve(out, 'index.html'), shell({ title: 'どう捨てる？｜自治体別のゴミ・不用品の捨て方検索', description: '捨てたい品目と自治体から、処分方法・料金・申込方法を検索。自治体公式情報を確認できる品目のみ掲載しています。', body: home, crumbs: homeCrumbs }));

for (const municipality of municipalities) {
  const cityRows = verified.filter(row => row.municipality === municipality.name);
  const cityCrumbs = [...homeCrumbs, { name: municipality.prefecture }, { name: municipality.name, path: `/${municipality.slug}/` }];
  const itemsHtml = cityRows.length ? `<div class="item-grid">${cityRows.map(row => `<a href="${localUrl(`/${municipality.slug}/${pathPart(row.item)}/`)}">${esc(row.item)}<span>${esc(row.fee)}</span></a>`).join('')}</div>` : `<p class="notice">品目ごとの処分方法は現在確認中です。</p>`;
  const body = `${breadcrumbHtml(cityCrumbs)}<h1>${esc(municipality.name)}のゴミ・不用品の捨て方</h1><p>${esc(municipality.prefecture)}の品目別処分情報を、自治体公式資料から整理しています。</p>${ad('ページ上部')}<section class="rule-card"><h2>粗大ごみの基本ルール</h2><p>${esc(municipality.basic_rule || '対象条件や申込方法は自治体公式案内をご確認ください。')}</p></section><h2>掲載品目（確認済み${cityRows.length}件）</h2>${itemsHtml}<section aria-labelledby="city-search-title"><h2 id="city-search-title">品目を検索</h2>${searchForm('search-form-city')}<div id="results" aria-live="polite"><p>品目名から確認済み情報を検索できます。</p></div></section><h2>自治体公式情報</h2><p><a href="${esc(municipality.official_url)}" rel="noopener">${esc(municipality.source_name)}（${esc(municipality.name)}公式サイト）</a></p>${ad('ページ下部')}`;
  await put(`${municipality.slug}/index.html`, shell({ title: `${municipality.name}のゴミ・不用品の捨て方｜どう捨てる？`, description: `${municipality.name}で不用品を処分する方法を品目別に検索。確認済み${cityRows.length}品目の料金・申込方法などを自治体公式情報から掲載しています。`, body, path: `/${municipality.slug}/`, crumbs: cityCrumbs }));
}

for (const row of verified) {
  const municipality = municipalities.find(city => city.name === row.municipality);
  if (!municipality) continue;
  const detailPath = `/${municipality.slug}/${pathPart(row.item)}/`;
  const similar = verified.filter(other => other.municipality === row.municipality && other.item !== row.item && other.category === row.category).slice(0, 5);
  const detailCrumbs = [...homeCrumbs, { name: municipality.prefecture }, { name: municipality.name, path: `/${municipality.slug}/` }, { name: row.item, path: detailPath }];
  const sources = (row.source_urls?.length ? row.source_urls : [row.official_url]).map((url, index) => `<li><a href="${esc(url)}" rel="noopener">${index === 0 ? esc(row.source_name) : `${esc(municipality.name)}公式の関連案内`}</a></li>`).join('');
  const category = row.disposal_category || row.disposal_method;
  const summary = `<section class="answer-card" aria-label="処分方法の要点"><p class="answer-lead">${esc(row.item)}は${esc(municipality.name)}で${esc(category)}として処分できます。</p><dl class="summary-grid"><div><dt>処分区分</dt><dd>${esc(category)}</dd></div><div><dt>料金</dt><dd>${esc(row.fee)}</dd></div><div><dt>申込</dt><dd>${esc(row.application_required)}</dd></div></dl></section>`;
  const dimensions = row.size_condition ? `<section><h2>サイズ・対象条件</h2><p>${esc(row.size_condition)}</p></section>` : '';
  const body = `${breadcrumbHtml(detailCrumbs)}<h1>${esc(municipality.name)}で${esc(row.item)}を捨てる方法</h1>${summary}${ad('ページ上部')}<section><h2>処分方法</h2><p>${esc(row.disposal_method)}</p><dl class="facts"><dt>収集</dt><dd>${esc(row.collection)}</dd><dt>自己搬入</dt><dd>${esc(row.dropoff)}</dd></dl></section>${dimensions}${ad('本文中')}<section><h2>注意点</h2><p>${esc(row.notes)}</p></section><section><h2>自治体公式情報</h2><p>出典：${esc(row.source_name)}</p><ul class="sources">${sources}</ul><p class="verified-date">情報確認日：${esc(row.verified_at)}</p></section><section><h2>${esc(municipality.name)}の関連品目</h2><p><a href="${localUrl(`/${municipality.slug}/`)}">${esc(municipality.name)}の品目一覧を見る</a></p>${similar.length ? `<ul class="related">${similar.map(other => `<li><a href="${localUrl(`/${municipality.slug}/${pathPart(other.item)}/`)}">${esc(other.item)}（${esc(other.category)}）</a></li>`).join('')}</ul>` : ''}</section>${ad('ページ下部')}`;
  const title = `${municipality.name}で${row.item}を捨てる方法｜料金・処分方法｜どう捨てる？`;
  const description = `${municipality.name}で${row.item}を捨てる方法を紹介。処分区分、料金、申込方法、サイズ条件などを自治体公式情報をもとに確認できます。`;
  await put(`${municipality.slug}/${itemSlug(row.item)}/index.html`, shell({ title, description, body, path: detailPath, crumbs: detailCrumbs }));
}

const notFound = `<section class="hero"><p class="eyebrow">ページが見つかりません</p><h1>お探しのページは見つかりませんでした</h1><p>品目と自治体を選んで、処分方法を検索できます。</p></section><section><h2>品目を検索</h2>${searchForm('search-form-404')}<div id="results" aria-live="polite"></div></section><p><a class="button-link" href="${localUrl('/')}">トップへ戻る</a></p>`;
await writeFile(resolve(out, '404.html'), shell({ title: 'ページが見つかりません｜どう捨てる？', description: 'お探しのページが見つかりません。トップへ戻るか、品目を検索してください。', body: notFound, noindex: true }));

async function put(path, content) {
  const target = resolve(out, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

const db = { basePath, municipalities, items, disposal: verified };
const app = `const DB=${safeJson(db)};
const localUrl=path=>DB.basePath+(path.startsWith('/')?path:'/'+path);
for(const form of document.querySelectorAll('.search-panel'))form.addEventListener('submit',event=>{
  event.preventDefault();
  const value=id=>form.querySelector('#'+id)?.value||'';
  const q=value('item-query').trim(),city=value('municipality-query'),pref=value('prefecture-query'),category=value('category-query');
  const results=form.parentElement.querySelector('#results')||document.querySelector('#results');
  const found=DB.disposal.filter(row=>(!q||row.item.includes(q))&&(!city||DB.municipalities.find(m=>m.name===row.municipality)?.slug===city)&&(!pref||row.prefecture===pref)&&(!category||row.category===category));
  results.innerHTML='<h2>検索結果</h2>'+(found.length?found.map(row=>{const m=DB.municipalities.find(city=>city.name===row.municipality),item=DB.items.find(i=>i.name===row.item),slug=item?.slug||encodeURIComponent(row.item);return '<article class="result"><h3><a href="'+localUrl('/'+m.slug+'/'+slug+'/')+'">'+m.name+'｜'+row.item+'</a></h3><p>'+row.disposal_method+'</p><p>料金：'+row.fee+'</p><a href="'+row.official_url+'">自治体公式情報</a></article>'}).join(''):'<p class="notice">条件に一致する確認済み情報はありません。現在、公式情報を確認中です。</p>')+'<aside class="ad-slot">広告 <small>検索結果途中</small></aside>';
});`;
await writeFile(resolve(out, 'app.js'), app);
await writeFile(resolve(out, 'styles.css'), `*{box-sizing:border-box}body{margin:0;background:#f6f8f7;color:#20332e;font:16px/1.7 system-ui,-apple-system,"Hiragino Kaku Gothic ProN",sans-serif}header{display:flex;align-items:center;justify-content:space-between;padding:14px max(5vw,20px);background:#fff;border-bottom:1px solid #dce6e1}.brand{font-weight:800;font-size:1.3rem;color:#146c56;text-decoration:none}header span,small{color:#657770;font-size:.85rem}main{max-width:960px;margin:auto;padding:24px 20px 56px}.hero{padding:26px;background:#e4f3ed;border-radius:18px}.hero h1{font-size:1.8rem;margin:.2em 0}.eyebrow{color:#146c56;font-weight:700}.search-panel{display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:12px;padding:18px;margin:16px 0;background:#fff;border-radius:14px;align-items:end}label{display:grid;gap:5px;font-size:.9rem}input,select,button{min-width:0;width:100%;font:inherit;padding:10px;border:1px solid #bdccc5;border-radius:8px;background:#fff}button,.button-link{background:#146c56;color:#fff;border:0;border-radius:8px;padding:11px 16px;font-weight:700;text-decoration:none;cursor:pointer}.city-grid,.item-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.city-card,.item-grid a,.result{display:flex;flex-direction:column;min-width:0;padding:16px;background:#fff;border:1px solid #dce6e1;border-radius:12px;text-decoration:none;color:inherit}.item-grid span,.city-card span{color:#657770;font-size:.9rem}.notice{padding:14px;background:#fff8e8;border-left:4px solid #e4b954}.answer-card,.rule-card{padding:18px;background:#fff;border:1px solid #cdded5;border-radius:14px}.answer-lead{font-size:1.12rem;font-weight:700;margin:0 0 10px}.summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0}.summary-grid>div{padding:10px;background:#f5f8f6;border-radius:8px}.summary-grid dt{font-size:.85rem;color:#657770}.summary-grid dd{font-size:1rem;font-weight:700}.ad-slot{margin:18px 0;min-height:48px;display:flex;align-items:center;justify-content:center;gap:8px;border:1px dashed #bbc8c2;border-radius:8px;color:#75827d;font-size:.85rem}footer{text-align:center;padding:24px;color:#657770;background:#fff}.breadcrumbs{font-size:.88rem;color:#657770;overflow-wrap:anywhere}.breadcrumbs ol{display:flex;flex-wrap:wrap;gap:7px;list-style:none;padding:0}.breadcrumbs li:not(:last-child)::after{content:'›';padding-left:7px}dt{font-weight:700;margin-top:12px}dd{margin:0 0 8px}.facts{display:grid;grid-template-columns:max-content 1fr;column-gap:14px}.result{margin:12px 0}.sources{padding-left:1.3em}.verified-date{font-size:.9rem;color:#657770}.related{display:flex;flex-wrap:wrap;gap:8px;padding-left:0;list-style:none}.related li{padding:6px 10px;background:#fff;border:1px solid #dce6e1;border-radius:8px}.rule-card{margin:16px 0}.rule-card h2{margin-top:0}a{color:#146c56}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #eba92b;outline-offset:2px}@media(max-width:767px){.search-panel{grid-template-columns:repeat(2,minmax(0,1fr))}.search-panel label:first-child{grid-column:1/-1}.city-grid,.item-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){main{padding:18px 14px 40px}.hero{padding:20px}.hero h1{font-size:1.5rem}.search-panel{grid-template-columns:1fr;padding:14px}.search-panel label:first-child{grid-column:auto}.city-grid,.item-grid{grid-template-columns:1fr}.summary-grid{grid-template-columns:1fr}.facts{grid-template-columns:1fr}.facts dd{margin-bottom:8px}header span{display:none}}`);

const routePaths = ['/', ...municipalities.map(m => `/${m.slug}/`), ...verified.flatMap(row => {
  const municipality = municipalities.find(city => city.name === row.municipality);
  return municipality ? [`/${municipality.slug}/${pathPart(row.item)}/`] : [];
})];
const sitemapRows = routePaths.map(path => `<url><loc>${esc(canonicalUrl(path))}</loc></url>`).join('');
await writeFile(resolve(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapRows}</urlset>`);
await writeFile(resolve(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${canonicalUrl('/sitemap.xml')}\n`);
await writeFile(resolve(out, '.nojekyll'), '');
console.log(`Generated ${routePaths.length} indexed routes, ${verified.length} verified item pages, 1 not-found page.`);
