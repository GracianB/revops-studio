# RevOps Studio PR95 · Revisión integrada con autorización externa obligatoria

**Estado:** PR de desarrollo apilada sobre PR94. No fusionar ni desplegar.

## Resultado del bloque PR91–95

Integra el control de entrada PR80, catálogo de riesgos PR82, tareas PR81, ensayos PR84, capacidades PR86, autorizaciones PR87, atlas PR90, navegación y accesibilidad PR91, ruta guiada PR92, historial efímero PR93 y matriz de requisitos PR94.

El tablero PR95 evalúa doce criterios: ocho técnicos calculables (muestra, bloqueos, privacidad, riesgos catalogados, requisitos trazables, defensas en memoria, dependencias, atlas sintético) y cuatro externos inmarcables (tecnologías de apoyo, revisión independiente de privacidad y seguridad, integración y reversión reales, autorización empresarial).

Aunque los ocho controles locales puedan marcarse correctos, **la decisión de producción nunca cambia de NO AUTORIZADO**. La elegibilidad para revisión independiente no es una autorización ni la promesa de un proyecto real.

## Entregables

- Sección integrada en el centro del piloto, con estados textuales, doce criterios y desglose técnico/externo.
- Recalcular sin recopilar información adicional.
- JSON y TXT agregados, con lista positiva de atributos, ausencia de filas del CSV y cero aprobaciones o evidencia verificada.
- Invalidación cuando cambia la muestra, limpieza desde el panel existente y sin almacenamiento persistente.

## Aceptación y límites

Pruebas unitarias en los 18 datasets, escenario sintético limpio con atlas en verde, muestras bloqueadas, intento de falsificar permisos y privacidad. Navegador Chrome/Firefox: doce criterios, descargas sin PII, cero aprobaciones, foco, 320px, auditoría axe automatizada. Conservación de `npm run verify` V40 sin cambiar umbrales de rendimiento.

Estas comprobaciones **no sustituyen** revisión manual de accesibilidad, pruebas reales de integraciones y rollback, evaluación legal, auditoría de seguridad ni autorización verificable en sistemas externos.

El bloque PR96–100 deberá tratar esas necesidades como trabajo pendiente y no como requisitos ya certificados.
