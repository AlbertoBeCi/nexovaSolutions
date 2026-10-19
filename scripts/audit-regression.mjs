/** Comprobaciones de navegador sin escribir en ninguna API real. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const require = createRequire(join(process.env.NEXOVA_AUDIT_TOOLS || join(tmpdir(), 'nexova-performance-tools'), 'package.json'));
const { chromium } = require('playwright');
const [phase = 'final', scope = 'all'] = process.argv.slice(2);
assert.match(phase, /^[a-zA-Z0-9-]+$/);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const checks = [];
let completed = false;
const check = (name, details = {}) => { checks.push({ name, pass: true, ...details }); console.log(name); };
const vitals = await readFile(require.resolve('web-vitals').replace(/web-vitals\.js$/, 'web-vitals.iife.js'), 'utf8');
try {
  if (scope !== 'backoffice') {
    const context = await browser.newContext({ viewport: { width: 412, height: 823 }, colorScheme: 'dark', locale: 'es-ES' });
    await context.addInitScript({ content: vitals + ';window.__inp=[];webVitals.onINP(m=>window.__inp.push({value:m.value, rating:m.rating}),{reportAllChanges:true,durationThreshold:0});' });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('http://localhost:3000/');
    await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
    await page.locator('#menu-movil').getByRole('link', { name: 'Servicios', exact: true }).click();
    await page.waitForURL('**/#servicios');
    assert.equal(await page.locator('#menu-movil').count(), 0);
    check('website: menú móvil navega y se cierra');
    const initial = await page.locator('html').getAttribute('data-theme');
    await page.getByRole('button', { name: /Cambiar a modo/ }).click();
    assert.notEqual(await page.locator('html').getAttribute('data-theme'), initial);
    await page.getByRole('button', { name: /Cambiar a modo/ }).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), initial);
    check('website: alternancia de temas');
    await page.waitForTimeout(1200);
    check('website: INP local, sesión móvil con CPU x4; no representa p75 de campo', { samples: await page.evaluate(() => window.__inp) });
    await page.setViewportSize({ width: 1280, height: 900 });
    assert.equal(await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Servicios', exact: true }).isVisible(), true);
    check('website: navegación de escritorio');
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Solicitar Ahora', exact: true }).click();
    await page.locator('#fullName').waitFor();
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    assert.equal(await page.locator('#fullName').getAttribute('aria-invalid'), 'true');
    await page.locator('#fullName').fill('Persona Auditoría');
    await page.locator('#email').fill('auditoria@example.com');
    await page.locator('#phone').fill('+34 612 345 678');
    await page.locator('#country').selectOption('espana');
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await page.locator('#yearsExperience').fill('5');
    await page.locator('#englishLevel').selectOption('avanzado');
    await page.locator('#sector').selectOption('tecnologia');
    await page.getByLabel('Inmediata', { exact: true }).check();
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await page.locator('#terms').check();
    await page.getByRole('button', { name: 'Enviar Formulario a Nexova', exact: true }).click();
    await page.getByRole('button', { name: 'Enviar otra solicitud' }).waitFor();
    await page.getByRole('button', { name: 'Enviar otra solicitud' }).click();
    assert.equal(await page.locator('#fullName').inputValue(), '');
    assert.deepEqual(errors, []);
    check('website: validación, tres pasos, envío simulado y reinicio sin errores de hidratación');
    await context.close();
  }
  if (scope !== 'website') {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', locale: 'es-ES' });
    // Bloquea escrituras reales aunque cambie el origen de la API en otra instalación.
    await context.route('**/*', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort('blockedbyclient'));
    const interactionSamples = [];
    await context.exposeBinding('auditINP', (source, metric) => { interactionSamples.push({ url: source.frame.url(), ...metric }); });
    await context.addInitScript({ content: vitals + ';window.__inp=[];webVitals.onINP(m=>{window.__inp.push({value:m.value,rating:m.rating});window.auditINP({value:m.value,rating:m.rating});},{reportAllChanges:true,durationThreshold:0});' });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/tracker/api/**', route => {
      if (route.request().method() !== 'GET') return route.abort('blockedbyclient');
      return route.continue();
    });
    await page.goto('http://localhost:3001/');
    await page.locator('tbody a').first().waitFor({ timeout: 45000 });
    for (const colorScheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme });
      const typography = await page.getByText('Backoffice', { exact: true }).first().evaluate(el => {
        const style = getComputedStyle(el);
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const luminance = color => { ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); const rgba = ctx.getImageData(0, 0, 1, 1).data; const rgb = [...rgba].slice(0, 3).map(c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
        const foreground = luminance(style.color); const background = luminance(getComputedStyle(document.body).backgroundColor);
        return { color: style.color, contrast: (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05), bodyFont: getComputedStyle(document.body).fontFamily };
      });
      assert.ok(typography.contrast >= 4.5);
      assert.equal(typography.bodyFont, 'Arial, Helvetica, sans-serif');
      check(`backoffice: tipografía y color en tema ${colorScheme}`, typography);
    }
    await page.getByLabel('Filtrar por estado').selectOption('received');
    await page.waitForURL('**/*status=received*');
    await page.getByLabel('Filtrar por etapa').selectOption('pending');
    await page.waitForURL('**/*stage=pending*');
    await page.getByLabel('Buscar por nombre o correo', { exact: true }).fill('Michael');
    await page.waitForURL('**/*search=Michael*');
    check('backoffice: etiquetas, filtros y búsqueda sincronizan URL');
    await page.waitForTimeout(1200);
    const fonts = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => /\.(woff2?|ttf)/.test(r.name)).map(r => ({ url: r.name, bytes: r.transferSize })));
    assert.deepEqual(fonts, []);
    check('backoffice: solicitudes de fuentes eliminadas', { fonts });
    const cases = JSON.parse(await readFile('audit/cases.json', 'utf8'));
    await page.goto(cases.find(c => c.name === 'backoffice-detail').url);
    await page.getByLabel('Estado', { exact: true }).waitFor({ timeout: 45000 });
    assert.ok((await page.locator('h1').textContent()).trim());
    assert.equal(await page.getByLabel('Etapa', { exact: true }).count(), 1);
    check('backoffice: ficha, notas y selectores cargan');
    const mutations = [];
    let record = { id: 'audit-browser-only', full_name: 'Persona Auditoría', email: 'auditoria@example.com', phone: '+34 612 345 678', position: 'Consultoría', linkedin_url: null, cv_url: null, experience_years: 5, status: 'received', stage: 'pending', notes_count: 0, applied_at: '2026-10-19T10:00:00Z', updated_at: '2026-10-19T10:00:00Z' };
    let notes = [];
    let failure = false;
    await page.route('**/tracker/api/**', async route => {
      const request = route.request(); const method = request.method(); const path = new URL(request.url()).pathname;
      const body = method === 'GET' || method === 'DELETE' ? null : request.postDataJSON();
      let json;
      if (method !== 'GET') mutations.push({ method, path, body });
      if (failure && method === 'GET' && path.includes(record.id)) return route.fulfill({ status: 500, json: { error: 'Error simulado de auditoría' }, headers: { 'access-control-allow-origin': '*' } });
      if (path.endsWith('/notes') && method === 'POST') { const note = { id: 'audit-note', record_id: record.id, content: body.content, created_at: '2026-10-19T10:00:00Z' }; notes.push(note); json = note; }
      else if (path.includes('/notes/') && method === 'DELETE') { notes = []; return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }); }
      else if (path.endsWith('/notes')) json = { data: notes, meta: { total: notes.length } };
      else if (method !== 'GET') { record = { ...record, ...body }; json = record; }
      else if (path.endsWith('/records')) json = { data: [record], total: 1, page: 1, limit: 100 };
      else json = record;
      return route.fulfill({ status: 200, json, headers: { 'access-control-allow-origin': '*' } });
    });
    await page.goto('http://localhost:3001/candidates/new');
    assert.equal(await page.getByLabel('Estado inicial', { exact: true }).count(), 1);
    assert.equal(await page.getByLabel('Etapa inicial', { exact: true }).count(), 1);
    check('backoffice: alta conserva sus selectores etiquetados');
    for (const [id, value] of Object.entries({ name: 'Persona Auditoría', email: 'auditoria@example.com', phone: '+34 612 345 678', position: 'Consultoría', yearsOfExperience: '5' })) await page.locator(`#candidate-${id}`).fill(value);
    await page.getByLabel('Estado inicial', { exact: true }).selectOption('in_progress');
    await page.getByLabel('Etapa inicial', { exact: true }).selectOption('review');
    await page.getByRole('button', { name: 'Registrar candidato', exact: true }).click();
    await page.getByText(/creado correctamente/).waitFor();
    assert.equal(mutations[0].method, 'POST'); assert.equal(mutations[1].method, 'PATCH');
    assert.equal(mutations[1].body.stage, 'review');
    check('backoffice: alta y ajuste de estado/etapa con respuestas simuladas');
    await page.goto(`http://localhost:3001/candidates/${record.id}`);
    await page.getByLabel('Estado', { exact: true }).selectOption('selected');
    await page.waitForFunction(() => !document.querySelector('#candidate-status').disabled);
    assert.equal(record.status, 'selected');
    await page.getByLabel('Etapa', { exact: true }).selectOption('personal_interview');
    await page.waitForFunction(() => !document.querySelector('#candidate-stage').disabled);
    assert.equal(record.stage, 'personal_interview');
    await page.getByPlaceholder('Escribe una nota interna sobre este candidato...').fill('Nota de prueba sin persistencia real');
    await page.getByRole('button', { name: 'Añadir nota', exact: true }).click();
    await page.getByText('Nota de prueba sin persistencia real', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await page.getByText('Este candidato todavía no tiene notas.', { exact: true }).waitFor();
    check('backoffice: cambios de estado/etapa, alta y borrado de notas simulados');
    await page.getByRole('link', { name: 'Editar candidato', exact: true }).click();
    await page.locator('#candidate-name').fill('Persona Editada');
    await page.getByRole('button', { name: /Guardar cambios/ }).click();
    await page.getByText('Los cambios se guardaron correctamente.', { exact: true }).waitFor();
    assert.equal(record.full_name, 'Persona Editada');
    check('backoffice: edición simulada conserva el formulario');
    failure = true;
    await page.goto(`http://localhost:3001/candidates/${record.id}`);
    await page.getByText('Error simulado de auditoría', { exact: true }).waitFor();
    check('backoffice: error de API visible', { mutations });
    await page.goto('http://localhost:3001/incidencias');
    await page.waitForURL('**/login**');
    assert.deepEqual(errors, []);
    check('backoffice: protección de incidencias y ausencia de errores de hidratación');
    await page.waitForTimeout(1000);
    check('backoffice: INP local durante el recorrido, CPU x4; no representa p75 de campo', { samples: interactionSamples, available: interactionSamples.length > 0 });
    await context.close();
    const reading = await browser.newContext({ viewport: { width: 412, height: 823 }, colorScheme: 'dark' });
    const detail = await reading.newPage();
    const apiRequests = [];
    detail.on('request', request => { if (/playground.*\/records\/[^/?]+(?:\/notes)?$/.test(request.url())) apiRequests.push(request.url()); });
    await detail.goto(cases.find(c => c.name === 'backoffice-detail').url);
    await detail.getByLabel('Estado', { exact: true }).waitFor({ timeout: 45000 });
    await detail.waitForTimeout(800);
    assert.equal(apiRequests.length, 2, 'candidato y notas deben solicitarse una sola vez cada uno');
    assert.equal(new Set(apiRequests).size, 2);
    check('backoffice: precargas reutilizadas, una solicitud por recurso', { apiRequests });
    const resources = await detail.evaluate(() => performance.getEntriesByType('resource').map(r => r.name));
    assert.equal(resources.some(url => /favicon.*\.ico/.test(url)), false);
    check('backoffice: SVG solicitado sin descargar el favicon ICO de plantilla');
    for (const width of [412, 1280]) {
      await detail.setViewportSize({ width, height: 900 });
      assert.equal(await detail.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      check(`backoffice: ficha sin desbordamiento horizontal a ${width}px`);
    }
    await reading.close();
  }
  completed = true;
} finally {
  await browser.close();
  await mkdir('audit/checks', { recursive: true });
  await writeFile(`audit/checks/${phase}.json`, JSON.stringify({ date: new Date().toISOString(), scope, completed, conditions: { browser: 'Chrome 155', cpuSlowdown: 4, network: 'local sin simulación de red', realUserData: false }, checks }, null, 2) + '\n');
}
