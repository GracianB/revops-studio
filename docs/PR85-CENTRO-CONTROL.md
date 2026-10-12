# RevOps Studio PR85 · Pilot Control Center

**Estado:** código de desarrollo en PR draft, apilado sobre PR84. No fusionar, desplegar ni exponer como producto listo para producción.

## Experiencia

La demo avanzada incorpora una consola de carga diferida con:

1. **Riesgos:** diez controles PR82 vinculados a señales PR80 y tareas PR81, con filtro por prioridad, explicaciones y mitigaciones. Ningún riesgo se da por cerrado por una muestra sintética.
2. **Evidencias:** criterios PR83 por función responsable, checklist exclusivamente simulado, bloqueo de la autorización final y recuento explícito de requisitos aún pendientes.
3. **Ensayos:** ejecución opcional de siete defensas PR84 en memoria, con resultados individuales. No prueba redes, sistemas reales ni capacidades de recuperación de producción.
4. **Revisión unificada:** indicadores sin métricas inventadas, exportación JSON de campos seleccionados, reinicio local, cierre y recuperación del foco, soporte de teclado y maquetación móvil.

## Integridad y límites

Cada apertura reevalúa el escenario y la muestra mediante el motor real. Si el CSV cambia se invalidan los estados previos; no persisten en localStorage, sessionStorage, servidor o telemetría. Las casillas de evidencia no aceptan comentarios, documentos personales, firmas ni datos del cliente.

La exportación combina tres exportadores de lista positiva, nunca vuelca el CSV ni el estado completo del navegador. La cuenta de aprobaciones reales y la de acciones externas permanecen en cero.

## Aceptación

- Prueba integrada de los 18 conjuntos y tres escenarios.
- Test de correspondencia de identificadores DOM con la consola.
- Chrome/Firefox: carga diferida, 10 riesgos, bloqueo de SIGNOFF, evidencias ensayadas, 7 rechazos, filtro, descarga sin datos identificativos, reinicio, foco, accesibilidad y anchura de 320 px.
- No modificar el contrato V40 de `npm run verify`, ni publicar hasta que CI e inspección manual estén superadas.

## Camino hacia V100

PR86–90: ergonomía, accesibilidad manual y telemetría local ficticia solo si aporta valor sin recopilar datos. PR91–95: perfiles de piloto por vertical, matrices de aceptación y pruebas de regresión. PR96–100: auditoría, documentación comercial honesta, cierre de seguridad, pilotos autorizados y lanzamiento solo tras aprobación.
