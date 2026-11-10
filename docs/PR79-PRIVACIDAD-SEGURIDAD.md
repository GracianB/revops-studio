# RevOps PR79 · Privacidad, seguridad y defensa de datos

> **Contexto histórico anterior a V104.** Este documento conserva el diseño y las condiciones de su PR original. Su contenido quedó integrado en la rama principal con `90371736c2636f1807382ddbd077baff9b9a019c`; las menciones a borrador, bloqueo de integración o ausencia de publicación corresponden a aquella etapa. Consulta [Publicación V104](V104-PUBLICACION-SITIO.md) para el alcance vigente. Los límites sobre integraciones reales, datos de clientes y aprobaciones externas siguen vigentes. El despliegue público actual requiere su propia comprobación HTTPS.

**Estado:** desarrollo aislado, PR en borrador apilada sobre PR78. No fusionar, no publicar.

## Cambios funcionales implementados

1. Un único `secureCsvCell` para CSV completo, CSV visible y cola preparada.
2. Neutralización de fórmulas con `=`, `+`, `-` y `@`, aun precedidas por espacios o controles invisibles.
3. Neutralización de variantes Unicode de anchura completa (＝＋－＠) en exportaciones.
4. Escapado correcto de comillas dobles, saltos de línea y separadores regionales.
5. Importación UTF-8 estricta, rechazando control de texto oculto, bidireccional y caracteres no permitidos.
6. Validación común para CSV pegado en el editor y archivo cargado, sin vías de elusión.
7. Máximo 24 columnas, 128 caracteres por cabecera, 400 por celda, 12.000 caracteres y 80 filas.
8. Clasificación local de campos que contienen emails: ejemplo frente a dominio no ficticio.
9. Recuento agregado de posibles fórmulas, controles invisibles y celdas extensas.
10. Distinción explícita entre CSV con valores personales e informes agregados sin filas.
11. Centro de privacidad integrado en la demo avanzada, sin interferir con la primera visita guiada.
12. Confirmation de borrado voluntario antes de limpiar la sesión de trabajo.
13. Cancelación con Escape y recuperación del foco al control que abrió la confirmación.
14. Reinicio de CSV ficticio, búsquedas, filtros, correcciones y estado de la mesa.
15. Eliminación activa de notas de revisión y decisiones simuladas conservadas en closures del panel de reglas.
16. Eliminación activa de conjuntos y variantes del simulador PR76.
17. Eliminación activa de la instantánea temporal de informes PR77.
18. Limpieza restringida de las claves propias de `sessionStorage`, conservando otras aplicaciones y el tema.
19. Mensajes honestos: los archivos ya descargados y el portapapeles no pueden revocarse.
20. Auditoría explícita de recursos CSS/JS del documento `demo.html`, que deben ser de primera parte.
21. Pruebas de vectores maliciosos CSV y caracteres Unicode, límites estructurales y las 18 recetas sintéticas.
22. Pruebas Chrome/Firefox de exportación protegida, limpieza, aislamiento de preferencias, ausencia de peticiones externas y pantalla de 320 px.

## Frontera de privacidad y limitaciones

- La app ejecuta la demo localmente; los CSV descargados siguen conteniendo los datos que el usuario haya introducido. No se anuncian como anónimos.
- La auditoría de campos que parecen correos es heurística. No promete encontrar todos los datos personales: revisar las exportaciones sigue siendo imprescindible.
- La protección de fórmulas se aplica a los CSV que genera el producto, sin afirmar que puede neutralizar cualquier formato de hoja de cálculo externo.
- Ningún texto del conjunto original se incorpora al resumen agregado ni se envía por este módulo.
- El botón de limpieza elimina referencias manejadas por estos módulos, pero el navegador puede conservar copias temporales, historial o descargas fuera del alcance de esta demo.
- No se borran claves ni archivos ajenos a RevOps; el tema del sitio y el portapapeles permanecen como estaban.
- La conexión empresarial futura sigue fuera del alcance. No hay CRM, permisos, identidades verificadas, telemetría ni ejecuciones externas.
- El código está en un repositorio público, aunque la PR permanezca draft.

## Acceptance

`npm run verify`; regresión V40; pruebas de 18 fixtures; casos maliciosos Excel/Unicode; Chrome y Firefox con transferencia de archivo CSV, limpieza de estado y confirmación; pruebas de privacidad y presupuestos de rendimiento. No fusionar ni desplegar.
