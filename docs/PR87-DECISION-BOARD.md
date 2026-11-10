# RevOps PR87 · Decision Board y frontera de autorización

> **Contexto histórico anterior a V104.** Este documento conserva el diseño y las condiciones de su PR original. Su contenido quedó integrado en la rama principal con `90371736c2636f1807382ddbd077baff9b9a019c`; las menciones a borrador, bloqueo de integración o ausencia de publicación corresponden a aquella etapa. Consulta [Publicación V104](V104-PUBLICACION-SITIO.md) para el alcance vigente. Los límites sobre integraciones reales, datos de clientes y aprobaciones externas siguen vigentes. El despliegue público actual requiere su propia comprobación HTTPS.

**Estado:** desarrollo apilado sobre PR86, en borrador. Sin fusión, despliegue ni permisos externos.

## Objetivo

Cerrar la ambigüedad entre «un CSV pasa los controles de la demo» y «una empresa ha autorizado operar». El panel añade una decisión explícita de **NO AUTORIZADO PARA PRODUCCIÓN**, incluso con datos sintéticos impecables y siete ensayos defensivos satisfactorios.

## Ocho controles con estados explicables

1. Calidad y reglas de la muestra.
2. Privacidad y minimización.
3. Riesgos operativos abiertos.
4. Evidencias y criterios de aceptación.
5. Ensayos locales y validación independiente.
6. Conexiones y permisos externos.
7. Reversión y continuidad.
8. Autorización humana empresarial.

Se calculan de los motores PR80–PR86, no de indicadores decorativos. Los ensayos locales se diferencian de evidencias aportadas por responsables autorizados. Los requisitos externos nunca aparecen «aprobados» en esta demo.

## Experiencia integrada

Sección 05 del Pilot Control Center con estado legible, explicación de elegibilidad de muestra, ocho requisitos, remediaciones concretas derivadas de los gates PR80 y accesos a revisión PR80 / plan PR81. La exportación JSON del centro de control incorpora esta conclusión sin copiar datos personales, emails o registros de la fuente.

## Pruebas de aceptación

- Evaluaciones sobre 18 fixtures con y sin ensayos locales.
- Muestras limpias que permiten ensayo supervisado pero siguen sin autorización de producción.
- Rechazo de informes, escenarios o aprobaciones falsificadas.
- Revisión de privacidad en exportación.
- Chrome y Firefox: controles, rutas internas, JSON con NO-GO, foco, reflow móvil a 320 px, axe, regresión V40.

**Advertencia:** que los tests automáticos resulten satisfactorios no equivale a aprobación humana, auditoría legal o certificación de seguridad empresarial.
