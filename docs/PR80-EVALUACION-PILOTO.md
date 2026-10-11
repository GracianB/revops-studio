# RevOps PR80 · Evaluación para piloto supervisado

**Estado:** PR de desarrollo apilada sobre PR79. Sin merge, sin despliegue, sin autorización de producción.

## Ocho comprobaciones reales

1. PIL-01: contrato de CSV y coincidencia del resultado con el motor y catálogo.
2. PIL-02: bloqueos pendientes, con ruta a la primera corrección.
3. PIL-03: decisiones humanas pendientes, con ruta a PR75.
4. PIL-04: indicios de emails no ficticios, fórmulas o controles, con ruta a PR79.
5. PIL-05: integridad de las celdas, con advertencia sobre exactitud.
6. PIL-06: número de acciones preparadas, distinguidas de históricos y bloqueos.
7. PIL-07: identificadores contradictorios, con investigación obligatoria.
8. PIL-08: prohibición de acciones externas, conexión automática o aprobación real.

## Entregables funcionales

- Evalúa siempre el estado del CSV actual ejecutando de nuevo el motor.
- Rechaza resultados desfasados o manipulados aunque coincida el número de filas.
- Concilia estados, trazabilidad y calidad sobre la misma muestra.
- Distinción textual entre bloqueo, advertencia y comprobación superada.
- Resultado conservador: exige cero bloqueos y advertencias para aptitud exclusiva de demostración supervisada.
- Botones de corrección que abren controles funcionales existentes, sin acciones nuevas de CRM.
- Exportaciones TXT y JSON agregadas, sin datos de cada fila ni notas humanas.
- Panel accesible con carga diferida, cierre y foco recuperable, sin carga inicial innecesaria.
- Limpieza del estado temporal en PR79 cuando el usuario descarta datos.
- Validación transversal `npm run pr80:check` incorporada a `npm run verify`.
- 18 ejemplos en tres procesos con motor, calidad, reglas, privacidad, escenario conservador y PDF auténtico.
- Browser smoke Chrome/Firefox para los ocho controles, exportaciones, ruta a la corrección, casos limpios, cambios de origen y 320 px.

## Qué se necesita para una producción real

- Entrevista con responsables y dueños de datos, consentimiento y finalidad legal de tratamiento.
- Contratos de sistemas, permisos, autenticación, auditoría externa y seguridad de infraestructura.
- Validación de colas y errores por un operador verificado, no una aprobación simulada.
- Infraestructura real con mecanismos de reversión y trazabilidad autorizada.
- Revisión manual de accesibilidad (lectores de pantalla), seguridad y privacidad de datos y clientes.
- Consentimiento explícito para cualquier futuro despliegue y supervisión de producción.

La etiqueta «muestra apta para ensayo supervisado» solo expresa que la muestra sintética cumple los criterios del motor de la demo. **No** acredita calidad real, ahorro, ROI, seguridad empresarial, identidad ni aprobación de ejecución.

## Pruebas y criterio de cierre

Pruebas unitarias y adversariales PR71–PR80; `npm run verify` incluyendo `pr80:check` y release gate V40; Chrome y Firefox en escritorio/móvil; accesibilidad, presupuesto de rendimiento y seguridad de exportaciones. Esta PR seguirá draft y sin publicación hasta autorización.
