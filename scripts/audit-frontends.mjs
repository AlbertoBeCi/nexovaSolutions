/** Auditoría local reproducible. Herramientas en TEMP, nunca en el bundle de las apps. */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const toolRoot = process.env.NEXOVA_AUDIT_TOOLS || join(tmpdir(), 'nexova-performance-tools');
const toolRequire = createRequire(join(toolRoot, 'package.json'));
const { default: lighthouse } = await import(pathToFileURL(toolRequire.resolve('lighthouse')));
const { launch } = await import(pathToFileURL(toolRequire.resolve('chrome-launcher')));
const { default: playwright } = await import(pathToFileURL(toolRequire.resolve('playwright')));
const { chromium } = playwright;
const [phase = 'before/production', count = '3', ...selected] = process.argv.slice(2);
const output = resolve('audit', phase);
if (!output.startsWith(resolve('audit') + '\\') && !output.startsWith(resolve('audit') + '/')) {
  throw new Error('La fase debe estar dentro de audit/.');
}
await mkdir(output, { recursive: true });
const chrome = await launch({
  chromePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  chromeFlags: ['--headless=new', '--disable-extensions', '--no-first-run', '--disable-background-networking'],
});
let browser;
try {
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`);
  let cases;
  try { cases = JSON.parse(await readFile('audit/cases.json', 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const page = await browser.newPage();
    await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
    await page.locator('tbody a[href^="/candidates/"]').first().waitFor({ timeout: 45000 });
    const detail = await page.locator('tbody a[href^="/candidates/"]').first().getAttribute('href');
    cases = [
      { name: 'website-home', url: 'http://localhost:3000/' },
      { name: 'website-talento', url: 'http://localhost:3000/talento' },
      { name: 'backoffice-home', url: 'http://localhost:3001/' },
      { name: 'backoffice-detail', url: `http://localhost:3001${detail}` },
    ];
    await writeFile('audit/cases.json', JSON.stringify(cases, null, 2) + '\n');
    await page.close();
  }
  const rows = [];
  for (const entry of cases.filter(entry => count !== 'shots' && (!selected.length || selected.includes(entry.name)))) {
    for (let run = 1; run <= Number(count); run++) {
      const result = await lighthouse(entry.url, {
        port: chrome.port, output: ['html', 'json'], logLevel: 'error', locale: 'es',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      });
      const { lhr, artifacts } = result;
      if (lhr.runtimeError) throw new Error(JSON.stringify(lhr.runtimeError));
      const prefix = join(output, `${entry.name}-${run}`);
      await writeFile(`${prefix}.json`, JSON.stringify(lhr));
      const row = {
        name: entry.name, url: entry.url, run, fetchTime: lhr.fetchTime,
        lighthouseVersion: lhr.lighthouseVersion, userAgent: lhr.userAgent,
        config: lhr.configSettings, warnings: lhr.runWarnings,
        scores: Object.fromEntries(Object.entries(lhr.categories).map(([id, cat]) => [id, Math.round(cat.score * 100)])),
        metrics: Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time',
          'cumulative-layout-shift', 'speed-index', 'server-response-time'].map(id => [id, lhr.audits[id]?.numericValue ?? null])),
        failures: Object.entries(lhr.audits).filter(([, audit]) => audit.score !== null && audit.score < 1)
          .map(([id, audit]) => ({ id, score: audit.score, title: audit.title, value: audit.displayValue, details: audit.details })),
      };
      rows.push(row);
      await writeFile(join(output, 'runs.json'), JSON.stringify(rows, null, 2) + '\n');
      console.log(JSON.stringify({ phase, name: entry.name, run, scores: row.scores, metrics: row.metrics, warnings: row.warnings }));
      if (run === 1) {
        await writeFile(join(output, `${entry.name}.html`), result.report[0]);
        if (artifacts?.Trace) await writeFile(join(output, `${entry.name}-trace.json.gz`), gzipSync(JSON.stringify(artifacts.Trace)));
        const shot = lhr.audits['final-screenshot']?.details?.data;
        if (shot) await writeFile(join(output, `${entry.name}-page.jpg`), Buffer.from(shot.split(',')[1], 'base64'));
      }
    }
  }
  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const summary = count === 'shots' ? JSON.parse(await readFile(join(output, 'summary.json'), 'utf8')) : [...new Set(rows.map(row => row.name))].map(name => {
    const samples = rows.filter(row => row.name === name);
    return {
      name, url: samples[0].url, samples: samples.length,
      scores: Object.fromEntries(Object.keys(samples[0].scores).map(key => [key, median(samples.map(row => row.scores[key]))])),
      performanceRange: [Math.min(...samples.map(row => row.scores.performance)), Math.max(...samples.map(row => row.scores.performance))],
      metrics: Object.fromEntries(Object.keys(samples[0].metrics).map(key => [key, median(samples.map(row => row.metrics[key]))])),
    };
  });
  await writeFile(join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  // Captura del informe HTML real, con puntuaciones y métricas visibles.
  for (const entry of summary) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    await page.goto(pathToFileURL(join(output, `${entry.name}.html`)).href);
    await page.locator('body').waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: join(output, `${entry.name}-lighthouse.png`) });
    await page.close();
  }
  console.log(JSON.stringify({ summary }));
} finally {
  if (browser) await browser.close();
  try { await chrome.kill(); } catch (error) { console.warn(`Chrome cleanup: ${error.message}`); }
}
