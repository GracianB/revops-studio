# PR84 · Laboratorio de fallos sin conexión externa

Rama borrador sobre PR83. **No desplegar ni fusionar.**

## Ensayos defensivos

Se ejecutan siete inyecciones controladas usando los módulos reales de PR81–PR83: intento de marcar SIGNOFF, mezclar escenarios, ensayar una firma externa, saltar dependencias de reversión, atribuir una ejecución, exportar una aprobación falsa y mezclar el libro de evidencias. Se espera que los validadores del producto rechacen cada intento.

Los tests recorren los 18 conjuntos sintéticos, exigen siete rechazos por muestra y verifican la ausencia de datos identificativos en el informe agregado.

## Límite estricto

Un rechazo correcto demuestra una protección local concreta, no seguridad de infraestructura, pentesting, conectividad, integridad de backups ni rollback real. Los módulos no poseen tokens, endpoints de terceros ni APIs operativas. El informe nunca afirma que exista una autorización empresarial.
