# Reto 2 · Múltiples responsables

> Enunciado: "CAIS 2026 — Reto 2: cambian las reglas". La clínica descubrió que una mascota puede tener más de un responsable, y que una persona puede serlo de varias mascotas. Ver [`product.md`](product.md) para historias, modelo de datos y criterios de aceptación.

## Qué cambia respecto al Reto 1

- **Una mascota tiene de 2 a 5 responsables** (antes, uno solo). Al registrarla se pueden escribir al menos dos.
- **Cada responsable es una persona independiente** que se vincula a sus mascotas. Si escribes el nombre de alguien que ya existe (sin importar mayúsculas ni tildes), se reutiliza su misma ficha y no se crea un duplicado.
- **Ficha de mascota**: muestra todos sus responsables (cada uno enlaza a su ficha) y su historial de visitas.
- **Ficha de responsable**: muestra sus datos y todas sus mascotas, con los demás responsables de cada una. Cada mascota enlaza a su ficha.
- **Listado de pacientes**: ahora muestra la columna *Responsables* y tiene un buscador por nombre de mascota o de responsable.
- **Datos del Reto 1**: se migran automáticamente la primera vez que abres esta versión. Los datos originales se conservan intactos.

## Cómo correrla

**Opción A: sin instalar nada.** Abre `reto2/app/index.html` con doble clic.

**Opción B: con Node 18 o superior.**
```bash
cd reto2
npm start            # abre http://localhost:3000
```
`server.js` no tiene dependencias. Si el puerto 3000 está ocupado, en PowerShell usa `$env:PORT=3001; npm start`.

> Los datos se guardan en el `localStorage` del navegador. Cada navegador tiene los suyos; por eso la misma app abierta en otro navegador empieza vacía.

## Cómo registrar una mascota con varios responsables

1. En **1. Registrar paciente**, escribe el nombre y elige la especie.
2. En **Responsables**, escribe al menos dos nombres. Para una tercera o cuarta persona, pulsa **+ Añadir otro responsable** (máximo 5).
3. Si el responsable ya existe, escríbelo igual: la app lo reconoce y lo vincula a su ficha. El campo ofrece sugerencias de los responsables ya registrados.
4. Pulsa **Registrar paciente**. El mensaje confirma cuántos responsables quedaron asociados.

No se permite: un solo responsable, el mismo responsable dos veces en la misma mascota, ni una mascota con el mismo nombre y especie que otra si comparten algún responsable.

## Cómo consultar responsables y sus mascotas

- En el **listado de pacientes**, pulsa el nombre de una mascota para abrir su ficha, o el nombre de un responsable para abrir la suya.
- Desde la **ficha de mascota**, pulsa cualquier responsable para ver todas sus mascotas.
- Desde la **ficha de responsable**, pulsa cualquier mascota para ver su ficha.
- Usa **← Volver al listado** para regresar.

## Cómo verificarla

### A mano (3 minutos)

| # | Pasos | Resultado esperado |
|---|-------|--------------------|
| 1 | Registra "Rocky", Perro, con "Pepa Prueba" y "Tomás Prueba" | Mensaje "Paciente "Rocky" registrado con 2 responsables." |
| 2 | Pulsa "Rocky" en la tabla | La ficha muestra Pepa Prueba y Tomás Prueba |
| 3 | Pulsa "Pepa Prueba" en la ficha | Su ficha muestra Rocky |
| 4 | Registra "Luna", Gato, con "pepa prueba" y "Sofía Prueba" | Pepa no aparece duplicada; en su ficha aparecen Rocky y Luna |
| 5 | Abre la ficha de Rocky | Sigue mostrando Pepa, Tomás y no cambió nada |
| 6 | Recarga la página (F5) | Todo sigue ahí |
| 7 | Escribe "luna" en el buscador | Solo queda Luna; escribe "tomás" y queda Rocky |
| 8 | Registra una visita para Rocky | Aparece en el historial de la ficha de Rocky |
| 9 | Intenta registrar una mascota con un solo responsable | Mensaje rojo: se piden al menos 2 |

### Automática (17 pruebas en un navegador real)

```bash
cd reto2
npm install                 # instala Playwright (solo la primera vez)
npm run test:instalar       # descarga Chromium (solo la primera vez)
npm test
```

La suite (`tests/e2e.js`) cubre los criterios CA1 a CA3, la no duplicación de responsables, el reinicio del servidor, la búsqueda, las visitas, los datos de ejemplo, la migración desde el Reto 1 y la vista en móvil. Al final debe decir `Resultado: 17 pasaron, 0 fallaron`.

## Decisiones de arquitectura

Se detallan en [`product.md`](product.md#decisiones). Resumen:

- **Modelo relacional en localStorage**: entidades `responsables`, `pacientes`, `vinculos` (muchos a muchos) y `visitas`, enlazadas por ID. Se consulta en ambas direcciones.
- **Identidad del responsable = nombre normalizado** (sin mayúsculas, tildes ni espacios sobrantes). Consecuencia: dos personas distintas con el mismo nombre se tratarían como una sola.
- **Clave nueva `vet-barrio-v2`**; la del Reto 1 (`vet-barrio-v1`) se lee una vez para migrar y no se modifica ni se borra.
- **Sin frameworks ni dependencias de runtime**: HTML, CSS y JS puro, como en el Reto 1.

## Estructura de esta carpeta

```
reto2/
├── app/
│   ├── index.html    # pantallas: inicio, fichas (se muestran por hash)
│   ├── app.js        # modelo, migración, reglas, render y rutas
│   └── styles.css    # estilos
├── server.js         # servidor estático opcional (npm start)
├── tests/e2e.js      # pruebas automáticas (npm test)
├── evidencias/       # capturas reales de la app
├── product.md        # producto, historias, modelo, decisiones y criterios
└── package.json
```

## Limitaciones conocidas

- Sin edición ni borrado de pacientes, responsables ni visitas (igual que en el Reto 1).
- Un responsable se identifica solo por su nombre; no hay teléfono ni documento para distinguir homónimos.
- Los datos viven en un navegador; no se comparten entre equipos.
- No hay autenticación.
- Solo datos inventados.
