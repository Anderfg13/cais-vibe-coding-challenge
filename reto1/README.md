# Reto 1 · Lanzamiento

> Enunciado: "Una clínica veterinaria de barrio necesita una aplicación web para llevar el control de sus pacientes y sus visitas". Solo prompts, sin spec; las funciones mínimas las decidimos nosotros. 25 minutos.

## Qué hace la app

**Veterinaria del Barrio**: app web para que una clínica veterinaria pequeña lleve el control de sus pacientes (mascotas) y sus visitas.

Funciones visibles en pantalla:
1. **Registrar paciente**: nombre, especie y nombre del responsable.
2. **Ver pacientes registrados**: tabla con todos los pacientes y cuántas visitas tiene cada uno.
3. **Registrar visitas y consultar el historial**: fecha, motivo y notas por paciente; el historial se muestra del más reciente al más antiguo.

Extra: el botón "Cargar datos de ejemplo" agrega pacientes y visitas inventados para probar rápido.

## Cómo correrla en 5 minutos

**Opción A: sin instalar nada (la más rápida)**
1. Clona o descarga el repo: `git clone https://github.com/Anderfg13/cais-vibe-coding-challenge.git`
2. Abre `reto1/app/index.html` con doble clic en Chrome, Edge o Firefox.

**Opción B: servida con Node (si tienes Node 18 o superior)**
```bash
cd reto1
npm start            # abre http://localhost:3000
```
`server.js` no tiene dependencias, así que no hace falta `npm install` para esto. Si el puerto 3000 está ocupado, en PowerShell usa `$env:PORT=3001; npm start`.

## Cómo verificarla

### A mano (2 minutos)

| # | Función | Pasos | Resultado esperado |
|---|---------|-------|--------------------|
| 1 | Registrar paciente | Nombre "Rocky", Especie "Perro", Responsable "Pepa Inventada" y pulsa **Registrar paciente** | Aparece el mensaje verde "Paciente "Rocky" registrado." y una fila nueva en la tabla |
| 1b | Validación | Pulsa **Registrar paciente** con algún campo vacío, o repite el mismo paciente | Aparece un mensaje rojo, el campo se marca y no se registra nada |
| 2 | Ver lista | Mira la sección "2. Pacientes registrados" | Rocky aparece en orden alfabético con 0 visitas |
| 3 | Visitas e historial | En "3. Visitas" (Rocky ya queda elegido) escribe el motivo "Vacuna" y pulsa **Registrar visita** | La visita aparece en "Historial de Rocky" y en la tabla sube a 1 visita |
| 3b | Validación | Intenta registrar una visita con fecha de mañana o sin motivo | Aparece un mensaje rojo y no se guarda |
| — | Persistencia | Recarga la página (F5) | Los datos siguen ahí |

### Automática (170 pruebas en un navegador real)
```bash
cd reto1
npm install                 # instala Playwright (solo la primera vez)
npm run test:instalar       # descarga Chromium (solo la primera vez)
npm test
```
La suite (`tests/e2e.js`) corre todo dos veces: con la app abierta como archivo y servida por `server.js`. Cubre:
- las 3 funciones;
- las validaciones: campos vacíos, solo espacios, duplicados con mayúsculas o tildes, longitudes, especie inventada, fechas futuras, imposibles o mal escritas, y paciente inexistente;
- la seguridad: inyección de HTML/JS y lectura de archivos fuera de `app/`;
- la persistencia al recargar y la sincronización entre pestañas;
- datos guardados dañados, almacenamiento bloqueado o lleno;
- la vista en celular.

Al final debe decir `Resultado: 170 pasaron, 0 fallaron`.

## Reglas de negocio

- **Paciente**: nombre (máx. 50), especie de la lista (Perro, Gato, Ave, Conejo, Otro) y responsable (máx. 80). Todos son obligatorios y deben tener al menos una letra o número. Los espacios sobrantes se limpian.
- **No hay duplicados**: no se permite el mismo nombre + especie + responsable, sin importar mayúsculas, tildes ni espacios. Dos "Rocky" sí pueden existir si cambia la especie o el responsable.
- **Visita**: paciente existente, fecha válida entre el 2000-01-01 y hoy (no se aceptan futuras), motivo obligatorio (máx. 100) y notas opcionales (máx. 300).
- **Historial**: de la visita más reciente a la más antigua; si dos visitas tienen la misma fecha, va primero la última registrada.

## Decisiones de alcance (las más sencillas)

- **Sin base de datos**: los datos se guardan en el `localStorage` del navegador. Cada navegador y computador tiene sus propios datos, que no se comparten.
- Si los datos guardados se dañan, la app avisa, guarda una copia de respaldo y empieza vacía. Si el navegador bloquea el almacenamiento, avisa y funciona solo en memoria.
- **Sin frameworks**: es HTML, CSS y JS puro. El servidor es opcional.
- **No se puede editar ni borrar** pacientes ni visitas. Tampoco hay login.
- Solo datos inventados.

## Estructura de esta carpeta

```
reto1/
├── app/              # la aplicación (abrir index.html)
│   ├── index.html    # la pantalla
│   ├── app.js        # la lógica y el guardado en localStorage
│   └── styles.css    # los estilos
├── server.js         # servidor estático opcional (npm start)
├── tests/e2e.js      # pruebas automáticas (npm test)
├── evidencias/       # capturas de pantalla
└── package.json
```

## Prompt usado

> Crea una aplicación web para una clínica veterinaria de barrio que permita llevar el control de sus pacientes y sus visitas.
>
> Elige un alcance pequeño que puedas terminar y ejecutar. La aplicación debe tener una interfaz visible con al menos estas tres funciones:
> 1. Registrar un paciente con nombre, especie y nombre de su responsable.
> 2. Ver la lista de pacientes registrados.
> 3. Registrar una visita para un paciente y consultar su historial de visitas.
>
> Implementa lo necesario para que la app corra de verdad. Al terminar, ejecútala y comprueba que las tres funciones se pueden usar desde la pantalla. Incluye un README.md que explique qué hace la app, cómo ponerla en marcha en menos de cinco minutos y cómo verificar cada función. Si debes tomar decisiones de alcance, elige la opción más sencilla y déjalas anotadas brevemente en el README.

Prompt de seguimiento: "Hazlo servir y que funcione todo, que nunca se equivoque. Prueba todo".
