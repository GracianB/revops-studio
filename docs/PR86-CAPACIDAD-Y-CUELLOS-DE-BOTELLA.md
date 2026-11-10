# RevOps PR86 · Capacity & Bottleneck Explorer

> **Contexto histórico anterior a V104.** Este documento conserva el diseño y las condiciones de su PR original. Su contenido quedó integrado en la rama principal con `90371736c2636f1807382ddbd077baff9b9a019c`; las menciones a borrador, bloqueo de integración o ausencia de publicación corresponden a aquella etapa. Consulta [Publicación V104](V104-PUBLICACION-SITIO.md) para el alcance vigente. Los límites sobre integraciones reales, datos de clientes y aprobaciones externas siguen vigentes. El despliegue público actual requiere su propia comprobación HTTPS.

**Estado:** PR en borrador apilada sobre PR85. Sin fusión, lanzamiento o conexión externa.

## Alcance

Transforma un plan PR81 en cuatro escenarios de capacidad (2, 3, 4 y 5 tareas por ola), con dos hipótesis de disponibilidad por función (una o dos tareas simultáneas). El modelo impide simultaneidad ilimitada de una misma función, preserva dependencias y mantiene la autorización humana SIGNOFF pendiente.

El objetivo es revelar dónde una capacidad global optimista ignora cuellos de botella funcionales. No se representan personas reales, fechas, horas, presupuesto, probabilidades ni ingresos.

### Qué calcula

- Número de olas **lógicas** antes y después de introducir restricción de función.
- Olas adicionales introducidas por la restricción y huecos de capacidad, sin convertirlos en retrasos.
- Cadena de dependencias que acumula más unidades de esfuerzo **relativo**, no ruta crítica por duración.
- Carga por función y tareas asignadas a cada función genérica.
- Estructura de las olas para revisión en JSON, con tareas del catálogo, roles y capacidades, sin datos de filas.

## Consola

Nueva sección 04 en PR85, select accesible de disponibilidad por función, tabla con encabezados, región desplazable en 320px, cadena relativa visible, lista de carga y exportación integrada en el JSON PR85. Se vuelve a calcular con el escenario actual; un cambio de CSV invalida el centro de control completo.

## Seguridad y aceptación

Tests del motor y 18 fixtures sintéticos × 2 límites de función, dependencias, unicidad, prohibición de aprobaciones, exportación sin valores privados y rechazo de límites inválidos. Smoke real de Chrome/Firefox sobre tabla, cambio de hipótesis, revisión JSON, foco, responsive y accesibilidad automatizada.

No es un estimador de calendario ni presupuestos y no certifica asignación de recursos o factibilidad empresarial.
