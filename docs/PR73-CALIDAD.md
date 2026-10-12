# PR73 · Data Quality Cockpit

**Estado:** desarrollo en borrador, basado en la rama PR72. No fusionar ni desplegar.

## 12+ comportamientos implementados

1. Contador de claves únicas, independientes de mayúsculas/minúsculas.
2. Identificación de IDs vacíos y filas implicadas.
3. Duplicados de identificador con contenido idéntico.
4. Conflictos de identificador con contenido diferente.
5. Completitud de celdas y desglose de vacíos por campo.
6. Distribución de cifras por bandas, incluidos negativos e inválidos.
7. Detección por escenario de fechas de calendario imposibles.
8. Detección de importes/valores numéricos inválidos.
9. Candidatos a atípicos con umbrales IQR, solo con 5 o más observaciones y suficiente dispersión.
10. Ranking reproducible de motivos de bloqueo por frecuencia.
11. Navegación desde una categoría/columna al editor de la primera fila afectada.
12. Comparación agregada de calidad contra la ejecución original tras correcciones y deshacer/rehacer.
13. Informe agregado TXT sin registros, IDs, emails ni cifras introducidas por usuario.
14. Vistas responsivas y acceso por teclado en modo de herramientas avanzadas.
15. Pruebas unitarias y de Chrome/Firefox para las tres familias de procesos.

## Límites y privacidad

- La integridad no equivale a exactitud, y los atípicos son solo sospechas estadísticas.
- El método IQR requiere una muestra mínima de cinco valores y un rango intercuartílico positivo.
- Los datos del visitante solo se usan en memoria de la pestaña y en la exportación solicitada.
- El informe nunca exporta filas, nombres o valores; únicamente métricas agregadas.
- La comparación se basa en el mismo número de posiciones, no identifica causalidad.
- No se ejecutan operaciones contra CRM/ERP ni se atribuye ROI a clientes.
- El repositorio GitHub continúa público pese al estado draft.

## Criterio de cierre

Unitarias completas, navegador Chrome y Firefox en móvil/escritorio, aceptación de la edición y el retroceso, presupuesto de rendimiento, auditoría de enlaces y release gate V40. No relajar estándares para aprobar.
