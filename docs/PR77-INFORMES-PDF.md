# RevOps PR77 · Reporting Studio, PDF A4 real

**Estado:** PR de desarrollo en borrador sobre PR76; no fusionar ni publicar.

## Entregables comprobables

1. PDF real versión 1.4, sin HTML renombrado ni servicios externos.
2. Páginas A4, cabecera editorial, pie y numeración de todas las páginas.
3. Fuentes Helvetica/Helvetica-Bold y codificación WinAnsi para español, con comillas escapadas.
4. Paginación automática y control de ancho para párrafos largos.
5. Resumen ejecutivo y recomendaciones orientativas extraídas de contadores.
6. Cuatro métricas de estados con diseño legible y separadas de alegaciones comerciales.
7. Integridad por columna, claves únicas, conflictos, duplicados y errores de formato.
8. Comparativa R2 antes/después únicamente para la misma muestra validada.
9. Reglas PR75 con identificadores estables, aplicaciones y restricciones secundarias.
10. Revisión humana: recuento pendiente, en curso, aprobación y rechazo SIMULADOS.
11. Escenario PR76 cuando haya candidato de la misma muestra: revisión adicional y protecciones.
12. Fases siguientes orientativas y plan de piloto controlado, sin fingir conexión empresarial.
13. Fuentes y límites explícitos; cero acciones externas y aprobaciones reales verificadas.
14. Exportación de TXT solo con agregados y lenguaje legible.
15. Exportación JSON solo con estructura y métricas validadas.
16. Descarga PDF local con MIME application/pdf.
17. Abrir PDF en una pestaña para imprimir en el visor, sin imprimir los CSV del DOM.
18. Carga diferida del generador y del panel tras una acción del visitante.
19. Reinicio del panel al cambiar origen; no se reutilizan auditorías/candidatos obsoletos.
20. Pruebas de cross-reference y longitudes de streams, PDF multi página y 80 filas.
21. Chrome y Firefox verifican descargas, privacidad, apertura de impresión y móvil de 320px.

## Barrera de privacidad

El constructor recibe filas para verificar los contadores pero solo proyecta métricas verificadas y frases predefinidas. No se incorporan valores de usuario, identificadores, emails, nombres de clientes ni notas. Los nombres de columnas provienen exclusivamente de tres escenarios catalogados. Los motivos de reglas se obtienen de un catálogo propio, no de texto libre. El historial de aprobaciones solo aporta recuentos cuando corresponde exactamente a la muestra actual. El PDF se genera en el navegador y no se transmite por esta funcionalidad.

## Precisiones

- La fuente PDF Base14 se referencia mediante WinAnsi; no se incrustan archivos de fuentes ni se envían a usuarios.
- El PDF no demuestra ahorro, calidad empresarial, ROI, identidad firmada ni aprobación real.
- El botón de impresión abre el PDF auténtico en otra pestaña para usar el visor nativo.
- Esta versión no incluye un sistema de expedientes o conservación de informes en servidor.
- GitHub sigue siendo público: una PR en draft no privatiza código.

## Condiciones de cierre

Node tests, validación estructural de PDF, reproducción Chrome/Firefox, exportaciones limpias, buen diseño a 320px, V40 release gate y presupuestos de rendimiento existentes; no publicar ni fusionar.
