# Vethub · Producto (Reto 2)

## Visión

App web para que una clínica veterinaria de barrio lleve el control de sus pacientes (mascotas), de las personas responsables de cada una y de sus visitas. Sin backend ni dependencias: HTML, CSS y JS puro con persistencia en el navegador.

## Usuarios y contexto

- **Recepción de la clínica**: registra mascotas y visitas, y busca a un paciente por nombre o por la persona que lo trae.
- Uso en mostrador, en computador o en celular.

## Historias de usuario

### Reto 1 (vigentes)
- Como recepcionista, quiero registrar una mascota con su especie y su responsable, para tener el paciente en el sistema.
- Como recepcionista, quiero ver la lista de pacientes, para saber quién está registrado.
- Como recepcionista, quiero registrar una visita y consultar el historial de una mascota, para llevar su control médico.

### Reto 2 (nuevas)
- **H1.** Como recepcionista, quiero registrar una mascota con al menos dos responsables, porque en una familia la mascota suele tener a ambos padres.
- **H2.** Como recepcionista, quiero abrir la ficha de una mascota y ver todos sus responsables, para saber a quién llamar.
- **H3.** Como recepcionista, quiero abrir la ficha de un responsable y ver todas sus mascotas, porque una misma persona puede tener varias.
- **H4.** Como recepcionista, quiero asociar a una persona que ya está registrada a una nueva mascota sin volver a escribir sus datos ni crear un duplicado.
- **H5.** Como recepcionista, quiero buscar pacientes por el nombre de un responsable, para encontrar a la mascota cuando solo recuerdo a la persona.
- **H6.** Como recepcionista, quiero que los datos del Reto 1 sigan funcionando, sin perder pacientes ni visitas.

## Modelo de datos

Persistencia en `localStorage`, clave `vet-barrio-v2`:

```
responsables: [{ id, nombre, creado }]
pacientes:    [{ id, nombre, especie, creado }]
vinculos:     [{ id, pacienteId, responsableId }]     // relación muchos a muchos
visitas:      [{ id, pacienteId, fecha, motivo, notas, creado }]
```

Consultas:
- Responsables de una mascota: `vinculos` filtrados por `pacienteId`.
- Mascotas de un responsable: `vinculos` filtrados por `responsableId`.

Cambios respecto al modelo del Reto 1:
- Antes, `pacientes[].responsable` era un texto. Ahora ese dato vive en `responsables` y en `vinculos`.
- Se agregan `responsables` y `vinculos`.
- Las visitas no cambian.

### Migración desde el Reto 1
Al cargar por primera vez sin datos en `vet-barrio-v2`, si existe `vet-barrio-v1`:
1. Cada paciente se vincula a un responsable cuyo nombre normalizado coincide con el texto anterior. Si no existe, se crea.
2. Las visitas se copian tal cual.
3. Se guarda `vet-barrio-v2`. **`vet-barrio-v1` no se modifica ni se borra.**

Si `vet-barrio-v2` ya existe, la migración no se repite.

## Decisiones

| # | Decisión | Alternativas descartadas | Consecuencias |
|---|----------|--------------------------|---------------|
| D1 | Entidad `responsables` independiente y tabla de vínculos | Guardar un arreglo de nombres dentro de cada mascota | Cada persona existe una sola vez; las consultas van en ambas direcciones. Más código de enlace. |
| D2 | Identidad del responsable = nombre normalizado (minúsculas, sin tildes, espacios colapsados) | ID manual, teléfono, documento | Evita duplicados por escritura. Dos personas distintas con el mismo nombre se fusionan. Se mitiga con la lista de sugerencias al escribir. |
| D3 | Entre 2 y 5 responsables por mascota en el registro | Mínimo 2 sin máximo | Cumple H1 y mantiene el formulario simple. Un máximo de 5 cubre familias típicas. |
| D4 | Duplicado de mascota = mismo nombre, misma especie y al menos un responsable en común | Mismo conjunto exacto de responsables | Bloquea registros accidentales sin impedir homónimos de familias distintas. |
| D5 | Clave nueva `vet-barrio-v2` con migración desde `v1` | Reemplazar `v1` en el mismo key | Los datos antiguos siguen intactos como respaldo; la migración corre una sola vez. |
| D6 | Fichas con rutas por hash (`#/mascota/ID`, `#/responsable/ID`) en la misma página | Páginas HTML separadas, o un framework | Sin dependencias y sin cambiar el servidor. Recargar en una ficha la abre directamente. |
| D7 | Buscador en el listado (nombre de mascota o de responsable) | No agregar búsqueda | H5 y el criterio de no regresión lo piden. Filtro en memoria sobre la lista. |
| D8 | Sin edición ni borrado de responsables | CRUD completo | Fuera de alcance; el Reto 1 tampoco lo tiene. |

## Criterios de aceptación del Reto 2

| ID | Criterio | Estado | Cómo se verifica |
|----|----------|--------|------------------|
| CA1 | Al registrar una mascota se pueden asociar al menos dos responsables | **Cumplido** | Prueba automática `CA1 · registrar mascota con dos responsables`; prueba manual #1 del README |
| CA2 | Al abrir la ficha de una mascota se ven todos sus responsables | **Cumplido** | Prueba automática `CA2`; captura `evidencias/ficha-mascota.png` |
| CA3 | Al abrir un responsable se ven todas sus mascotas | **Cumplido** | Prueba automática `CA3`; captura `evidencias/ficha-responsable.png` |
| CA4 | No regresiones del Reto 1 | **Cumplido con cambio intencional** (ver nota) | Búsqueda, visitas, validaciones de visita, datos de ejemplo y persistencia pasan en la suite de Reto 2 |

**Nota sobre CA4.** Dos reglas del Reto 1 cambian porque el nuevo requerimiento lo exige: un paciente ya no se registra con un solo responsable (CA1 lo pide), y la regla de duplicado ahora considera el conjunto de responsables (D4). Las validaciones de visitas, de nombre, de especie y de longitud se mantienen. La suite de pruebas del Reto 1 (`reto1/tests/e2e.js`) no se ejecutó contra esta versión: sus casos de un solo responsable fallarían por diseño.

## Criterios de aceptación transversales

- No se crean responsables duplicados por accidente (prueba `CA3/4`).
- Las relaciones persisten al recargar y al reiniciar el servidor (prueba `Persistencia`).
- Los datos del Reto 1 se migran sin pérdida (prueba `Migración`).
- Sin errores de JavaScript en la consola durante el flujo principal.
- Diseño usable en escritorio y en celular de 375px sin desbordamiento horizontal.

## Fuera de alcance

- Autenticación.
- Edición y borrado.
- Teléfono, dirección o documento del responsable.
- Sincronización entre navegadores o equipos.
- Datos reales: todo es inventado.
