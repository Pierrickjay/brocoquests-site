// Génère les fiches de révision SEO de brocoquests.fr à partir des fichiers JSON de _contenu/regles/.
// Usage : node _contenu/build.mjs   (depuis la racine du dépôt, aucune dépendance)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SITE = 'https://brocoquests.fr';
const MODULE = { slug: 'orthographe', nom: 'Orthographe', titre: 'Règles d\'orthographe : fiches et quiz gratuits' };

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = s => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// ── 1. Socle : le CSV exporté de la base BrocoPlumes ─────────────────────
function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(x => x !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows;
  return data.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

// Petit nettoyage des phrases d'exemple (double ponctuation, majuscule initiale)
const tidy = s => s.replace(/[ \s]*([?!])(\s*\1)+/g, ' $1').replace(/\s{2,}/g, ' ').trim().replace(/^\p{Ll}/u, m => m.toUpperCase());

const slugify = s => s.toLowerCase()
  .replace(/\s*\/\s*/g, ' ou ')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[«»"'’()]/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const categories = JSON.parse(readFileSync(join(HERE, 'categories.json'), 'utf8'));
delete categories._doc;
const CAT_ORDER = Object.keys(categories);
const catOf = id => CAT_ORDER.find(c => categories[c].includes(id)) || 'Autres règles';

const csv = parseCsv(readFileSync(join(HERE, 'data', 'essentiel.csv'), 'utf8'));
const base = {};
for (const row of csv) {
  const m = row.id.match(/(\d+)\s*$/);
  if (!m) { console.warn(`⚠ CSV : ligne ignorée, id illisible "${row.id}"`); continue; }
  if (!/^\d+$/.test(row.id)) console.warn(`⚠ CSV : id "${row.id.slice(0, 50)}…" lu comme ${m[1]} (texte parasite dans la colonne id)`);
  const id = Number(m[1]);
  const exemples = row.exemple.split(' / ').map(p => {
    const [faux, correct] = p.split('|').map(x => tidy(x.replace(/[❌✅]/g, '')));
    return faux && correct ? { faux, correct } : null;
  }).filter(Boolean);
  base[id] = {
    id, item: row.item, slug: slugify(row.item), difficulte: Number(row['difficulté']) || null,
    astuce: row['moyen_mnémotechnique'], explication: row.explication_big, exemples, categorie: catOf(id),
  };
}

// ── 2. Couche éditoriale : _contenu/regles/<slug>.json (seules ces règles sont publiées) ──
const REQUIRED = ['id', 'h1', 'title', 'description', 'reponseCourte'];
const regles = readdirSync(join(HERE, 'regles'))
  .filter(f => f.endsWith('.json'))
  .map(f => {
    const o = JSON.parse(readFileSync(join(HERE, 'regles', f), 'utf8'));
    for (const k of REQUIRED) if (o[k] == null) throw new Error(`${f} : champ "${k}" manquant`);
    const b = base[o.id];
    if (!b) throw new Error(`${f} : id ${o.id} absent du CSV`);
    const r = { ...b, ...o, slug: o.slug || b.slug, sections: o.sections || [] };
    if (!/^[a-z0-9-]+$/.test(r.slug)) throw new Error(`${f} : slug invalide "${r.slug}"`);
    if (r.title.length > 65) console.warn(`⚠ ${f} : title de ${r.title.length} caractères (Google coupe vers 60)`);
    if (r.description.length > 160) console.warn(`⚠ ${f} : description de ${r.description.length} caractères (viser 120-155)`);
    // Pièges : ceux du fichier éditorial, sinon les exemples ❌/✅ du CSV
    r.pieges = o.pieges || b.exemples.map(e => ({ faux: esc(e.faux), correct: esc(e.correct), explication: '' }));
    // Quiz : celui du fichier éditorial, sinon « quelle phrase est correcte ? » à partir des exemples
    r.quiz = o.quiz || b.exemples.map((e, i) => ({
      phrase: 'Quelle phrase est correcte ?', options: i % 2 ? [e.correct, e.faux] : [e.faux, e.correct],
      reponse: e.correct, explication: esc(b.astuce),
    }));
    r.quiz.forEach((q, i) => {
      if (!q.options.includes(q.reponse)) throw new Error(`${f} : quiz ${i + 1}, la réponse "${q.reponse}" n'est pas dans les options`);
    });
    return r;
  })
  .sort((a, b) => CAT_ORDER.indexOf(a.categorie) - CAT_ORDER.indexOf(b.categorie) || a.id - b.id);
const bySlug = Object.fromEntries(regles.map(r => [r.slug, r]));
const NIVEAU = d => d == null ? null : d <= 2 ? 'Niveau facile' : d === 3 ? 'Niveau intermédiaire' : 'Niveau avancé';

// ── Helpers ───────────────────────────────────────────────────────────────
const resume = (s, n = 120) => s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n)).replace(/[\s,;:(]+$/, '') + '…';
const jsonld = o => `<script type="application/ld+json">\n${JSON.stringify(o, null, 2).replace(/</g, '\\u003c')}\n</script>`;
const ctaUrl = camp => `/app/?src=site&amp;camp=${camp}`;
const today = new Date().toISOString().slice(0, 10);

function head({ title, description, path, ogTitle }) {
  const url = SITE + path;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="apple-itunes-app" content="app-id=6755903795">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="180x180" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/fiches.css">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(ogTitle || title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}/icon.png">
<meta property="og:locale" content="fr_FR">
<meta name="twitter:card" content="summary">
</head>
<body>
<header class="topbar"><a href="/" class="brand"><img src="/favicon-32x32.png" alt="" width="28" height="28">BrocoQuests</a><a href="${ctaUrl('topbar')}" class="topbar-cta">Télécharger l'app</a></header>`;
}

const footer = `<footer><p><a href="/">Accueil</a> · <a href="/${MODULE.slug}/">Fiches d'orthographe</a> · <a href="/legal.html">Documents légaux</a></p><p>Questions ? <a href="mailto:brocoquests@gmail.com">brocoquests@gmail.com</a></p></footer>`;

const breadcrumbLd = items => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: SITE + it.path })),
});

// ── Page règle ────────────────────────────────────────────────────────────
function pageRegle(r) {
  const path = `/${MODULE.slug}/${r.slug}/`;
  const camp = `regle-${r.slug}`;
  const liees = (r.liees || []).map(s => bySlug[s]).filter(Boolean);
  const voisines = liees.length ? liees : regles.filter(x => x.slug !== r.slug && x.categorie === r.categorie).slice(0, 4);

  const quizData = r.quiz.map(q => ({ p: q.phrase, o: q.options, r: q.reponse, e: q.explication }));

  const html = `${head({ title: r.title, description: r.description, path, ogTitle: r.h1 })}
<main class="fiche">
<nav class="crumbs" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › <a href="/${MODULE.slug}/">${MODULE.nom}</a> › <span>${esc(r.categorie)}</span></nav>
<article>
<p class="kicker">${esc(r.categorie)}${NIVEAU(r.difficulte) ? ` · ${NIVEAU(r.difficulte)}` : ''}</p>
<h1>${esc(r.h1)}</h1>
<div class="answer"><p class="answer-label">La réponse en bref</p>${r.reponseCourte}</div>
<section><h2>L'astuce de Broco</h2><p class="tip">${esc(r.astuce)}</p></section>
<section><h2>${esc(r.titreRegle || 'La règle en détail')}</h2><p>${esc(r.explication)}</p>${r.complementRegle || ''}</section>
${r.sections.map(s => `<section><h2>${esc(s.titre)}</h2>${s.html}</section>`).join('\n')}
${r.pieges?.length ? `<section><h2>Les pièges à éviter</h2><ul class="traps">${r.pieges.map(p => `<li><p class="trap-pair"><span class="wrong" aria-label="Incorrect">${p.faux}</span><span class="right" aria-label="Correct">${p.correct}</span></p>${p.explication ? `<p>${p.explication}</p>` : ''}</li>`).join('')}</ul></section>` : ''}
<section class="quiz" id="quiz" aria-labelledby="quiz-title">
<h2 id="quiz-title">Teste-toi en ${r.quiz.length} questions</h2>
<div class="quiz-box" data-camp="${camp}" data-quiz="${esc(JSON.stringify(quizData))}">
<noscript><ol>${r.quiz.map(q => `<li>${q.phrase.replace('___', '<strong>' + esc(q.reponse) + '</strong>')}</li>`).join('')}</ol></noscript>
</div>
</section>
<aside class="app-cta">
<img src="/icon.png" alt="Broco, la mascotte de BrocoQuests" width="72" height="72" loading="lazy">
<div><p class="app-cta-title">${esc(r.cta || 'Ancre la règle pour de bon avec BrocoQuests')}</p><p>5 minutes par jour. L'algorithme te repropose les règles que tu maîtrises le moins, au bon moment.</p>
<a href="${ctaUrl(camp)}" class="btn">Télécharger gratuitement →</a></div>
</aside>
${r.faq?.length ? `<section class="faq"><h2>Questions fréquentes</h2>${r.faq.map(f => `<details><summary>${esc(f.q)}</summary><div>${f.r}</div></details>`).join('')}</section>` : ''}
${voisines.length ? `<section><h2>À réviser aussi</h2><ul class="cards">${voisines.map(v => `<li><a href="/${MODULE.slug}/${v.slug}/"><span class="card-cat">${esc(v.categorie)}</span>${esc(v.h1)}</a></li>`).join('')}</ul></section>` : ''}
<p class="updated">Mis à jour le <time datetime="${r.miseAJour || today}">${new Date(r.miseAJour || today).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</time> · Rédigé par l'équipe BrocoQuests</p>
</article>
</main>
${footer}
<script src="/assets/quiz.js" defer></script>
${jsonld(breadcrumbLd([{ name: 'Accueil', path: '/' }, { name: MODULE.nom, path: `/${MODULE.slug}/` }, { name: r.h1, path }]))}
${jsonld({
  '@context': 'https://schema.org', '@type': 'Article', headline: r.h1, description: r.description,
  inLanguage: 'fr-FR', dateModified: r.miseAJour || today, mainEntityOfPage: SITE + path, image: `${SITE}/icon.png`,
  author: { '@type': 'Organization', name: 'BrocoQuests', url: SITE },
  publisher: { '@type': 'Organization', name: 'BrocoQuests', logo: { '@type': 'ImageObject', url: `${SITE}/icon.png` } },
  educationalLevel: NIVEAU(r.difficulte) || undefined, about: r.categorie,
})}
${r.faq?.length ? jsonld({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: r.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: strip(f.r) } })),
}) : ''}
</body>
</html>
`;
  return { path, html };
}

// ── Page hub ──────────────────────────────────────────────────────────────
function pageHub() {
  const path = `/${MODULE.slug}/`;
  const cats = [...new Set(regles.map(r => r.categorie))];
  const html = `${head({ title: `${MODULE.titre} | BrocoQuests`, description: 'Homophones, accords, conjugaison : toutes les règles d\'orthographe expliquées simplement, avec exemples, pièges et un quiz pour vérifier que tu as compris.', path, ogTitle: MODULE.titre })}
<main class="fiche hub">
<nav class="crumbs" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › <span>${MODULE.nom}</span></nav>
<h1>Règles d'orthographe : les fiches de Broco</h1>
<p class="lead">Chaque fiche explique une règle en clair, avec une astuce pour ne plus hésiter, les pièges les plus fréquents et un quiz express. Gratuit, sans inscription.</p>
${cats.map(c => `<section><h2>${esc(c)}</h2><ul class="cards">${regles.filter(r => r.categorie === c).map(r => `<li><a href="/${MODULE.slug}/${r.slug}/"><span class="card-title">${esc(r.h1)}</span><span class="card-desc">${esc(resume(strip(r.reponseCourte)))}</span></a></li>`).join('')}</ul></section>`).join('\n')}
<aside class="app-cta">
<img src="/icon.png" alt="Broco, la mascotte de BrocoQuests" width="72" height="72" loading="lazy">
<div><p class="app-cta-title">Toutes les règles, révisées au bon moment</p><p>Dans l'app, l'algorithme de répétition espacée te repropose chaque règle juste avant que tu l'oublies.</p>
<a href="${ctaUrl('hub-orthographe')}" class="btn">Télécharger gratuitement →</a></div>
</aside>
</main>
${footer}
${jsonld(breadcrumbLd([{ name: 'Accueil', path: '/' }, { name: MODULE.nom, path }]))}
${jsonld({
  '@context': 'https://schema.org', '@type': 'CollectionPage', name: MODULE.titre, url: SITE + path, inLanguage: 'fr-FR',
  hasPart: regles.map(r => ({ '@type': 'Article', headline: r.h1, url: `${SITE}/${MODULE.slug}/${r.slug}/` })),
})}
</body>
</html>
`;
  return { path, html };
}

// ── Écriture ──────────────────────────────────────────────────────────────
const outDir = join(ROOT, MODULE.slug);
if (existsSync(outDir)) rmSync(outDir, { recursive: true });
const pages = [pageHub(), ...regles.map(pageRegle)];
for (const p of pages) {
  const dir = join(ROOT, p.path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), p.html);
}

// Liens de l'accueil : les 8 premières fiches (ou celles marquées "accueil": true)
const homePath = join(ROOT, 'index.html');
const vedettes = (regles.some(r => r.accueil) ? regles.filter(r => r.accueil) : regles).slice(0, 8);
const home = readFileSync(homePath, 'utf8').replace(
  /(<!-- fiches:start[^>]*-->)[\s\S]*?(<!-- fiches:end -->)/,
  (_, a, b) => `${a}\n${vedettes.map(r => `<a href="/${MODULE.slug}/${r.slug}/">${esc(r.lien || r.item.replace(/\s*\/\s*/g, ' ou '))}</a>`).join('\n')}\n${b}`);
writeFileSync(homePath, home);

// Sitemap : l'accueil + les pages générées
const urls = [
  { loc: '/', freq: 'weekly', prio: '1.0' },
  { loc: `/${MODULE.slug}/`, freq: 'weekly', prio: '0.8' },
  ...regles.map(r => ({ loc: `/${MODULE.slug}/${r.slug}/`, freq: 'monthly', prio: '0.7', mod: r.miseAJour })),
];
writeFileSync(join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${SITE}${u.loc}</loc>${u.mod ? `\n    <lastmod>${u.mod}</lastmod>` : ''}
    <changefreq>${u.freq}</changefreq>
    <priority>${u.prio}</priority>
  </url>`).join('\n')}
</urlset>
`);

console.log(`✓ ${pages.length} pages générées dans /${MODULE.slug}/, sitemap mis à jour (${urls.length} URL)`);
