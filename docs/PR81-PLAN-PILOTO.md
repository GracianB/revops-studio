# RevOps PR81 · Pilot Planning Studio

**Estado:** pull request en borrador sobre PR80. Sin fusión, publicación, integración externa o autorizaciones reales.

## Contrato del producto

Un diagnóstico no equivale a un proyecto. Pilot Planning Studio convierte cada gate PR80 pendiente en trabajo estructurado sin exponer valores de filas. Se utiliza exclusivamente sobre el escenario y la fuente actuales; si el usuario modifica el CSV se invalidan plan y simulaciones.

### Tareas y dependencias

1. Alcance del caso de uso con criterios de aceptación.
2. Responsables por función, designados fuera de la demo.
3. Corrección de bloqueos obligatorios cuando existan.
4. Resolución de identificadores contradictorios cuando existan.
5. Tratamiento de celdas vacías cuando afecten a la muestra.
6. Revisión de privacidad cuando haya emails no ficticios o fórmulas.
7. Resolución de excepciones humanas cuando el motor requiera criterio.
8. Caso de negocio medible cuando no existan acciones preparadas.
9. Seguridad, permisos y separación de entornos.
10. Accesibilidad validada con usuarios y tecnologías de apoyo.
11. Integración de prueba en un entorno autorizado, dependiente de controles previos.
12. Observación, umbrales y criterios de interrupción.
13. Reversión ensayada antes de activar cambios.
14. Aprobación externa real, permanentemente bloqueada dentro de la demo.

Las tareas condicionales solo aparecen si la evaluación PR80 indica necesidad. El plan se ordena por dependencias acíclicas; no puede proponerse una prueba de integración antes de resolver riesgos exigibles. Las cinco fases son Definición, Preparación de datos, Gobernanza, Ensayo técnico y Autorización externa.

### Experiencia integrada

- Capacidad elegible entre 2 y 5 tareas por ola. Es un modelo de simultaneidad, **no duración en horas o días**.
- Listado por olas con función responsable, prueba de aceptación, prerequisitos y esfuerzo relativo de 1 a 3 puntos.
- Marcas simuladas, reversibles y conservadas únicamente en memoria de la pestaña actual.
- Un dependiente marcado impide desmarcar su prerequisito para no fabricar un progreso incoherente.
- La tarea SIGNOFF nunca es marcable; incluso con el resto ensayado sigue faltando autorización externa.
- Botón de reinicio, retorno directo al diagnóstico PR80, Escape/cierre con recuperación de foco y controles accesibles.
- TXT y JSON con tareas y números agregados, sin valores originales, IDs de registros, emails, notas o nombres de trabajadores.

### Privacidad y prohibiciones

El modelo usa solo el catálogo cerrado de tareas y estados PR80. No contiene el CSV ni transfiere información; no usa cookies, sesiones persistentes, APIs de CRM o telemetría. Los roles son categorías generales sin nombres asignados. No se permite marcar aprobaciones empresariales ni acciones externas como completadas.

### Acceptance y límites

- Tests unitarios sobre 18 ejemplos en tres escenarios, capacidad 2/3/4/5 y grafo acíclico con prerequisitos.
- Ensayo completo de prerrequisitos, intento de bypass, autorización inmarcable, reinicio y exportaciones agregadas.
- Browser smoke Chrome/Firefox con datos cambiantes, limpieza, foco, accesibilidad y ancho de 320 px.
- Mantener el contrato de PR80, regresión V40 y presupuesto de rendimiento sin elevar límites.
- No afirmar cumplimiento WCAG certificado, productividad real, duración del proyecto, firma externa ni preparación para producción.

La PR queda aislada; GitHub sigue siendo público aunque el software de esta rama no esté publicado.
