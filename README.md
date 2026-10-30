# Veterinaria del Barrio

App web para que una **clínica veterinaria de barrio** lleve el control de sus **pacientes (mascotas), sus responsables y sus visitas**.

Repositorio del equipo para los retos de vibe coding de CAIS 2026 (semana 12). Cada reto vive en su propia carpeta; **la versión más reciente es [`reto2/`](reto2/README.md)**.

> Todos los datos son inventados. Nada de lo que aparece corresponde a personas ni mascotas reales.

## Qué hace la app (versión actual: Reto 2)

- **Registrar una mascota** con nombre, especie y **de 2 a 5 responsables**.
- **Responsables compartidos**: una persona puede ser responsable de varias mascotas. Si escribes un nombre que ya existe (sin importar mayúsculas ni tildes), se reutiliza la misma persona y no se duplica.
- **Listado de pacientes** con buscador por nombre de mascota o de responsable.
- **Ficha de mascota**: sus responsables y su historial de visitas.
- **Ficha de responsable**: todas sus mascotas.
- **Visitas**: registrar fecha, motivo y notas, y consultar el historial de cada mascota.
- **Datos de ejemplo**: un botón para probar sin escribir nada.

## Cómo correrla en 5 minutos

No necesitas instalar nada.

1. Descarga el repo: botón verde **Code → Download ZIP** en GitHub y descomprímelo, o
   ```bash
   git clone https://github.com/Anderfg13/cais-vibe-coding-challenge.git
   ```
2. Abre el archivo **`reto2/app/index.html`** con doble clic. Se abre en tu navegador (Chrome, Edge o Firefox).

Eso es todo.

**Opcional, con Node 18 o superior:**
```bash
cd reto2
npm start        # abre http://localhost:3000
```
No hace falta `npm install` para esto. Si el puerto 3000 está ocupado, en PowerShell usa `$env:PORT=3001; npm start`; en Mac o Linux, `PORT=3001 npm start`.

> **Importante:** los datos se guardan en el navegador (`localStorage`). Si abres la app en otro navegador o computador, empieza vacía. Es normal, no es un error.

## Cómo verificarla (3 minutos, a mano)

Con la app abierta, sigue estos pasos en orden:

| # | Haz esto | Debes ver |
|---|----------|-----------|
| 1 | En **1. Registrar paciente**: nombre `Rocky`, especie `Perro`, responsables `Pepa Prueba` y `Tomás Prueba`. Pulsa **Registrar paciente** | Mensaje verde: *Paciente "Rocky" registrado con 2 responsables.* y Rocky en la tabla |
| 2 | En la tabla, pulsa **Rocky** | Su ficha, con Pepa Prueba y Tomás Prueba como responsables |
| 3 | En la ficha, pulsa **Pepa Prueba** | La ficha de Pepa, con Rocky entre sus mascotas |
| 4 | Pulsa **← Volver al listado** y registra `Luna`, `Gato`, con `pepa prueba` (en minúsculas) y `Sofía Prueba` | Se registra. Al abrir la ficha de Pepa aparecen **Rocky y Luna** y Pepa no está duplicada |
| 5 | Escribe `tomás` en el buscador del listado | Solo queda Rocky |
| 6 | En **Visitas**, elige Rocky, escribe un motivo (`Vacuna`) y pulsa **Registrar visita** | La visita aparece en el historial de Rocky |
| 7 | Intenta registrar una mascota con **un solo** responsable | Mensaje rojo y no se registra |
| 8 | Recarga la página (F5) | Todo sigue ahí |

Atajo: el botón **Cargar datos de ejemplo**, al final de la página, llena la app con mascotas y visitas inventadas.

## Verificación automática (opcional)

Cada reto trae pruebas de punta a punta que abren la app en un navegador real (Playwright):

```bash
cd reto2
npm install                 # solo la primera vez
npm run test:instalar       # descarga Chromium, solo la primera vez
npm test                    # debe terminar en: Resultado: 17 pasaron, 0 fallaron
```

## Estructura del repositorio

```
.
├── README.md        # este archivo
├── BITACORA.md      # bitácora del equipo: qué hicimos, qué descubrimos, qué haríamos distinto
├── reto1/           # versión 1: una mascota con un solo responsable
│   ├── app/         #   la app (abrir index.html)
│   ├── README.md    #   cómo correrla y verificarla
│   ├── tests/       #   pruebas automáticas
│   └── evidencias/  #   capturas
└── reto2/           # versión 2 (actual): varios responsables por mascota
    ├── app/         #   la app (abrir index.html)
    ├── README.md    #   detalle, verificación y limitaciones
    ├── product.md   #   historias, modelo de datos, decisiones y criterios de aceptación
    ├── tests/       #   pruebas automáticas
    └── evidencias/  #   capturas
```

| Reto | Carpeta | Tag | Qué se pidió |
|------|---------|-----|--------------|
| 1 · Lanzamiento | [`reto1/`](reto1/README.md) | `reto1` | App mínima: registrar paciente, listarlos y registrar visitas con historial |
| 2 · Cambian las reglas | [`reto2/`](reto2/README.md) | `reto2` | Una mascota puede tener varios responsables y una persona varias mascotas |

## Tecnología

HTML, CSS y JavaScript puro, sin frameworks ni dependencias para usar la app. `server.js` es un servidor estático opcional en Node, también sin dependencias. Playwright solo se usa para las pruebas.

## Limitaciones conocidas

- No se pueden editar ni borrar mascotas, responsables ni visitas.
- Un responsable se identifica solo por su nombre: dos personas distintas con el mismo nombre se tratan como una sola.
- Los datos viven en un navegador y no se comparten entre computadores.
- No hay login ni usuarios.
