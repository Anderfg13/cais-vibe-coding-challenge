// Veterinaria del Barrio — lógica de la app.
// Los datos se guardan en localStorage del navegador (sin servidor).
'use strict';

const KEY = 'vet-barrio-v1';
const ESPECIES = ['Perro', 'Gato', 'Ave', 'Conejo', 'Otro'];
const LIM = { nombre: 50, responsable: 80, motivo: 100, notas: 300 };
const FECHA_MIN = '2000-01-01';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const limpiar = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
const clave = (t) => limpiar(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const tieneLetraONumero = (t) => /[\p{L}\p{N}]/u.test(t);
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

/* ---------- Almacenamiento ---------- */
let storageOk = true;
let db = { pacientes: [], visitas: [] };

function avisar(texto) {
  const el = $('#aviso');
  el.textContent = texto;
  el.hidden = !texto;
}

function esDbValida(x) {
  return x && Array.isArray(x.pacientes) && Array.isArray(x.visitas) &&
    x.pacientes.every(p => p && typeof p.id === 'string' && typeof p.nombre === 'string' &&
      typeof p.especie === 'string' && typeof p.responsable === 'string') &&
    x.visitas.every(v => v && typeof v.id === 'string' && typeof v.pacienteId === 'string' &&
      typeof v.fecha === 'string' && typeof v.motivo === 'string');
}

function cargar() {
  let raw;
  try { raw = localStorage.getItem(KEY); }
  catch {
    storageOk = false;
    avisar('Tu navegador no permite guardar datos: la app funciona, pero se perderá todo al cerrar o recargar la página.');
    return { pacientes: [], visitas: [] };
  }
  if (raw === null) return { pacientes: [], visitas: [] };
  try {
    const x = JSON.parse(raw);
    if (!esDbValida(x)) throw new Error('estructura');
    // Visitas huérfanas (paciente inexistente) se descartan.
    const ids = new Set(x.pacientes.map(p => p.id));
    x.visitas = x.visitas.filter(v => ids.has(v.pacienteId));
    return { pacientes: x.pacientes, visitas: x.visitas };
  } catch {
    try { localStorage.setItem(KEY + '-respaldo-corrupto', raw); } catch { /* sin espacio */ }
    avisar('Los datos guardados estaban dañados y no se pudieron leer. Se guardó una copia de respaldo y la app empezó vacía.');
    return { pacientes: [], visitas: [] };
  }
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

/* ---------- Reglas de negocio ---------- */
function validarPaciente({ nombre, especie, responsable }) {
  const errores = {};
  if (!nombre) errores.nombre = 'El nombre es obligatorio.';
  else if (!tieneLetraONumero(nombre)) errores.nombre = 'El nombre debe tener al menos una letra o número.';
  else if (nombre.length > LIM.nombre) errores.nombre = `El nombre admite máximo ${LIM.nombre} caracteres.`;
  if (!ESPECIES.includes(especie)) errores.especie = 'Elige una especie de la lista.';
  if (!responsable) errores.responsable = 'El responsable es obligatorio.';
  else if (!tieneLetraONumero(responsable)) errores.responsable = 'El responsable debe tener al menos una letra o número.';
  else if (responsable.length > LIM.responsable) errores.responsable = `El responsable admite máximo ${LIM.responsable} caracteres.`;
  if (!Object.keys(errores).length && db.pacientes.some(p =>
    clave(p.nombre) === clave(nombre) && p.especie === especie && clave(p.responsable) === clave(responsable)))
    errores.nombre = `Ya existe ${nombre} (${especie}) con el responsable ${responsable}.`;
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

function agregarPaciente(datos) {
  const antes = copia();
  const p = { id: nuevoId(), creado: Date.now(), ...datos };
  db.pacientes.push(p);
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

function render() {
  const pacientes = [...db.pacientes].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  $('#tabla-pacientes').innerHTML = pacientes.map(p => {
    const n = db.visitas.filter(v => v.pacienteId === p.id).length;
    return `<tr><td>${esc(p.nombre)}</td><td>${esc(p.especie)}</td><td>${esc(p.responsable)}</td>
      <td>${n}</td><td><button type="button" class="link" data-ver="${esc(p.id)}">Ver historial</button></td></tr>`;
  }).join('');
  $('#sin-pacientes').hidden = pacientes.length > 0;

  const sel = $('#v-paciente');
  const actual = sel.value;
  sel.innerHTML = '<option value="">Elige…</option>' + pacientes.map(p =>
    `<option value="${esc(p.id)}">${esc(p.nombre)} (${esc(p.especie)}) — ${esc(p.responsable)}</option>`).join('');
  sel.value = db.pacientes.some(p => p.id === actual) ? actual : '';
  renderHistorial();
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
  const vs = db.visitas.filter(v => v.pacienteId === pid)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado || 0) - (a.creado || 0));
  ul.innerHTML = vs.length
    ? vs.map(v => `<li><strong>${esc(v.fecha)}</strong> — ${esc(v.motivo)}${v.notas ? ` <em>(${esc(v.notas)})</em>` : ''}</li>`).join('')
    : '<li class="vacio">Sin visitas registradas.</li>';
}

$('#form-paciente').addEventListener('submit', e => {
  e.preventDefault();
  const datos = {
    nombre: limpiar($('#p-nombre').value),
    especie: $('#p-especie').value,
    responsable: limpiar($('#p-responsable').value),
  };
  const errores = validarPaciente(datos);
  marcar({ nombre: '#p-nombre', especie: '#p-especie', responsable: '#p-responsable' }, errores);
  if (Object.keys(errores).length) return msg($('#msg-paciente'), Object.values(errores).join(' '), true);
  const p = agregarPaciente(datos);
  if (!p) return msg($('#msg-paciente'), 'No se pudo guardar (almacenamiento lleno o bloqueado). Intenta de nuevo.', true);
  e.target.reset();
  render();
  $('#v-paciente').value = p.id; // queda listo para registrarle una visita
  renderHistorial();
  msg($('#msg-paciente'), `Paciente "${p.nombre}" registrado.`);
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
    { nombre: 'Firulais', especie: 'Perro', responsable: 'Ana Prueba',
      visitas: [{ fecha: '2026-10-01', motivo: 'Vacuna anual', notas: '' }, { fecha: '2026-10-20', motivo: 'Control', notas: 'Todo bien' }] },
    { nombre: 'Michi', especie: 'Gato', responsable: 'Luis Ficticio', visitas: [] },
  ];
  const antes = copia();
  let agregados = 0;
  for (const ej of ejemplos) {
    if (Object.keys(validarPaciente(ej)).length) continue;
    const p = { id: nuevoId(), creado: Date.now(), nombre: ej.nombre, especie: ej.especie, responsable: ej.responsable };
    db.pacientes.push(p);
    for (const v of ej.visitas) db.visitas.push({ id: nuevoId(), creado: Date.now(), pacienteId: p.id, ...v });
    agregados++;
  }
  if (!agregados) return msg($('#msg-paciente'), 'Los datos de ejemplo ya estaban cargados.');
  if (!guardar(antes)) return msg($('#msg-paciente'), 'No se pudo guardar (almacenamiento lleno o bloqueado).', true);
  render();
  msg($('#msg-paciente'), `Se cargaron ${agregados} pacientes de ejemplo.`);
});

// Si la app está abierta en otra pestaña y cambian los datos, se actualiza.
window.addEventListener('storage', e => {
  if (e.key === KEY) { db = cargar(); render(); }
});

/* ---------- Inicio ---------- */
db = cargar();
$('#v-fecha').value = hoyLocal();
$('#v-fecha').max = hoyLocal();
$('#v-fecha').min = FECHA_MIN;
render();
