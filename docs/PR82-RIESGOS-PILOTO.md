# RevOps Studio PR82 · Matriz de riesgos del piloto

> **Contexto histórico anterior a V104.** Este documento conserva el diseño y las condiciones de su PR original. Su contenido quedó integrado en la rama principal con `90371736c2636f1807382ddbd077baff9b9a019c`; las menciones a borrador, bloqueo de integración o ausencia de publicación corresponden a aquella etapa. Consulta [Publicación V104](V104-PUBLICACION-SITIO.md) para el alcance vigente. Los límites sobre integraciones reales, datos de clientes y aprobaciones externas siguen vigentes. El despliegue público actual requiere su propia comprobación HTTPS.

**Estado:** borrador apilado sobre PR81. No fusionar ni desplegar.

## Contrato funcional

Diez riesgos operativos trazables a los ocho controles PR80 y a las tareas PR81. El impacto y la exposición se expresan en bandas ordinales de 1 a 3; su producto determina la prioridad (baja, media, alta o crítica). No son probabilidades de pérdidas ni métricas empresariales verificadas.

Dos riesgos (rollback y autorización) permanecen abiertos incluso si las muestras sintéticas pasan todas las validaciones. Nunca se marca un riesgo empresarial como solucionado desde esta demostración.

## Seguridad y privacidad

La exportación JSON utiliza una lista positiva de atributos predefinidos, sin valores del CSV, identificadores de registro, correos ni notas. Se rechazan escenarios inconsistentes, ausencia de tareas obligatorias y resultados que afirmen acciones o autorizaciones reales.

## Pruebas

18 conjuntos sintéticos, integridad del catálogo, relación con el plan, escalado por señales, privacidad y alteración deliberada del contrato. Módulo reutilizable preparado para la consola PR85. No activa conectores ni tráficos externos.
