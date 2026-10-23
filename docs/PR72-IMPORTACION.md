# RevOps PR72 · Contrato de importación profesional

> **Contexto histórico anterior a V104.** Este documento conserva el diseño y las condiciones de su PR original. Su contenido quedó integrado en la rama principal con `90371736c2636f1807382ddbd077baff9b9a019c`; las menciones a borrador, bloqueo de integración o ausencia de publicación corresponden a aquella etapa. Consulta [Publicación V104](V104-PUBLICACION-SITIO.md) para el alcance vigente. Los límites sobre integraciones reales, datos de clientes y aprobaciones externas siguen vigentes. El despliegue público actual requiere su propia comprobación HTTPS.

**Estado:** rama apilada sobre PR71, no fusionar ni publicar. No implica acceso a CRM, ERP o datos reales.

## Entregables verificables

1. Rechazo previo de archivos que superen 32 KB.
2. Decodificación UTF-8 estricta, sin sustitución silenciosa de bytes.
3. Compatibilidad con BOM UTF-8 y rechazo de UTF-16 o codificación inválida.
4. Validación de caracteres de control, archivos vacíos y límite de 12.000 caracteres.
5. Autodetección de CSV separado por comas, punto y coma, y TSV.
6. Cabeceras obligatorias, sugerencias de mapeo ES/EN y prohibición de asignaciones duplicadas.
7. Resumen legible de formato, filas, estados y hallazgos antes de modificar los datos.
8. Duplicados idénticos y claves repetidas con datos distintos, clasificados por número de línea.
9. Bloqueo de importes con separadores regionales ambiguos, sin conversión automática.
10. Vista previa del mapeo y recuentos reales antes de aplicar.
11. Confirmación explícita de exclusión de columnas adicionales, conservando la entrada anterior.
12. Perfil JSON reutilizable de escenario y nombres de columnas, sin valores de registros.
13. Validación de versión, tamaño, escenario, columnas disponibles y unicidad de perfil.
14. Recuperación ante errores: no sustituir ni perder el conjunto previo.
15. Pruebas unitarias de formatos, bytes inválidos, privacidad, duplicados y reglas.
16. Recorrido Chrome/Firefox y móvil con perfiles, validaciones y recuperación.

## Límites deliberados

- No convertir automáticamente valores ambiguos como 1.234 y 1,234.
- No interpretar Windows-1252 o ISO-8859-1 como UTF-8: reexportar en UTF-8.
- El perfil revops-mapping-profile-v1 no contiene datos de filas.
- No hay integración externa ni ejecución automática de acciones.
- Ni el uso de importación ni los perfiles envían datos al servidor.
- El repositorio GitHub sigue público aunque esta PR sea un borrador.

## Aceptación

npm run verify, pruebas específicas de importación, Chrome/Firefox, móvil y los presupuestos de rendimiento existentes. No relajar límites para que una PR pase. Motor V40 sin alteraciones.
