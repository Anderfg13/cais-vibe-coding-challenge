// Vethub — lógica de la app (Reto 2: múltiples responsables).
// Los datos se guardan en localStorage del navegador (sin servidor).
'use strict';

const KEY = 'vet-barrio-v2';
const KEY_V1 = 'vet-barrio-v1'; // datos del Reto 1: se leen para migrar, nunca se borran
const ESPECIES = ['Perro', 'Gato', 'Ave', 'Conejo', 'Otro'];
const LIM = { nombre: 50, responsable: 80, motivo: 100, notas: 300 };
const FECHA_MIN = '2000-01-01';
const MIN_RESP = 2;
const MAX_RESP = 5;

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const limpiar = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
const clave = (t) => limpiar(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const tieneLetraONumero = (t) => /[\p{L}\p{N}]/u.test(t);
const ordenPorNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
let contador = 0;
const nuevoId = () => Date.now().toString(36) + (contador++).toString(36) + Math.random().toString(36).slice(2, 6);

function hoyLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function fechaValida(f) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const [a, m, d] = f.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/* ---------- Almacenamiento ----------
 * Modelo v2 (relacional, con IDs):
 *   responsables: [{ id, nombre, creado }]
 *   pacientes:    [{ id, nombre, especie, creado }]
 *   vinculos:     [{ id, pacienteId, responsableId }]   // muchos a muchos
 *   visitas:      [{ id, pacienteId, fecha, motivo, notas, creado }]
 */
const vacia = () => ({ responsables: [], pacientes: [], vinculos: [], visitas: [] });
let storageOk = true;
let db = vacia();

function avisar(texto) {
  const el = $('#aviso');
  el.textContent = texto;
  el.hidden = !texto;
}

function esDbValida(x) {
  return x && Array.isArray(x.responsables) && Array.isArray(x.pacientes) &&
    Array.isArray(x.vinculos) && Array.isArray(x.visitas) &&
    x.responsables.every(r => r && typeof r.id === 'string' && typeof r.nombre === 'string') &&
    x.pacientes.every(p => p && typeof p.id === 'string' && typeof p.nombre === 'string' && typeof p.especie === 'string') &&
    x.vinculos.every(v => v && typeof v.pacienteId === 'string' && typeof v.responsableId === 'string') &&
    x.visitas.every(v => v && typeof v.id === 'string' && typeof v.pacienteId === 'string' &&
      typeof v.fecha === 'string' && typeof v.motivo === 'string');
}

// Convierte el modelo del Reto 1 (un responsable como texto dentro de la mascota) al modelo v2.
// Las personas se agrupan por nombre normalizado para no duplicarlas.
function migrarV1(x) {
  const nuevo = vacia();
  for (const p of x.pacientes) {
    const nombre = limpiar(p.responsable);
    let r = nuevo.responsables.find(r => clave(r.nombre) === clave(nombre));
    if (!r && nombre) {
      r = { id: nuevoId(), nombre, creado: p.creado || Date.now() };
      nuevo.responsables.push(r);
    }
    nuevo.pacientes.push({ id: p.id, nombre: p.nombre, especie: p.especie, creado: p.creado });
    if (r) nuevo.vinculos.push({ id: nuevoId(), pacienteId: p.id, responsableId: r.id });
  }
  nuevo.visitas = x.visitas.map(v => ({ ...v }));
  return nuevo;
}

// Descarta vínculos y visitas que apuntan a registros inexistentes.
function limpiarHuerfanos(x) {
  const pacientes = new Set(x.pacientes.map(p => p.id));
  const responsables = new Set(x.responsables.map(r => r.id));
  x.vinculos = x.vinculos.filter(v => pacientes.has(v.pacienteId) && responsables.has(v.responsableId));
  x.visitas = x.visitas.filter(v => pacientes.has(v.pacienteId));
  return x;
}

const AVISO_DANADO = 'Los datos guardados estaban dañados y no se pudieron leer. Se guardó una copia de respaldo y la app empezó vacía.';

function cargar() {
  let raw, rawV1;
  try {
    raw = localStorage.getItem(KEY);
    rawV1 = raw === null ? localStorage.getItem(KEY_V1) : null;
  } catch {
    storageOk = false;
    avisar('Tu navegador no permite guardar datos: la app funciona, pero se perderá todo al cerrar o recargar la página.');
    return vacia();
  }
  if (raw === null) return rawV1 === null ? vacia() : migrarDesdeV1(rawV1);
  try {
    const x = JSON.parse(raw);
    if (!esDbValida(x)) throw new Error('estructura');
    return limpiarHuerfanos(x);
  } catch {
    try { localStorage.setItem(KEY + '-respaldo-corrupto', raw); } catch { /* sin espacio */ }
    avisar(AVISO_DANADO);
    return vacia();
  }
}

// Primera carga de la versión 2: convierte los datos del Reto 1. KEY_V1 no se toca.
function migrarDesdeV1(rawV1) {
  let x1;
  try {
    x1 = JSON.parse(rawV1);
    if (!Array.isArray(x1?.pacientes) || !Array.isArray(x1?.visitas)) throw new Error('estructura');
  } catch {
    try { localStorage.setItem(KEY_V1 + '-respaldo-corrupto', rawV1); } catch { /* sin espacio */ }
    avisar(AVISO_DANADO);
    return vacia();
  }
  const migrada = migrarV1(x1);
  try { localStorage.setItem(KEY, JSON.stringify(migrada)); } catch { /* se reintenta en la próxima carga */ }
  avisar('Tus datos del Reto 1 se migraron al nuevo modelo. Los originales se conservan intactos.');
  return migrada;
}

// Guarda; si falla, revierte el cambio y devuelve false.
function guardar(copiaAnterior) {
  if (!storageOk) return true;
  try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
  catch {
    db = copiaAnterior;
    return false;
  }
}
const copia = () => JSON.parse(JSON.stringify(db));

/* ---------- Consultas (en ambas direcciones) ---------- */
const responsablesDe = (pid) => db.vinculos
  .filter(v => v.pacienteId === pid)
  .map(v => db.responsables.find(r => r.id === v.responsableId))
  .filter(Boolean)
  .sort(ordenPorNombre);

const mascotasDe = (rid) => db.vinculos
  .filter(v => v.responsableId === rid)
  .map(v => db.pacientes.find(p => p.id === v.pacienteId))
  .filter(Boolean)
  .sort(ordenPorNombre);

const visitasDe = (pid) => db.visitas
  .filter(v => v.pacienteId === pid)
  .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado || 0) - (a.creado || 0));

const responsableExistente = (nombre) => db.responsables.find(r => clave(r.nombre) === clave(nombre));

/* ---------- Reglas de negocio ---------- */
// datos.responsables: textos tal como se escribieron en el formulario (pueden incluir filas vacías opcionales).
function validarPaciente({ nombre, especie, responsables }) {
  const errores = {};
  if (!nombre) errores.nombre = 'El nombre es obligatorio.';
  else if (!tieneLetraONumero(nombre)) errores.nombre = 'El nombre debe tener al menos una letra o número.';
  else if (nombre.length > LIM.nombre) errores.nombre = `El nombre admite máximo ${LIM.nombre} caracteres.`;
  if (!ESPECIES.includes(especie)) errores.especie = 'Elige una especie de la lista.';

  const vistos = new Set();
  responsables.forEach((r, i) => {
    if (!r) {
      if (i < MIN_RESP) errores[`resp-${i}`] = 'Escribe el nombre del responsable.';
      return;
    }
    if (!tieneLetraONumero(r)) errores[`resp-${i}`] = 'Debe tener al menos una letra o número.';
    else if (r.length > LIM.responsable) errores[`resp-${i}`] = `Admite máximo ${LIM.responsable} caracteres.`;
    else if (vistos.has(clave(r))) errores[`resp-${i}`] = 'Ese responsable ya está en la lista.';
    vistos.add(clave(r));
  });
  const nombres = responsables.filter(Boolean);
  if (!Object.keys(errores).some(k => k.startsWith('resp-')) && nombres.length < MIN_RESP)
    errores.responsables = `Agrega al menos ${MIN_RESP} responsables.`;

  // Duplicado: mismo nombre y especie, y con al menos un responsable en común.
  if (!Object.keys(errores).length) {
    const idsExistentes = new Set(nombres.map(n => responsableExistente(n)?.id).filter(Boolean));
    const duplicada = db.pacientes.some(p => clave(p.nombre) === clave(nombre) && p.especie === especie &&
      db.vinculos.some(v => v.pacienteId === p.id && idsExistentes.has(v.responsableId)));
    if (duplicada) errores.nombre = `Ya existe ${nombre} (${especie}) con un responsable en común.`;
  }
  return errores;
}

function validarVisita({ pacienteId, fecha, motivo, notas }) {
  const errores = {};
  if (!db.pacientes.some(p => p.id === pacienteId)) errores.paciente = 'Elige un paciente registrado.';
  if (!fecha) errores.fecha = 'La fecha es obligatoria.';
  else if (!fechaValida(fecha)) errores.fecha = 'La fecha no es válida.';
  else if (fecha > hoyLocal()) errores.fecha = 'La fecha no puede ser futura.';
  else if (fecha < FECHA_MIN) errores.fecha = 'La fecha no puede ser anterior al año 2000.';
  if (!motivo) errores.motivo = 'El motivo es obligatorio.';
  else if (!tieneLetraONumero(motivo)) errores.motivo = 'El motivo debe tener al menos una letra o número.';
  else if (motivo.length > LIM.motivo) errores.motivo = `El motivo admite máximo ${LIM.motivo} caracteres.`;
  if (notas.length > LIM.notas) errores.notas = `Las notas admiten máximo ${LIM.notas} caracteres.`;
  return errores;
}

// Reutiliza la persona si ya existe (misma clave normalizada); si no, la crea. Así no se duplican responsables.
function resolverResponsable(nombre) {
  const existente = responsableExistente(nombre);
  if (existente) return existente.id;
  const r = { id: nuevoId(), nombre, creado: Date.now() };
  db.responsables.push(r);
  return r.id;
}

function agregarPaciente(datos) {
  const antes = copia();
  const p = { id: nuevoId(), creado: Date.now(), nombre: datos.nombre, especie: datos.especie };
  const ids = datos.responsables.filter(Boolean).map(resolverResponsable);
  db.pacientes.push(p);
  for (const responsableId of [...new Set(ids)]) db.vinculos.push({ id: nuevoId(), pacienteId: p.id, responsableId });
  return guardar(antes) ? p : null;
}

function agregarVisita(datos) {
  const antes = copia();
  const v = { id: nuevoId(), creado: Date.now(), ...datos };
  db.visitas.push(v);
  return guardar(antes) ? v : null;
}

/* ---------- Interfaz ---------- */
function msg(el, texto, error = false) {
  el.textContent = texto;
  el.classList.toggle('error', error);
}

function marcar(campos, errores) {
  for (const [k, sel] of Object.entries(campos)) $(sel).setAttribute('aria-invalid', errores[k] ? 'true' : 'false');
}

const iniciales = (texto) => limpiar(texto).split(' ').slice(0, 2).map(p => p[0] || '').join('').toUpperCase();
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/* Formulario de paciente: filas de responsables dinámicas */
function leerFilas() {
  return [...document.querySelectorAll('.resp-input')].map(i => i.value);
}

function dibujarFilas(valores) {
  const n = Math.min(MAX_RESP, Math.max(MIN_RESP, valores.length));
  $('#resp-lista').innerHTML = Array.from({ length: n }, (_, i) => {
    const quitar = i >= MIN_RESP
      ? `<button type="button" class="quitar" data-quitar="${i}" aria-label="Quitar responsable ${i + 1}">Quitar</button>` : '';
    return `<div class="fila-resp">
      <input class="resp-input" data-i="${i}" list="lista-responsables" maxlength="${LIM.responsable}"
        autocomplete="off" placeholder="${i < MIN_RESP ? 'Nombre del responsable' : 'Otro responsable (opcional)'}"
        aria-label="Responsable ${i + 1}" value="${esc(valores[i] ?? '')}">${quitar}
    </div>`;
  }).join('');
  $('#btn-add-resp').hidden = n >= MAX_RESP;
}

function renderDatalist() {
  $('#lista-responsables').innerHTML = [...db.responsables].sort(ordenPorNombre)
    .map(r => `<option value="${esc(r.nombre)}"></option>`).join('');
}

function pacientesFiltrados() {
  const q = clave($('#buscar').value);
  const todos = [...db.pacientes].sort(ordenPorNombre);
  if (!q) return todos;
  return todos.filter(p => clave(p.nombre).includes(q) ||
    responsablesDe(p.id).some(r => clave(r.nombre).includes(q)));
}

function render() {
  renderDatalist();
  const lista = pacientesFiltrados();
  $('#tabla-pacientes').innerHTML = lista.map(p => {
    const n = visitasDe(p.id).length;
    const resp = responsablesDe(p.id).map(r =>
      `<a href="#/responsable/${esc(r.id)}">${esc(r.nombre)}</a>`).join(', ');
    return `<tr>
      <td data-label="Mascota"><a class="nombre" href="#/mascota/${esc(p.id)}">${esc(p.nombre)}</a></td>
      <td data-label="Especie">${esc(p.especie)}</td>
      <td class="responsables-celda" data-label="Responsables">${resp || '<span class="vacio">Sin responsables</span>'}</td>
      <td class="num" data-label="Visitas">${n}</td>
      <td class="acciones"><button type="button" class="link" data-ver="${esc(p.id)}">Ver historial</button></td>
    </tr>`;
  }).join('');
  const mensaje = !db.pacientes.length ? 'Aún no hay pacientes.'
    : !lista.length ? 'Ningún paciente coincide con la búsqueda.' : '';
  $('#sin-pacientes').textContent = mensaje;
  $('#sin-pacientes').hidden = !mensaje;

  const sel = $('#v-paciente');
  const actual = sel.value;
  sel.innerHTML = '<option value="">Elige…</option>' + [...db.pacientes].sort(ordenPorNombre).map(p =>
    `<option value="${esc(p.id)}">${esc(p.nombre)} (${esc(p.especie)}) — ${esc(responsablesDe(p.id).map(r => r.nombre).join(', '))}</option>`).join('');
  sel.value = db.pacientes.some(p => p.id === actual) ? actual : '';
  renderHistorial();
  renderRuta();
}

function renderHistorial() {
  const pid = $('#v-paciente').value;
  const p = db.pacientes.find(x => x.id === pid);
  const ul = $('#historial');
  if (!p) {
    $('#titulo-historial').textContent = 'Historial';
    ul.innerHTML = '<li class="vacio">Elige un paciente para ver su historial.</li>';
    return;
  }
  $('#titulo-historial').textContent = `Historial de ${p.nombre}`;
  const vs = visitasDe(pid);
  ul.innerHTML = vs.length
    ? vs.map(v => `<li><strong>${esc(v.fecha)}</strong> — ${esc(v.motivo)}${v.notas ? ` <em>(${esc(v.notas)})</em>` : ''}</li>`).join('')
    : '<li class="vacio">Sin visitas registradas.</li>';
}

/* ---------- Fichas (rutas por hash) ---------- */
function ruta() {
  const h = location.hash;
  let m = h.match(/^#\/mascota\/([\w-]+)$/);
  if (m) return { vista: 'mascota', id: m[1] };
  m = h.match(/^#\/responsable\/([\w-]+)$/);
  if (m) return { vista: 'responsable', id: m[1] };
  return { vista: 'inicio' };
}

function renderRuta() {
  const r = ruta();
  $('#vista-inicio').hidden = r.vista !== 'inicio';
  $('#vista-ficha').hidden = r.vista === 'inicio';
  if (r.vista === 'mascota') return fichaMascota(r.id);
  if (r.vista === 'responsable') return fichaResponsable(r.id);
}

const noEncontrada = () => `<a class="volver" href="#/">← Volver al listado</a>
  <div class="card"><p class="vacio">No encontramos esa ficha. Quizá fue registrada en otro navegador.</p></div>`;

function fichaMascota(id) {
  const p = db.pacientes.find(x => x.id === id);
  if (!p) return ($('#vista-ficha').innerHTML = noEncontrada());
  const rs = responsablesDe(id);
  const vs = visitasDe(id);
  $('#vista-ficha').innerHTML = `
    <a class="volver" href="#/">← Volver al listado</a>
    <article class="card ficha">
      <header class="ficha-cab">
        <span class="avatar avatar-mascota" aria-hidden="true">🐾</span>
        <div>
          <p class="etiqueta">${esc(p.especie)}</p>
          <h2>${esc(p.nombre)}</h2>
          <p class="resumen">${plural(rs.length, 'responsable', 'responsables')} · ${plural(vs.length, 'visita', 'visitas')}</p>
        </div>
      </header>
      <section class="bloque">
        <h3>Responsables</h3>
        <ul class="chips">${rs.map(r => `
          <li><a class="chip" href="#/responsable/${esc(r.id)}">
            <span class="iniciales" aria-hidden="true">${esc(iniciales(r.nombre))}</span>${esc(r.nombre)}
          </a></li>`).join('') || '<li class="vacio">Sin responsables asociados.</li>'}</ul>
      </section>
      <section class="bloque">
        <h3>Historial de visitas</h3>
        <ul class="linea-tiempo">${vs.map(v => `
          <li><strong>${esc(v.fecha)}</strong> — ${esc(v.motivo)}${v.notas ? ` <em>(${esc(v.notas)})</em>` : ''}</li>`).join('')
          || '<li class="vacio">Sin visitas registradas.</li>'}</ul>
      </section>
    </article>`;
}

function fichaResponsable(id) {
  const r = db.responsables.find(x => x.id === id);
  if (!r) return ($('#vista-ficha').innerHTML = noEncontrada());
  const ms = mascotasDe(id);
  $('#vista-ficha').innerHTML = `
    <a class="volver" href="#/">← Volver al listado</a>
    <article class="card ficha">
      <header class="ficha-cab">
        <span class="avatar" aria-hidden="true">${esc(iniciales(r.nombre))}</span>
        <div>
          <p class="etiqueta">Responsable</p>
          <h2>${esc(r.nombre)}</h2>
          <p class="resumen">${plural(ms.length, 'mascota asociada', 'mascotas asociadas')}</p>
        </div>
      </header>
      <section class="bloque">
        <h3>Mascotas</h3>
        <ul class="tarjetas">${ms.map(p => {
          const otros = responsablesDe(p.id).filter(x => x.id !== id);
          return `<li><a href="#/mascota/${esc(p.id)}">
            <strong>${esc(p.nombre)}</strong> <span class="etiqueta">${esc(p.especie)}</span>
            <span class="con">${otros.length ? 'Con ' + otros.map(x => esc(x.nombre)).join(', ') : 'Único responsable'}</span>
          </a></li>`;
        }).join('') || '<li class="vacio">Sin mascotas asociadas.</li>'}</ul>
      </section>
    </article>`;
}

/* ---------- Eventos ---------- */
$('#btn-add-resp').addEventListener('click', () => {
  const valores = leerFilas();
  valores.push('');
  dibujarFilas(valores);
  document.querySelectorAll('.resp-input')[valores.length - 1]?.focus();
});

$('#resp-lista').addEventListener('click', e => {
  const btn = e.target.closest('[data-quitar]');
  if (!btn) return;
  const valores = leerFilas();
  valores.splice(Number(btn.dataset.quitar), 1);
  dibujarFilas(valores);
});

$('#form-paciente').addEventListener('submit', e => {
  e.preventDefault();
  const datos = {
    nombre: limpiar($('#p-nombre').value),
    especie: $('#p-especie').value,
    responsables: leerFilas().map(limpiar),
  };
  const errores = validarPaciente(datos);
  marcar({ nombre: '#p-nombre', especie: '#p-especie' }, errores);
  document.querySelectorAll('.resp-input').forEach(inp =>
    inp.setAttribute('aria-invalid', errores[`resp-${inp.dataset.i}`] ? 'true' : 'false'));
  if (Object.keys(errores).length) return msg($('#msg-paciente'), Object.values(errores).join(' '), true);
  const p = agregarPaciente(datos);
  if (!p) return msg($('#msg-paciente'), 'No se pudo guardar (almacenamiento lleno o bloqueado). Intenta de nuevo.', true);
  e.target.reset();
  dibujarFilas([]);
  render();
  $('#v-paciente').value = p.id; // queda listo para registrarle una visita
  renderHistorial();
  const n = responsablesDe(p.id).length;
  msg($('#msg-paciente'), `Paciente "${p.nombre}" registrado con ${plural(n, 'responsable', 'responsables')}.`);
  $('#p-nombre').focus();
});

$('#form-visita').addEventListener('submit', e => {
  e.preventDefault();
  const datos = {
    pacienteId: $('#v-paciente').value,
    fecha: $('#v-fecha').value,
    motivo: limpiar($('#v-motivo').value),
    notas: limpiar($('#v-notas').value),
  };
  const errores = validarVisita(datos);
  marcar({ paciente: '#v-paciente', fecha: '#v-fecha', motivo: '#v-motivo', notas: '#v-notas' }, errores);
  if (Object.keys(errores).length) return msg($('#msg-visita'), Object.values(errores).join(' '), true);
  if (!agregarVisita(datos)) return msg($('#msg-visita'), 'No se pudo guardar (almacenamiento lleno o bloqueado). Intenta de nuevo.', true);
  render();
  $('#v-motivo').value = '';
  $('#v-notas').value = '';
  const p = db.pacientes.find(x => x.id === datos.pacienteId);
  msg($('#msg-visita'), `Visita registrada para ${p.nombre}.`);
});

$('#v-paciente').addEventListener('change', () => { msg($('#msg-visita'), ''); renderHistorial(); });
$('#buscar').addEventListener('input', render);

$('#tabla-pacientes').addEventListener('click', e => {
  const btn = e.target.closest('[data-ver]');
  if (!btn) return;
  $('#v-paciente').value = btn.dataset.ver;
  renderHistorial();
  $('#form-visita').scrollIntoView({ behavior: 'smooth' });
});

$('#btn-demo').addEventListener('click', () => {
  // Datos inventados. Si ya están cargados, no se duplican.
  const ejemplos = [
    { nombre: 'Firulais', especie: 'Perro', responsables: ['Ana Prueba', 'Luis Ficticio'],
      visitas: [{ fecha: '2026-10-01', motivo: 'Vacuna anual', notas: '' }, { fecha: '2026-10-20', motivo: 'Control', notas: 'Todo bien' }] },
    { nombre: 'Michi', especie: 'Gato', responsables: ['Luis Ficticio', 'Marta Demo'], visitas: [] },
    { nombre: 'Canela', especie: 'Conejo', responsables: ['Ana Prueba', 'Marta Demo'], visitas: [] },
  ];
  const antes = copia();
  let agregados = 0;
  for (const ej of ejemplos) {
    if (Object.keys(validarPaciente(ej)).length) continue;
    const p = { id: nuevoId(), creado: Date.now(), nombre: ej.nombre, especie: ej.especie };
    for (const rid of ej.responsables.map(resolverResponsable))
      db.vinculos.push({ id: nuevoId(), pacienteId: p.id, responsableId: rid });
    db.pacientes.push(p);
    for (const v of ej.visitas) db.visitas.push({ id: nuevoId(), creado: Date.now(), pacienteId: p.id, ...v });
    agregados++;
  }
  if (!agregados) return msg($('#msg-paciente'), 'Los datos de ejemplo ya estaban cargados.');
  if (!guardar(antes)) return msg($('#msg-paciente'), 'No se pudo guardar (almacenamiento lleno o bloqueado).', true);
  render();
  msg($('#msg-paciente'), `Se cargaron ${agregados} pacientes de ejemplo.`);
});

window.addEventListener('hashchange', () => { renderRuta(); window.scrollTo(0, 0); });

// Si la app está abierta en otra pestaña y cambian los datos, se actualiza.
window.addEventListener('storage', e => {
  if (e.key === KEY) { db = cargar(); render(); }
});

/* ---------- Inicio ---------- */
db = cargar();
$('#v-fecha').value = hoyLocal();
$('#v-fecha').max = hoyLocal();
$('#v-fecha').min = FECHA_MIN;
dibujarFilas([]);
render();
