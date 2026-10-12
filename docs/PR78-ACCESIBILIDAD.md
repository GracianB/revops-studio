# RevOps PR78 · Accesibilidad y experiencia móvil

**Estado:** PR en borrador basada en PR77. Sin publicación ni fusión.

## Mejoras implementadas y comprobables

1. Tres enlaces de salto al contenido, editor y tabla de resultados.
2. Instrucciones prácticas de teclado dentro de la demostración.
3. Botones de fila que anuncian fila, estado y motivo, no solo la acción.
4. Navegación con Flecha Arriba/Abajo por el orden visual actual de los registros visibles.
5. Inicio y Fin para primer y último registro visible, sin modificar el CSV.
6. Intro/Espacio abre la corrección usando la semántica de botón nativo.
7. Etiquetas `aria-keyshortcuts` y ayuda relacionada con la tabla.
8. Vínculo `aria-describedby` del CSV con ayudas y error de formato.
9. Campo de CSV con `aria-invalid` verdadero solo cuando la entrada resulta inválida.
10. Errores con role=alert y atomicidad para no fragmentar anuncios.
11. Anuncio agregado de recuentos sin volver a leer contenidos de filas.
12. Foco en títulos de mapper, reglas, candidatos e informes al abrirlos.
13. Escape cierra los paneles no modales avanzados y restaura el botón que los abrió.
14. Escape mantiene la recuperación de foco existente del editor de registros y mapper.
15. Confirmación de pérdida de datos atrapando Tab/Mayús+Tab entre sus decisiones.
16. Escape cancela la pérdida de datos, sin borrar el texto del usuario.
17. Explicación de errores por campo conectada al input correspondiente.
18. Estado de invalidez de un campo corregido actualizado después de recalcular.
19. Controles principales de al menos 44 px de altura en vista avanzada.
20. Reflujo a 320 CSS px, equivalente al ancho disponible a 400 % de zoom en pantalla de 1280 px.
21. Encabezado que deja de ser sticky en anchos reducidos para liberar espacio útil.
22. Contenedores con rotura segura de texto sin esconder acciones ni campos.
23. Mayor claridad de focus-visible, incluida selección activa de fila.
24. Adaptaciones para alto contraste y forced-colors.
25. Respeto explícito de preferencias de reducción de movimiento.
26. Navegación real probada en Chrome y Firefox, y axe en temas claro/oscuro en Chrome.

## Límites y criterios de aceptación

- Se ejecuta axe con reglas WCAG 2.0 y 2.1 A/AA, y se bloquean hallazgos graves o críticos. Los hallazgos menores son evidencia para seguir mejorando, no permisos para ignorarlos.
- Se verifican los recorridos con Tab, Shift+Tab, flechas, Inicio, Fin, Intro y Escape, y las transiciones de foco entre editor/mapper/3 paneles.
- 320 px es una equivalencia geométrica útil del reflujo a zoom 400 % en un monitor de 1280 px. No constituye prueba nativa de zoom del navegador en todos los motores.
- Las pruebas automáticas no certifican WCAG. Quedan para la revisión manual: lector de pantalla real, 400 % zoom nativo, contraste perceptual en todas las tarjetas y distintas combinaciones de ampliación.
- No se aumentan las peticiones iniciales de la página pública: helper pequeño y propio, sin dependencias nuevas ni conexión de datos.
- El repositorio GitHub es público aunque este cambio esté como borrador.

## QA

`npm run verify` (incluida regresión V40), pruebas de navegación y contraste, E2E Chrome/Firefox, viewport 1280/390/320, axe light/dark, modo forzado, movimiento reducido, presupuestos de rendimiento. Sin merge ni despliegue.
