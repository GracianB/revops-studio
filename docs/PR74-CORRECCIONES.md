# RevOps PR74 · Mesa de correcciones y control reversible

**Estado:** PR draft apilada sobre PR73. Sin fusión ni publicación.

## Resultados observables de producto

1. Previsualización de cambios antes de guardar, sobre el motor local real.
2. Diferencias antes/después por cada campo modificado, mostradas solo en la pantalla local.
3. Comparación agregada de estado y de listas/bloqueos/revisiones tras una corrección propuesta.
4. Aviso expreso de las decisiones humanas todavía pendientes.
5. Bloqueo de guardado sin diferencias y validación de todos los campos/formato.
6. Historial de 20 correcciones efectivas, acotado en memoria de la pestaña.
7. Deshacer múltiples correcciones en orden inverso.
8. Rehacer múltiples correcciones y volver a evaluar las reglas.
9. Saltar directamente a un estado anterior del historial.
10. Ramificar la línea de cambios: nueva corrección después de deshacer elimina la rama futura.
11. Navegar al próximo bloqueo con referencias de índice original, no de orden visual.
12. Evitar navegación accidental que descarte entradas sin guardar.
13. Atajos de teclado para deshacer/rehacer fuera de campos de texto y foco restaurado tras cerrar.
14. Vistas rápidas por todos/bloqueos/revisión/prioridades; orden reproducible.
15. Controles de densidad y visibilidad de motivo/acción, manteniendo identificador, estado y edición.
16. Guardar/restaurar/borrar vista solo cuando se solicita, en sessionStorage con cinco campos de configuración.
17. Convertir tabla de resultados a fichas accesibles en móvil con etiquetas visibles y controles táctiles.
18. Pruebas de historial, selección de filas, privacidad, navegación y regresión en Chrome/Firefox.

## Privacidad y límites

- Los registros se mantienen en memoria de la pestaña. La copia de cada estado es necesaria para deshacer, pero no se exporta ni persiste.
- Las etiquetas del historial contienen números de fila y estados, nunca identificadores, emails, nombres ni valores.
- La vista guardada por clic contiene exclusivamente filter, sort, density, reason, action. No contiene búsquedas ni registros.
- La vista previa sí presenta las celdas que se están editando, en pantalla local y antes de guardar.
- Ninguna corrección activa una conexión o ejecuta acciones en CRM/ERP.
- El estado 'revisar' sigue necesitando intervención humana; corregir una columna no autoriza ninguna operación.
- Cambiar archivos/escenario o editar el CSV directamente reinicia el historial, sin inventar una línea base comparable.
- Mantener el motor V40 intacto y los presupuestos actuales de rendimiento.
- El repositorio de GitHub es público aunque esta PR esté marcada como draft.

## Cierre verificable

Unitarias de 20 niveles, ramificación, correcciones, sin cambios, prioridades y rutas. Browser smoke Chrome/Firefox de múltiples correcciones y atajos, foco y mobile 320px. npm run verify y release gate V40. Sin merge ni deployment.
