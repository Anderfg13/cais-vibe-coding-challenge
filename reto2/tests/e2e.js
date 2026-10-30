// Pruebas automáticas del Reto 2 en un navegador real (Playwright).
// Uso: npm test   (desde reto2/)
'use strict';
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');
const { crearServidor } = require('../server');

const APP_FILE = 'file://' + path.join(__dirname, '..', 'app', 'index.html').replace(/\\/g, '/');
const EVID = path.join(__dirname, '..', 'evidencias');
const KEY = 'vet-barrio-v2';
const KEY_V1 = 'vet-barrio-v1';

let pasaron = 0;
const fallos = [];

async function caso(nombre, fn) {
  try { await fn(); pasaron++; console.log('  ✔', nombre); }
  catch (e) { fallos.push({ nombre, e }); console.log('  ✘', nombre, '\n     ', e.message.split('\n')[0]); }
}

async function nuevaPagina(ctx, url) {
  const page = await ctx.newPage();
  page.errores = [];
  page.on('pageerror', e => page.errores.push(e.message));
  await page.goto(url);
  return page;
}

async function abrir(browser, url, { ancho = 1100 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 }, locale: 'es-ES' });
  const page = await nuevaPagina(ctx, url);
  return { ctx, page };
}

async function registrar(page, { nombre, especie, responsables }) {
  await page.fill('#p-nombre', nombre);
  await page.selectOption('#p-especie', especie);
  for (let i = 0; i < responsables.length; i++) {
    if (i >= 2) await page.click('#btn-add-resp');
    await page.locator('.resp-input').nth(i).fill(responsables[i]);
  }
  await page.click('#form-paciente button[type=submit]');
}

const datosDb = (page) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const textoMsg = (page, sel) => page.textContent(sel);

async function main() {
  let srvActivo = crearServidor();
  await new Promise(r => srvActivo.listen(0, r));
  const port = srvActivo.address().port;
  const urlServidor = `http://localhost:${port}/`;

  const browser = await chromium.launch();
  console.log('Pruebas del Reto 2 (Vethub)\n');

  // 1. CA1: registrar mascota con dos responsables
  let ctx, page;
  ({ ctx, page } = await abrir(browser, urlServidor));
  await caso('CA1 · registrar mascota con dos responsables', async () => {
    await registrar(page, { nombre: 'Rocky', especie: 'Perro', responsables: ['Pepa Prueba', 'Tomás Prueba'] });
    assert.match(await textoMsg(page, '#msg-paciente'), /Rocky.*2 responsables/);
    const d = await datosDb(page);
    assert.equal(d.pacientes.length, 1);
    assert.equal(d.responsables.length, 2);
    assert.equal(d.vinculos.length, 2);
  });

  // 2. CA2: ficha de mascota muestra ambos responsables
  await caso('CA2 · ficha de mascota muestra todos sus responsables', async () => {
    await page.click('#tabla-pacientes a.nombre:has-text("Rocky")');
    await page.waitForSelector('#vista-ficha .ficha');
    const chips = await page.locator('#vista-ficha .chip').allTextContents();
    assert.equal(chips.length, 2);
    assert.ok(chips.some(t => t.includes('Pepa Prueba')) && chips.some(t => t.includes('Tomás Prueba')));
    assert.equal(await page.isHidden('#vista-inicio'), true);
    await page.screenshot({ path: path.join(EVID, 'ficha-mascota.png'), fullPage: true });
  });

  // 3. CA3: ficha de responsable muestra sus mascotas
  await caso('CA3 · ficha de responsable muestra sus mascotas', async () => {
    await page.click('#vista-ficha .chip:has-text("Pepa Prueba")');
    await page.waitForSelector('#vista-ficha .tarjetas');
    assert.match(await page.textContent('#vista-ficha h2'), /Pepa Prueba/);
    assert.match(await page.textContent('#vista-ficha .tarjetas'), /Rocky/);
    await page.screenshot({ path: path.join(EVID, 'ficha-responsable.png'), fullPage: true });
  });

  // 4 + 5. Mismo responsable en otra mascota (escrito con otras mayúsculas/tildes) → no se duplica
  await caso('CA3/4 · el mismo responsable en otra mascota no se duplica y aparece en ambas fichas', async () => {
    await page.goto(urlServidor + '#/');
    await registrar(page, { nombre: 'Luna', especie: 'Gato', responsables: ['PÉPA prueba', 'Sofía Prueba'] });
    assert.match(await textoMsg(page, '#msg-paciente'), /Luna.*2 responsables/);
    const d = await datosDb(page);
    const pepas = d.responsables.filter(r => r.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') === 'pepa prueba');
    assert.equal(pepas.length, 1, 'Pepa debe existir una sola vez');
    assert.equal(d.responsables.length, 3, 'Pepa, Tomás y Sofía');
    await page.click('#tabla-pacientes .responsables-celda a:has-text("Pepa Prueba")');
    await page.waitForSelector('#vista-ficha .tarjetas');
    const texto = await page.textContent('#vista-ficha .tarjetas');
    assert.match(texto, /Rocky/);
    assert.match(texto, /Luna/);
  });

  await caso('CA1 · no permite un solo responsable', async () => {
    await page.goto(urlServidor + '#/');
    await registrar(page, { nombre: 'Solo', especie: 'Ave', responsables: ['Ana Única', ''] });
    assert.match(await textoMsg(page, '#msg-paciente'), /Escribe el nombre del responsable|al menos 2 responsables|al menos 2/);
    const d = await datosDb(page);
    assert.equal(d.pacientes.some(p => p.nombre === 'Solo'), false);
  });

  await caso('CA1 · no permite responsables repetidos en la misma mascota', async () => {
    await registrar(page, { nombre: 'Doble', especie: 'Otro', responsables: ['Ana Única', 'ana única'] });
    assert.match(await textoMsg(page, '#msg-paciente'), /ya está en la lista/);
  });

  await caso('No se registra el mismo paciente dos veces con un responsable en común', async () => {
    await registrar(page, { nombre: 'rocky', especie: 'Perro', responsables: ['Tomás Prueba', 'Otra Persona'] });
    assert.match(await textoMsg(page, '#msg-paciente'), /ya existe|Ya existe/i);
    const d = await datosDb(page);
    assert.equal(d.pacientes.filter(p => p.nombre.toLowerCase() === 'rocky').length, 1);
  });

  await caso('Dos mascotas con el mismo nombre pueden coexistir si no comparten responsables', async () => {
    await registrar(page, { nombre: 'Rocky', especie: 'Perro', responsables: ['Familia Otra', 'Vecino Otro'] });
    assert.match(await textoMsg(page, '#msg-paciente'), /registrado/);
  });

  // 6. Persistencia: reiniciar el servidor
  await caso('Persistencia · tras reiniciar el servidor las relaciones siguen', async () => {
    // Mismo contexto (mismo localStorage): solo se cierra el servidor y se levanta otro en el mismo puerto.
    await page.close();
    await new Promise(r => srvActivo.close(r));
    srvActivo = crearServidor();
    await new Promise(r => srvActivo.listen(port, r));
    page = await nuevaPagina(ctx, urlServidor + '#/');
    await page.click('#tabla-pacientes .responsables-celda a:has-text("Sofía Prueba")');
    await page.waitForSelector('#vista-ficha .tarjetas');
    assert.match(await page.textContent('#vista-ficha .tarjetas'), /Luna/);
    await page.goto(urlServidor + '#/mascota/' + (await datosDb(page)).pacientes.find(p => p.nombre === 'Rocky').id);
    await page.waitForSelector('#vista-ficha .chip');
    assert.equal(await page.locator('#vista-ficha .chip').count(), 2);
  });

  // 7. Búsqueda por nombre de mascota y de responsable
  await caso('Búsqueda · filtra por mascota o responsable', async () => {
    await page.goto(urlServidor + '#/');
    await page.fill('#buscar', 'luna');
    assert.equal(await page.locator('#tabla-pacientes tr').count(), 1);
    await page.fill('#buscar', 'tomás');
    assert.equal(await page.locator('#tabla-pacientes tr').count(), 1);
    await page.fill('#buscar', 'zzzz');
    assert.equal(await page.locator('#tabla-pacientes tr').count(), 0);
    assert.match(await page.textContent('#sin-pacientes'), /coincide/);
    await page.fill('#buscar', '');
    assert.equal(await page.locator('#tabla-pacientes tr').count(), 3);
  });

  // 8. Visitas
  await caso('Visitas · registrar y ver historial', async () => {
    const id = (await datosDb(page)).pacientes.find(p => p.nombre === 'Rocky').id;
    await page.selectOption('#v-paciente', id);
    await page.fill('#v-motivo', 'Vacuna');
    await page.click('#form-visita button[type=submit]');
    assert.match(await textoMsg(page, '#msg-visita'), /Visita registrada/);
    assert.match(await page.textContent('#historial'), /Vacuna/);
    await page.goto(urlServidor + '#/mascota/' + id);
    await page.waitForSelector('#vista-ficha .linea-tiempo');
    assert.match(await page.textContent('#vista-ficha .linea-tiempo'), /Vacuna/);
  });

  await caso('Visitas · rechaza fecha futura', async () => {
    await page.goto(urlServidor + '#/');
    await page.selectOption('#v-paciente', { index: 1 });
    await page.fill('#v-fecha', '2999-01-01');
    await page.fill('#v-motivo', 'Futura');
    await page.click('#form-visita button[type=submit]');
    assert.match(await textoMsg(page, '#msg-visita'), /futura/);
  });

  // Ejemplos y no regresiones
  await caso('Datos de ejemplo · cargan y no se duplican', async () => {
    const { ctx: c2, page: p2 } = await abrir(browser, urlServidor + '#/');
    await p2.click('#btn-demo');
    assert.match(await textoMsg(p2, '#msg-paciente'), /Se cargaron 3/);
    await p2.click('#btn-demo');
    assert.match(await textoMsg(p2, '#msg-paciente'), /ya estaban/);
    assert.equal((await datosDb(p2)).responsables.length, 3);
    await c2.close();
  });

  await caso('Migración · datos del Reto 1 pasan al modelo nuevo sin borrar los originales', async () => {
    const { ctx: c3, page: p3 } = await abrir(browser, urlServidor + '#/');
    const v1 = {
      pacientes: [
        { id: 'a1', nombre: 'Firulais', especie: 'Perro', responsable: 'Ana Prueba', creado: 1 },
        { id: 'a2', nombre: 'Michi', especie: 'Gato', responsable: 'ana prueba', creado: 2 },
      ],
      visitas: [{ id: 'v1', pacienteId: 'a1', fecha: '2026-10-01', motivo: 'Vacuna', notas: '', creado: 3 }],
    };
    await p3.evaluate(([k, val]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(val)); }, [KEY_V1, v1]);
    await p3.reload();
    assert.match(await p3.textContent('#aviso'), /migraron/);
    const d = await datosDb(p3);
    assert.equal(d.responsables.length, 1, 'Ana Prueba se agrupa en una sola persona');
    assert.equal(d.vinculos.length, 2);
    assert.equal(d.visitas.length, 1);
    const original = await p3.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY_V1);
    assert.equal(original.pacientes[0].responsable, 'Ana Prueba', 'los datos del Reto 1 no se tocan');
    await p3.click('#tabla-pacientes .responsables-celda a');
    await p3.waitForSelector('#vista-ficha .tarjetas');
    assert.match(await p3.textContent('#vista-ficha .tarjetas'), /Firulais/);
    assert.match(await p3.textContent('#vista-ficha .tarjetas'), /Michi/);
    await c3.close();
  });

  await caso('Sin errores de JavaScript en la página', async () => {
    assert.deepEqual(page.errores, []);
  });

  await caso('Móvil (375px) sin desbordamiento horizontal', async () => {
    const { ctx: c4, page: p4 } = await abrir(browser, urlServidor + '#/', { ancho: 375 });
    await p4.click('#btn-demo');
    const ancho = await p4.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(ancho <= 1, `desbordamiento de ${ancho}px`);
    await p4.screenshot({ path: path.join(EVID, 'escritorio-movil.png'), fullPage: true });
    await c4.close();
  });

  await caso('Escritorio · captura de pantalla de inicio', async () => {
    const { ctx: c5, page: p5 } = await abrir(browser, urlServidor + '#/');
    await p5.click('#btn-demo');
    await p5.screenshot({ path: path.join(EVID, 'inicio-escritorio.png'), fullPage: true });
    await c5.close();
  });

  await browser.close();
  await new Promise(r => srvActivo.close(r));
  console.log(`\nResultado: ${pasaron} pasaron, ${fallos.length} fallaron`);
  process.exitCode = fallos.length ? 1 : 0;
}

main().catch(e => { console.error(e); process.exit(1); });
