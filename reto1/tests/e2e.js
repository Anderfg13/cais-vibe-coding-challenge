// Pruebas de punta a punta en un navegador real (Chromium vía Playwright).
// Uso:  npm install  →  npm run test:instalar (solo la primera vez)  →  npm test
// Corre todo dos veces: con la app abierta como archivo (doble clic) y servida por server.js.
'use strict';
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const { pathToFileURL } = require('url');
const { crearServidor } = require('../server.js');

const APP = path.resolve(__dirname, '..', 'app');
let pasaron = 0, fallaron = 0;
const fallos = [];

function ok(cond, nombre, detalle = '') {
  if (cond) { pasaron++; console.log(`  ✔ ${nombre}`); }
  else { fallaron++; fallos.push(nombre); console.log(`  ✘ ${nombre} ${detalle}`); }
}

function hoy() {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function sumarDias(f, n) {
  const d = new Date(f + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

async function nuevaPagina(browser, url, { prepararStorage, viewport } = {}) {
  const ctx = await browser.newContext(viewport ? { viewport } : {});
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('dialog', d => { errores.push('diálogo inesperado: ' + d.message()); d.dismiss(); });
  if (prepararStorage) await page.addInitScript(prepararStorage);
  await page.goto(url);
  return { ctx, page, errores };
}

async function registrarPaciente(page, nombre, especie, responsable) {
  await page.fill('#p-nombre', nombre);
  await page.selectOption('#p-especie', especie);
  await page.fill('#p-responsable', responsable);
  await page.click('#form-paciente button[type=submit]');
  return (await page.textContent('#msg-paciente')).trim();
}
async function registrarVisita(page, { paciente, fecha, motivo, notas = '' }) {
  if (paciente !== undefined) await page.selectOption('#v-paciente', paciente);
  if (fecha !== undefined) await page.fill('#v-fecha', fecha);
  await page.fill('#v-motivo', motivo);
  await page.fill('#v-notas', notas);
  await page.click('#form-visita button[type=submit]');
  return (await page.textContent('#msg-visita')).trim();
}
const filas = page => page.locator('#tabla-pacientes tr').count();
const esError = async (page, sel) => ((await page.getAttribute(sel, 'class')) || '').includes('error');
const historial = page => page.locator('#historial li').allTextContents();
const idDe = (page, texto) => page.locator('#v-paciente option', { hasText: texto }).first().getAttribute('value');

async function suite(browser, url, etiqueta) {
  console.log(`\n=== ${etiqueta} ===\n${url}`);

  // ---------- Estado inicial ----------
  let { ctx, page, errores } = await nuevaPagina(browser, url);
  console.log('Estado inicial');
  ok(await page.title() === 'Veterinaria del Barrio', 'título correcto');
  ok(await filas(page) === 0, 'tabla vacía al inicio');
  ok(await page.isVisible('#sin-pacientes'), 'se ve "Aún no hay pacientes"');
  ok(await page.inputValue('#v-fecha') === hoy(), 'fecha por defecto = hoy en hora local');
  ok(await page.isHidden('#aviso'), 'sin avisos al inicio');
  ok((await historial(page))[0].includes('Elige un paciente'), 'el historial pide elegir paciente');
  ok(await page.locator('#form-paciente, #form-visita, #tabla-pacientes').count() === 3, 'las 3 funciones están en pantalla');

  // ---------- Función 1: registrar paciente ----------
  console.log('Función 1 · Registrar paciente');
  let m = await registrarPaciente(page, 'Rocky', 'Perro', 'Pepa Inventada');
  ok(m === 'Paciente "Rocky" registrado.', 'registro válido muestra confirmación', m);
  ok(!(await esError(page, '#msg-paciente')), 'la confirmación no se ve como error');
  ok(await filas(page) === 1, 'aparece una fila en la tabla');
  ok(await page.inputValue('#p-nombre') === '' && await page.inputValue('#p-responsable') === '', 'el formulario se limpia');
  ok(await page.inputValue('#v-paciente') !== '', 'el paciente nuevo queda elegido para registrarle visita');
  ok(await page.isHidden('#sin-pacientes'), 'se oculta el mensaje de lista vacía');
  await page.press('#p-nombre', 'Enter');
  ok(await esError(page, '#msg-paciente') && await filas(page) === 1, 'Enter con formulario vacío no registra');

  console.log('Validaciones de paciente');
  for (const [n, e, r, caso] of [
    ['', 'Perro', 'X', 'nombre vacío'],
    ['   ', 'Perro', 'X', 'nombre solo con espacios'],
    ['Bobby', '', 'X', 'sin especie'],
    ['Bobby', 'Perro', '', 'responsable vacío'],
    ['Bobby', 'Perro', '    ', 'responsable solo con espacios'],
    ['!!!', 'Perro', 'X', 'nombre sin letras ni números'],
    ['Bobby', 'Perro', '---', 'responsable sin letras ni números'],
  ]) {
    m = await registrarPaciente(page, n, e, r);
    ok(await esError(page, '#msg-paciente') && await filas(page) === 1, `rechaza ${caso}`, m);
  }
  ok(await page.getAttribute('#p-responsable', 'aria-invalid') === 'true', 'el campo inválido queda marcado en rojo');

  await page.evaluate(() => { const o = document.createElement('option'); o.value = o.text = 'Dragón'; document.querySelector('#p-especie').add(o); });
  m = await registrarPaciente(page, 'Smaug', 'Dragón', 'Hacker');
  ok(await esError(page, '#msg-paciente') && await filas(page) === 1, 'rechaza especie fuera de la lista (HTML manipulado)', m);

  m = await registrarPaciente(page, '  rocky ', 'Perro', 'pepa   inventada');
  ok(await esError(page, '#msg-paciente') && await filas(page) === 1, 'rechaza duplicado con otras mayúsculas/espacios', m);
  m = await registrarPaciente(page, 'Rócky', 'Perro', 'Pepa Inventada');
  ok(await esError(page, '#msg-paciente') && await filas(page) === 1, 'rechaza duplicado con tilde', m);
  m = await registrarPaciente(page, 'Rocky', 'Gato', 'Pepa Inventada');
  ok(!(await esError(page, '#msg-paciente')) && await filas(page) === 2, 'permite mismo nombre con otra especie', m);
  m = await registrarPaciente(page, 'Rocky', 'Perro', 'Otro Dueño');
  ok(!(await esError(page, '#msg-paciente')) && await filas(page) === 3, 'permite mismo nombre con otro responsable', m);

  await registrarPaciente(page, '  Luna    Llena  ', 'Gato', ' Carla   Ficticia ');
  ok((await page.locator('#tabla-pacientes').textContent()).includes('Luna Llena'), 'normaliza espacios sobrantes');

  await page.fill('#p-nombre', 'N'.repeat(80));
  ok((await page.inputValue('#p-nombre')).length === 50, 'el campo nombre no deja escribir más de 50 caracteres');
  await page.evaluate(() => document.querySelector('#p-nombre').removeAttribute('maxlength'));
  m = await registrarPaciente(page, 'N'.repeat(80), 'Ave', 'Largo');
  ok(await esError(page, '#msg-paciente'), 'rechaza nombre > 50 aunque se quite el límite del HTML', m);

  console.log('Seguridad');
  await registrarPaciente(page, '<img src=x onerror="window.__xss=1">', 'Otro', '<script>window.__xss=2</script>');
  ok(await page.evaluate(() => window.__xss === undefined), 'no ejecuta código inyectado en paciente');
  ok((await page.locator('#tabla-pacientes').textContent()).includes('<img src=x'), 'muestra el texto tal cual');
  ok(await page.locator('#tabla-pacientes img, #v-paciente img').count() === 0, 'no crea etiquetas <img>');

  m = await registrarPaciente(page, 'Ñoño "el Güero" 🐶', 'Perro', "D'Artagnan Pérez");
  ok(!(await esError(page, '#msg-paciente')), 'acepta tildes, ñ, comillas y emojis', m);

  // ---------- Función 2: lista ----------
  console.log('Función 2 · Lista de pacientes');
  ok(await filas(page) === 6, 'la lista tiene exactamente los 6 pacientes válidos', `(tiene ${await filas(page)})`);
  const nombres = await page.locator('#tabla-pacientes tr td:first-child').allTextContents();
  const ordenados = [...nombres].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  ok(JSON.stringify(nombres) === JSON.stringify(ordenados), 'ordenada alfabéticamente');
  ok((await page.locator('#tabla-pacientes tr td:nth-child(4)').allTextContents()).every(t => t === '0'), 'todos empiezan con 0 visitas');
  ok(await page.locator('#v-paciente option').count() === 7, 'el selector de visitas tiene los 6 pacientes + "Elige…"');

  // ---------- Función 3: visitas ----------
  console.log('Función 3 · Visitas e historial');
  const idRocky = await idDe(page, 'Rocky (Perro) — Pepa Inventada');
  m = await registrarVisita(page, { paciente: idRocky, fecha: '2026-01-15', motivo: 'Vacuna', notas: 'Rabia' });
  ok(m === 'Visita registrada para Rocky.', 'registra visita válida', m);
  await registrarVisita(page, { paciente: idRocky, fecha: '2026-03-02', motivo: 'Control' });
  await registrarVisita(page, { paciente: idRocky, fecha: '2025-12-24', motivo: 'Herida pata' });
  let h = await historial(page);
  ok(h.length === 3, 'el historial de Rocky tiene 3 visitas', JSON.stringify(h));
  ok(h[0].startsWith('2026-03-02') && h[1].startsWith('2026-01-15') && h[2].startsWith('2025-12-24'), 'ordenado de la más reciente a la más antigua');
  ok(h[1].includes('(Rabia)'), 'se muestran las notas');
  ok(await page.textContent('#titulo-historial') === 'Historial de Rocky', 'título del historial correcto');
  ok(await page.inputValue('#v-motivo') === '' && await page.inputValue('#v-paciente') === idRocky, 'se limpia el motivo y se mantiene el paciente');
  const filaRocky = page.locator('#tabla-pacientes tr', { hasText: 'Pepa Inventada' }).filter({ hasText: 'Perro' });
  ok(await filaRocky.locator('td:nth-child(4)').textContent() === '3', 'la tabla muestra 3 visitas para Rocky');
  ok(await page.locator('#tabla-pacientes tr', { hasText: 'Rocky' }).filter({ hasText: 'Gato' }).locator('td:nth-child(4)').textContent() === '0', 'el otro Rocky (Gato) sigue con 0: no se mezclan');

  await registrarVisita(page, { paciente: idRocky, fecha: '2026-03-02', motivo: 'Segunda del día' });
  ok((await historial(page))[0].includes('Segunda del día'), 'misma fecha: la última registrada aparece primero');

  await page.selectOption('#v-paciente', await idDe(page, 'Luna Llena'));
  h = await historial(page);
  ok(h.length === 1 && h[0].includes('Sin visitas'), 'otro paciente tiene su propio historial (vacío)');

  await filaRocky.locator('[data-ver]').click();
  ok(await page.inputValue('#v-paciente') === idRocky && (await historial(page)).length === 4, 'el botón "Ver historial" abre el del paciente correcto');

  console.log('Validaciones de visita');
  const antes = (await historial(page)).length;
  for (const [datos, caso] of [
    [{ paciente: '', fecha: '2026-01-01', motivo: 'X' }, 'sin paciente'],
    [{ paciente: idRocky, fecha: '', motivo: 'X' }, 'sin fecha'],
    [{ paciente: idRocky, fecha: '2026-01-01', motivo: '   ' }, 'motivo vacío'],
    [{ paciente: idRocky, fecha: '2026-01-01', motivo: '...' }, 'motivo sin letras'],
    [{ paciente: idRocky, fecha: sumarDias(hoy(), 1), motivo: 'Futuro' }, 'fecha futura (mañana)'],
    [{ paciente: idRocky, fecha: '1999-12-31', motivo: 'Viejo' }, 'fecha anterior al 2000'],
  ]) {
    m = await registrarVisita(page, datos);
    const fueError = await esError(page, '#msg-visita');
    await page.selectOption('#v-paciente', idRocky);
    ok(fueError && (await historial(page)).length === antes, `rechaza visita ${caso}`, m);
  }
  m = await registrarVisita(page, { paciente: idRocky, fecha: hoy(), motivo: 'Hoy' });
  ok(!(await esError(page, '#msg-visita')), 'acepta la fecha de hoy', m);

  await page.evaluate(() => { const o = document.createElement('option'); o.value = 'fantasma'; o.text = 'Fantasma'; document.querySelector('#v-paciente').add(o); });
  m = await registrarVisita(page, { paciente: 'fantasma', fecha: '2026-01-01', motivo: 'Nada' });
  ok(await esError(page, '#msg-visita'), 'rechaza visita a un paciente que no existe (HTML manipulado)', m);
  await page.selectOption('#v-paciente', idRocky);
  await page.evaluate(() => { const i = document.querySelector('#v-fecha'); i.type = 'text'; i.value = '2026-02-30'; });
  await page.fill('#v-motivo', 'Imposible'); await page.click('#form-visita button[type=submit]');
  ok(await esError(page, '#msg-visita'), 'rechaza fecha imposible (30 de febrero)');
  await page.evaluate(() => { document.querySelector('#v-fecha').value = 'hola'; });
  await page.fill('#v-motivo', 'Basura'); await page.click('#form-visita button[type=submit]');
  ok(await esError(page, '#msg-visita'), 'rechaza fecha con formato inválido');
  await page.evaluate(() => { const i = document.querySelector('#v-fecha'); i.type = 'date'; i.value = '2026-01-01'; document.querySelector('#v-notas').removeAttribute('maxlength'); });
  m = await registrarVisita(page, { paciente: idRocky, motivo: 'Notas largas', notas: 'x'.repeat(301) });
  ok(await esError(page, '#msg-visita'), 'rechaza notas > 300 caracteres', m);
  await registrarVisita(page, { paciente: idRocky, fecha: '2026-01-02', motivo: '<b onmouseover=alert(1)>x</b>', notas: '<script>window.__xss=3</script>' });
  ok(await page.evaluate(() => window.__xss === undefined) && await page.locator('#historial b').count() === 0, 'no ejecuta código inyectado en visitas');

  // ---------- Persistencia ----------
  console.log('Persistencia');
  const total = await filas(page);
  await page.reload();
  ok(await filas(page) === total, 'los pacientes siguen tras recargar (F5)');
  await page.selectOption('#v-paciente', idRocky);
  ok((await historial(page)).length === 6, 'las visitas siguen tras recargar', JSON.stringify(await historial(page)));

  const p2 = await ctx.newPage();
  await p2.goto(url);
  await registrarPaciente(p2, 'Desde otra pestaña', 'Conejo', 'Tester');
  await page.waitForFunction(() => document.querySelector('#tabla-pacientes').textContent.includes('Desde otra pestaña'), null, { timeout: 3000 }).catch(() => {});
  ok((await page.locator('#tabla-pacientes').textContent()).includes('Desde otra pestaña'), 'otra pestaña abierta se actualiza sola');
  await p2.close();

  // ---------- Datos de ejemplo ----------
  console.log('Datos de ejemplo');
  const n = await filas(page);
  await page.click('#btn-demo');
  ok(await filas(page) === n + 2, 'carga 2 pacientes de ejemplo');
  await page.click('#btn-demo');
  ok(await filas(page) === n + 2 && !(await esError(page, '#msg-paciente')), 'pulsar dos veces no los duplica');
  await page.selectOption('#v-paciente', await idDe(page, 'Firulais'));
  ok((await historial(page)).length === 2, 'Firulais trae sus 2 visitas de ejemplo');

  ok(errores.length === 0, 'cero errores de JavaScript en toda la sesión', JSON.stringify(errores));
  await ctx.close();

  // ---------- Almacenamiento dañado o bloqueado ----------
  console.log('Robustez del almacenamiento');
  ({ ctx, page, errores } = await nuevaPagina(browser, url, {
    prepararStorage: () => { if (!sessionStorage.getItem('hecho')) { sessionStorage.setItem('hecho', '1'); localStorage.setItem('vet-barrio-v1', '{esto no es json'); } },
  }));
  ok(await page.isVisible('#aviso') && (await page.textContent('#aviso')).includes('dañados'), 'datos corruptos: muestra aviso claro');
  ok(await page.evaluate(() => localStorage.getItem('vet-barrio-v1-respaldo-corrupto')) === '{esto no es json', 'datos corruptos: guarda una copia de respaldo');
  m = await registrarPaciente(page, 'Post corrupción', 'Gato', 'Ana');
  ok(!(await esError(page, '#msg-paciente')) && await filas(page) === 1, 'datos corruptos: la app sigue funcionando');
  await page.reload();
  ok(await filas(page) === 1 && await page.isHidden('#aviso'), 'datos corruptos: tras guardar, al recargar ya está sana');
  ok(errores.length === 0, 'datos corruptos: sin errores JS', JSON.stringify(errores));
  await ctx.close();

  ({ ctx, page, errores } = await nuevaPagina(browser, url, {
    prepararStorage: () => { if (!sessionStorage.getItem('hecho')) { sessionStorage.setItem('hecho', '1'); localStorage.setItem('vet-barrio-v1', JSON.stringify({ pacientes: 'no-es-lista', visitas: [] })); } },
  }));
  ok(await page.isVisible('#aviso') && errores.length === 0, 'estructura inválida: avisa sin romperse');
  await ctx.close();

  ({ ctx, page, errores } = await nuevaPagina(browser, url, {
    prepararStorage: () => { if (!sessionStorage.getItem('hecho')) { sessionStorage.setItem('hecho', '1'); localStorage.setItem('vet-barrio-v1', JSON.stringify({
      pacientes: [{ id: 'a', nombre: 'Viejo', especie: 'Perro', responsable: 'R' }],
      visitas: [{ id: 'v1', pacienteId: 'a', fecha: '2026-01-01', motivo: 'Ok' }, { id: 'v2', pacienteId: 'zzz', fecha: '2026-01-01', motivo: 'Huérfana' }],
    })); } },
  }));
  await page.selectOption('#v-paciente', 'a');
  ok((await historial(page)).length === 1 && await page.isHidden('#aviso') && errores.length === 0, 'datos de una versión anterior cargan bien e ignoran visitas huérfanas');
  await ctx.close();

  ({ ctx, page, errores } = await nuevaPagina(browser, url, {
    prepararStorage: () => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('bloqueado'); } }); },
  }));
  ok(await page.isVisible('#aviso') && (await page.textContent('#aviso')).includes('no permite guardar'), 'almacenamiento bloqueado: avisa');
  await registrarPaciente(page, 'Memoria', 'Ave', 'Tester');
  await registrarVisita(page, { fecha: '2026-01-01', motivo: 'En memoria' });
  ok(await filas(page) === 1 && (await historial(page)).length === 1, 'almacenamiento bloqueado: igual funciona en memoria');
  ok(errores.length === 0, 'almacenamiento bloqueado: sin errores JS', JSON.stringify(errores));
  await ctx.close();

  ({ ctx, page, errores } = await nuevaPagina(browser, url, {
    prepararStorage: () => { Storage.prototype.setItem = function () { throw new DOMException('lleno', 'QuotaExceededError'); }; },
  }));
  m = await registrarPaciente(page, 'Sin espacio', 'Gato', 'Tester');
  ok(await esError(page, '#msg-paciente') && m.includes('No se pudo guardar') && await filas(page) === 0, 'almacenamiento lleno: avisa y no deja datos a medias', m);
  ok(errores.length === 0, 'almacenamiento lleno: sin errores JS');
  await ctx.close();

  // ---------- Celular ----------
  console.log('Pantalla de celular (375 px)');
  ({ ctx, page } = await nuevaPagina(browser, url, { viewport: { width: 375, height: 700 } }));
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  ok(ancho <= 376, 'sin scroll horizontal', `(ancho ${ancho})`);
  m = await registrarPaciente(page, 'Móvil', 'Perro', 'Tester');
  ok(!(await esError(page, '#msg-paciente')), 'se puede registrar desde el celular');
  await ctx.close();
}

async function get(url) {
  return new Promise((res, rej) => http.get(url, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res({ status: r.statusCode, tipo: r.headers['content-type'], body: b })); }).on('error', rej));
}

(async () => {
  const srv = crearServidor();
  await new Promise(r => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  try {
    console.log('=== Servidor (server.js) ===');
    let r = await get(base + '/');
    ok(r.status === 200 && r.tipo.startsWith('text/html') && r.body.includes('Veterinaria del Barrio'), 'GET / devuelve la app');
    r = await get(base + '/app.js');
    ok(r.status === 200 && r.tipo.startsWith('text/javascript'), 'GET /app.js con tipo correcto');
    r = await get(base + '/styles.css');
    ok(r.status === 200 && r.tipo.startsWith('text/css'), 'GET /styles.css con tipo correcto');
    r = await get(base + '/no-existe.html');
    ok(r.status === 404, 'archivo inexistente → 404');
    r = await get(base + '/..%2Fpackage.json');
    ok(r.status === 403 || r.status === 404, 'no deja leer archivos fuera de app/ (path traversal)', `(status ${r.status})`);
    r = await get(base + '/%E0%A4%A');
    ok(r.status === 400, 'URL mal codificada → 400 sin caerse');

    await suite(browser, pathToFileURL(path.join(APP, 'index.html')).href, 'Abierta con doble clic (file://)');
    await suite(browser, base + '/', 'Servida con npm start (http://)');
  } finally {
    await browser.close();
    srv.close();
  }
  console.log(`\nResultado: ${pasaron} pasaron, ${fallaron} fallaron`);
  if (fallaron) { console.log('Fallos:\n - ' + fallos.join('\n - ')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
