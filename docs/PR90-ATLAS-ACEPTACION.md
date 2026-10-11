# RevOps Studio PR90 · Integration Atlas y cierre del bloque 81–90

**Estado previsto:** PR borrador apilada sobre PR89. Sin fusión, despliegue o autorización real.

## Propósito

Consolidar PR80–PR89 en una comprobación transversal reproducible sin transformar «funciona en una muestra» en «listo para producción».

### Contrato de aceptación local

Por cada uno de los **tres procesos** (pedidos, soporte y datos) se ejecutan **seis muestras sintéticas** predefinidas. Sobre cada una, el navegador calcula:

- Ocho controles de preparación PR80. **144** evaluaciones de estado agregadas.
- Una planificación PR81 y su tarea SIGNOFF inmarcable.
- Un catálogo PR82 con diez riesgos siempre pendientes de verificación empresarial.
- Un libro PR83 de requisitos de evidencias sin documentos privados.
- Siete defensas PR84. **126** ensayos de rechazo locales.
- Cuatro capacidades PR86 y limitación por función.
- Un dictamen PR87 que nunca permite producción.
- Seis invariantes estructurales por fixture: preparación, riesgos, evidencias, defensas, capacidad y autorización. **108** verificaciones.

El módulo devuelve **18 resultados**, fallos de invariantes y métricas agregadas. Los números fijos indicados son objetivos de cobertura de las muestras sintéticas; solo se consideran resultados logrados si la ejecución los confirma.

## Consola y reportes

La sección 08 permite ejecutar el atlas a demanda, sin cargar su módulo en la vista inicial. Muestra cuatro indicadores, 18 resultados por escenario y descargas de resumen JSON/TXT con listas positivas. La ejecución y las descargas no solicitan credenciales ni envían información a terceros.

Cambiar el CSV, restaurar un ejemplo o limpiar datos invalida el atlas visible y deshabilita sus descargas anteriores dentro de la pestaña. Los archivos ya descargados no se pueden revocar.

## QA requerido

- Unit tests sobre el resultado transversal, determinismo, límites, privacidad y negativa a producir una aprobación.
- Chrome y Firefox con uso real del botón, carga diferida, 18 resultados, 144 gates, 126 ensayos defensivos, JSON/TXT, foco, eje horizontal a 320px y axe.
- Ejecución de `npm run verify` V40, aceptación PR80, lint de navegador y presupuestos de rendimiento sin aumentar límites.

## Criterios de salida y lo que NO se afirma

Una CI verde significa **pruebas técnicas automatizadas superadas para este commit**. No demuestra autorización del cliente, aprobación de despliegue, revisión manual de accesibilidad, pentesting, cumplimiento regulatorio o métricas comerciales reales.

**El estado de producción continúa NO-GO.** Las futuras PR91–100 deberán abordar verificaciones independientes, piloto autorizado, preparación comercial, accesibilidad manual y lanzamiento solamente tras un proceso de aprobación real.
