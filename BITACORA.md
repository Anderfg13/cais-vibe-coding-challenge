# Bitácora

<!-- Por cada reto, 4 líneas cortas:

## Reto N
- Datos: minutos que tomó y cantidad aproximada de prompts.
- Qué hicimos y qué decidió la IA por nosotros:
- Qué nos sorprendió o salió mal:
- Qué haríamos distinto:

Al final, 3 líneas que conecten lo vivido con la clase pasada (spec, criterios de aceptación, arnés o sensores).
-->

## Reto 1 · Lanzamiento
- Datos: 10 min, ~2 prompts (1 prompt grande nuestro + ajuste de fecha). Herramienta: Claude.
- Qué hicimos y qué decidió la IA por nosotros: nosotros fijamos las 3 funciones (registrar paciente, listar pacientes, visitas e historial); la IA decidió sola el stack (HTML/JS puro sin servidor), guardar en localStorage, la especie como lista cerrada, no permitir editar ni borrar, y agregar un botón de datos de ejemplo que no pedimos.
- Qué nos sorprendió o salió mal: Que hiciera 170 pruebas y solo diciendole que todo estuviera bien.Que hiciera la memoria en el navegador.
- Segunda iteración: pedimos "que todo funcione" y se agregó una suite de 170 pruebas automáticas en navegador (`npm test` en `reto1/`). Encontró 2 errores que a mano no vimos: en celular la página se desbordaba hacia los lados y faltaban validaciones (duplicados, fechas futuras, espacios en blanco, datos guardados dañados). Sin criterios de aceptación escritos, la IA decidió sola qué cuenta como "válido" 
- Qué haríamos distinto: Decidir nosotros dónde se guardan los datos; localStorage no se comparte entre computadores, lo que puede romper el próximo reto. Mejorar el front (Eligiendo el stack)
