# PR102 · Una prueba comprensible de antes y después

**Problema observado:** la experiencia guiada de la demo explicaba los resultados de una corrección en un párrafo y tres contadores actuales. Para una primera visita, costaba ver claramente *qué cambió* sin abrir el editor avanzado.

**Implementado:**
- Bloque comparativo visible solo al terminar una corrección en la visita guiada: bloqueados, revisión pendiente y acciones preparables, cada una con **antes → después (variación)**.
- Calculado exclusivamente con los agregados generados por `analyzeWorkflow` antes y después de modificar el registro. No inventa ROI, cifras de conversión, ahorro, automatizaciones externas ni aprobaciones.
- Distingue mejoras, empeoramientos y resultados sin cambios. Cuando la modificación empeora el estado, lo indica explícitamente. Si cambia el tamaño de la muestra o los números son inválidos, rechaza la comparación.
- Experiencia accesible, sin barras decorativas que simulen porcentajes comerciales, sensible a contraste forzado y optimizada para móvil.
- El panel desaparece al cambiar de escenario, reiniciar el recorrido o al volver a pasos anteriores. No se guarda en almacenamiento y no exporta filas, direcciones de correo ni identificadores.
- Pruebas sobre 18 muestras de los tres escenarios, casos de mejora/empeoramiento, entradas malformadas, privacidad, y recorrido Chrome/Firefox incluyendo 320 px.

**Arquitectura:** motor de negocio intacto. Solo `assets/js/guided-outcome.js`, su integración en `client-journey.js`, el HTML/CSS del recorrido y su cobertura. Parte de la consolidación UX iniciada en PR101.

La V102 continúa siendo candidata de demostración. Sigue **NO AUTORIZADA PARA PRODUCCIÓN**, sin pruebas manuales de accesibilidad realizadas, permisos empresariales reales ni despliegue.