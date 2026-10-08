# RevOps Studio · Contrato de 190 mejoras verificables

Cada entrada describe una conducta que puede observarse o verificarse; no se cuentan commits, retoques de padding o pruebas como nuevas funciones comerciales.

**Corte de esta rama:** 77 comportamientos ya implementados/validados o existentes y relevantes; 113 pendientes en cartera. Solo los cambios de código y pruebas de esta PR cuentan como entrega nueva; parte de los implementados pertenecen a las versiones anteriores.

**IMPLEMENTADO** = observable en el producto o cubierto por código de esta línea de desarrollo. **PENDIENTE** = no debe anunciarse como entregado. La lista total es un plan por prioridades, no una afirmación de que las 190 están terminadas.

Fuentes de referencia: [NN/g, tareas esenciales de tablas](https://www.nngroup.com/articles/data-tables/), [GOV.UK, resumen de errores](https://design-system.service.gov.uk/components/error-summary/), [W3C, WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) y [OWASP, riesgos CSV](https://community.owasp.org/attacks/CSV_Injection).

## 01 · Entrada al producto

- [   ] **P001** · Primera frase centrada en el problema del cliente · PENDIENTE
- [   ] **P002** · CTA inicial para probar una simulación · PENDIENTE
- [   ] **P003** · Demostración visible sin iniciar sesión · PENDIENTE
- [   ] **P004** · Vista previa de resultados antes de cargar archivos · PENDIENTE
- [   ] **P005** · Guía de tres pasos sin tecnicismos · PENDIENTE
- [   ] **P006** · Ejemplo listo al abrir por primera vez · PENDIENTE
- [   ] **P007** · Indicador claro de que no hay integración real · PENDIENTE
- [   ] **P008** · Comparación entre servicio y herramienta demostrada · PENDIENTE
- [   ] **P009** · Entrada rápida para quien ya dispone de datos · PENDIENTE
- [   ] **P010** · Resumen de valor por tipo de empresa · PENDIENTE

## 02 · Recorrido comercial

- [   ] **P011** · Rutas de entrada por problema empresarial · PENDIENTE
- [   ] **P012** · Ruta de comprador que no conoce tecnología · PENDIENTE
- [   ] **P013** · Ruta de responsable de operaciones · PENDIENTE
- [   ] **P014** · Ruta de analista de datos · PENDIENTE
- [   ] **P015** · Ruta de soporte al cliente · PENDIENTE
- [   ] **P016** · CTA contextual tras detectar bloqueos · PENDIENTE
- [   ] **P017** · CTA contextual tras preparar una cola · PENDIENTE
- [   ] **P018** · Enlace a caso relacionado con el escenario · PENDIENTE
- [   ] **P019** · Estimación de alcance basada en requisitos reales · PENDIENTE
- [   ] **P020** · Revisión final del brief antes del envío · PENDIENTE

## 03 · Ejemplos interactivos

- [ x ] **P021** · Ejemplo original de pedidos con incidencias · IMPLEMENTADO
- [ x ] **P022** · Ejemplo de pedidos sin bloqueos · IMPLEMENTADO
- [ x ] **P023** · Ejemplo de pedidos con duplicados · IMPLEMENTADO
- [ x ] **P024** · Ejemplo de pedidos con campos vacíos · IMPLEMENTADO
- [ x ] **P025** · Ejemplo de pedidos para revisión humana · IMPLEMENTADO
- [ x ] **P026** · Ejemplo de pedidos con valores límite · IMPLEMENTADO
- [ x ] **P027** · Ejemplo original de soporte · IMPLEMENTADO
- [ x ] **P028** · Ejemplo de soporte sin bloqueos · IMPLEMENTADO
- [ x ] **P029** · Ejemplo de soporte con duplicados · IMPLEMENTADO
- [ x ] **P030** · Ejemplo de soporte con campos vacíos · IMPLEMENTADO

## 04 · Más ejemplos interactivos

- [ x ] **P031** · Ejemplo de soporte para revisión humana · IMPLEMENTADO
- [ x ] **P032** · Ejemplo de soporte con estados límite · IMPLEMENTADO
- [ x ] **P033** · Ejemplo original de conciliación · IMPLEMENTADO
- [ x ] **P034** · Ejemplo de conciliación sin bloqueos · IMPLEMENTADO
- [ x ] **P035** · Ejemplo de conciliación con duplicados · IMPLEMENTADO
- [ x ] **P036** · Ejemplo de conciliación con campos vacíos · IMPLEMENTADO
- [ x ] **P037** · Ejemplo de conciliación con valores negativos · IMPLEMENTADO
- [ x ] **P038** · Ejemplo de conciliación con fechas y cifras límite · IMPLEMENTADO
- [ x ] **P039** · Selector descriptivo de ejemplos · IMPLEMENTADO
- [ x ] **P040** · Cambio de ejemplo con confirmación explícita · IMPLEMENTADO

## 05 · Importación local

- [ x ] **P041** · Descarga de plantilla CSV ficticia de pedidos · IMPLEMENTADO
- [ x ] **P042** · Descarga de plantilla CSV ficticia de soporte · IMPLEMENTADO
- [ x ] **P043** · Descarga de plantilla CSV ficticia de datos · IMPLEMENTADO
- [   ] **P044** · Lectura de CSV solo dentro del navegador · PENDIENTE
- [   ] **P045** · Aviso de usar datos anonimizados · PENDIENTE
- [   ] **P046** · Límite de tamaño antes de leer el archivo · PENDIENTE
- [   ] **P047** · Conservar archivo anterior cuando falla la carga · PENDIENTE
- [   ] **P048** · Vigilancia de cambio de escenario durante lectura · PENDIENTE
- [   ] **P049** · Resaltar encoding no UTF-8 antes de aceptar · PENDIENTE
- [ x ] **P050** · Compatibilidad controlada con TSV · IMPLEMENTADO

## 06 · Mapeo de columnas

- [   ] **P051** · Proponer equivalencias de encabezados ES/EN · PENDIENTE
- [   ] **P052** · Permitir cambiar cada propuesta · PENDIENTE
- [   ] **P053** · Mostrar columnas omitidas antes de aplicar · PENDIENTE
- [   ] **P054** · Previsualizar filas transformadas · PENDIENTE
- [   ] **P055** · Conservar ceros iniciales de identificadores · PENDIENTE
- [   ] **P056** · Impedir mapear una columna dos veces · PENDIENTE
- [   ] **P057** · Mantener CSV anterior mientras no se confirme · PENDIENTE
- [   ] **P058** · Aclarar campos obligatorios sin equivalente · PENDIENTE
- [   ] **P059** · Perfiles de mapeo descargables sin datos · PENDIENTE
- [   ] **P060** · Confirmación cuando se descarta una columna adicional · PENDIENTE

## 07 · Validación de filas

- [   ] **P061** · Bloqueo de identificadores vacíos · PENDIENTE
- [   ] **P062** · Detección de duplicados sin diferenciar mayúsculas · PENDIENTE
- [   ] **P063** · Validación de correos de pedidos · PENDIENTE
- [   ] **P064** · Importes positivos en pedidos · PENDIENTE
- [   ] **P065** · Fechas calendario existentes · PENDIENTE
- [   ] **P066** · Estados cerrados apartados de nuevas acciones · PENDIENTE
- [   ] **P067** · Escalado humano de tickets urgentes · PENDIENTE
- [   ] **P068** · Revisión humana de valores negativos · PENDIENTE
- [   ] **P069** · Diferenciar duplicado idéntico de conflicto · PENDIENTE
- [   ] **P070** · Comprobar moneda y separadores regionales · PENDIENTE

## 08 · Corrección guiada

- [ x ] **P071** · Descripción legible de los 13 campos · IMPLEMENTADO
- [ x ] **P072** · Ejemplos visibles para los 13 campos · IMPLEMENTADO
- [ x ] **P073** · Marcar el campo que provocó el bloqueo · IMPLEMENTADO
- [ x ] **P074** · Enfocar el campo problemático al abrir edición · IMPLEMENTADO
- [ x ] **P075** · Opciones sugeridas para estados y prioridad · IMPLEMENTADO
- [ x ] **P076** · Volver a procesar todas las filas tras editar · IMPLEMENTADO
- [ x ] **P077** · Deshacer la última corrección · IMPLEMENTADO
- [ x ] **P078** · Rehacer la corrección deshecha · IMPLEMENTADO
- [   ] **P079** · Historial de hasta 20 correcciones · PENDIENTE
- [   ] **P080** · Vista previa de efectos antes de guardar cambios · PENDIENTE

## 09 · Búsqueda y filtros

- [ x ] **P081** · Buscar por ID, motivo y acción · IMPLEMENTADO
- [ x ] **P082** · Filtrar por listos, revisión o bloqueados · IMPLEMENTADO
- [ x ] **P083** · Mostrar conteos en las cuatro pestañas de filtro · IMPLEMENTADO
- [ x ] **P084** · Ordenar por prioridad de incidencias · IMPLEMENTADO
- [ x ] **P085** · Ordenar por identificador con números · IMPLEMENTADO
- [ x ] **P086** · Ordenar por estado · IMPLEMENTADO
- [ x ] **P087** · Restaurar el orden original · IMPLEMENTADO
- [ x ] **P088** · Mostrar estado vacío al no encontrar resultados · IMPLEMENTADO
- [   ] **P089** · Guardar vistas de filtros sin datos sensibles · PENDIENTE
- [ x ] **P090** · Exportar únicamente la vista filtrada · IMPLEMENTADO

## 10 · Tabla de auditoría

- [ x ] **P091** · Conservar referencia al índice original al ordenar · IMPLEMENTADO
- [ x ] **P092** · Editar la fila correcta tras ordenar · IMPLEMENTADO
- [ x ] **P093** · Mantener encabezados visibles al desplazarse · IMPLEMENTADO
- [   ] **P094** · Mostrar densidad compacta u holgada · PENDIENTE
- [   ] **P095** · Permitir personalizar columnas visibles · PENDIENTE
- [   ] **P096** · Mostrar detalles completos de cada registro · PENDIENTE
- [   ] **P097** · Resaltar filas al navegar con teclado · PENDIENTE
- [   ] **P098** · Navegar al siguiente bloqueo desde una fila · PENDIENTE
- [   ] **P099** · Comparar dos registros adyacentes · PENDIENTE
- [   ] **P100** · Mostrar acciones sin scroll horizontal en móvil · PENDIENTE

## 11 · Calidad de datos

- [ x ] **P101** · Calcular integridad de celdas rellenadas · IMPLEMENTADO
- [ x ] **P102** · Desglose de campos incompletos · IMPLEMENTADO
- [ x ] **P103** · Advertir que integridad no equivale a exactitud · IMPLEMENTADO
- [ x ] **P104** · Mostrar faltantes por columna · IMPLEMENTADO
- [   ] **P105** · Contar identificadores únicos · PENDIENTE
- [   ] **P106** · Contar claves conflictivas · PENDIENTE
- [   ] **P107** · Detectar distribución de valores numéricos · PENDIENTE
- [   ] **P108** · Comprobar formatos de fecha por columna · PENDIENTE
- [   ] **P109** · Identificar patrones de valores atípicos · PENDIENTE
- [   ] **P110** · Medir evolución de calidad entre dos ejecuciones · PENDIENTE

## 12 · Comprensión de resultados

- [   ] **P111** · Separar acciones propuestas e históricos · PENDIENTE
- [   ] **P112** · Explicar bloqueos y revisiones humanas · PENDIENTE
- [   ] **P113** · Mostrar distribución de estados · PENDIENTE
- [   ] **P114** · Priorizar la corrección más repetida · PENDIENTE
- [   ] **P115** · Navegar desde recomendación hasta filtro · PENDIENTE
- [   ] **P116** · Comparación real antes/después de una corrección · PENDIENTE
- [   ] **P117** · Enseñar qué reglas causaron cada resultado · PENDIENTE
- [   ] **P118** · Mostrar impacto agregado por tipo de error · PENDIENTE
- [   ] **P119** · Comparar dos conjuntos de datos sin guardarlos · PENDIENTE
- [   ] **P120** · Representar un flujo paso a paso con eventos · PENDIENTE

## 13 · Exportaciones

- [ x ] **P121** · CSV completo separado de cola preparada · IMPLEMENTADO
- [ x ] **P122** · Cola de acciones excluye históricos · IMPLEMENTADO
- [ x ] **P123** · Cola de acciones excluye bloqueados · IMPLEMENTADO
- [ x ] **P124** · Cola de acciones excluye revisión humana · IMPLEMENTADO
- [ x ] **P125** · Indicador explícito NO ejecutado · IMPLEMENTADO
- [ x ] **P126** · Informe de simulación sin filas ni emails · IMPLEMENTADO
- [ x ] **P127** · Plantilla descargable con filas ficticias · IMPLEMENTADO
- [   ] **P128** · Aviso de datos sensibles en exportación completa · PENDIENTE
- [   ] **P129** · Exportar informe legible como PDF · PENDIENTE
- [   ] **P130** · Exportar resumen comercial estructurado · PENDIENTE

## 14 · Accesibilidad

- [ x ] **P131** · Atajo Ctrl+Intro para ejecutar CSV · IMPLEMENTADO
- [ x ] **P132** · Escape cierra paneles secundarios · IMPLEMENTADO
- [ x ] **P133** · Enfoque en error de entrada tras fallo · IMPLEMENTADO
- [ x ] **P134** · Etiquetas específicas de campos de edición · IMPLEMENTADO
- [ x ] **P135** · Texto de ayuda conectado a cada campo · IMPLEMENTADO
- [   ] **P136** · Estados erróneos anunciados como texto · PENDIENTE
- [   ] **P137** · Objetivos táctiles suficientemente grandes · PENDIENTE
- [   ] **P138** · Probar navegación de teclado sin ratón · PENDIENTE
- [   ] **P139** · Restaurar foco al cerrar el editor · PENDIENTE
- [   ] **P140** · Revisar contraste en todas las tarjetas claro/oscuro · PENDIENTE

## 15 · Seguridad y privacidad

- [ x ] **P141** · Enlace compartible sin registros importados · IMPLEMENTADO
- [   ] **P142** · Procesamiento local y sin peticiones a CRM · PENDIENTE
- [   ] **P143** · Sin almacenar filas en la URL · PENDIENTE
- [   ] **P144** · Neutralizar fórmulas en CSV según límites conocidos · PENDIENTE
- [   ] **P145** · No enviar datos sin consentimiento · PENDIENTE
- [   ] **P146** · No introducir emails reales en los ejemplos · PENDIENTE
- [   ] **P147** · Aviso al exportar CSV detallado · PENDIENTE
- [   ] **P148** · Eliminar datos locales explícitamente · PENDIENTE
- [   ] **P149** · Revisión de dependencias externas del importador · PENDIENTE
- [   ] **P150** · Documentar amenazas y mitigaciones residuales · PENDIENTE

## 16 · Experiencia móvil

- [ x ] **P151** · Selector de ejemplos responsivo · IMPLEMENTADO
- [ x ] **P152** · Ordenación accesible en pantallas pequeñas · IMPLEMENTADO
- [ x ] **P153** · Campos de edición apilados con ayuda · IMPLEMENTADO
- [   ] **P154** · Tabla con desplazamiento horizontal explícito · PENDIENTE
- [   ] **P155** · Encabezado que conserva el contexto móvil · PENDIENTE
- [   ] **P156** · Botones de acción sin desbordamiento · PENDIENTE
- [   ] **P157** · Lectura visual de calidad sin zoom · PENDIENTE
- [   ] **P158** · Atajos táctiles para resolver bloqueos · PENDIENTE
- [   ] **P159** · Indicadores legibles con texto aumentado · PENDIENTE
- [   ] **P160** · Prueba con 320 px y 400 % de zoom · PENDIENTE

## 17 · Rendimiento

- [ x ] **P161** · No importar módulos pesados en portada · IMPLEMENTADO
- [ x ] **P162** · Ejecutar los ejemplos en navegador sin servidor · IMPLEMENTADO
- [ x ] **P163** · Tamaño máximo de entradas CSV · IMPLEMENTADO
- [ x ] **P164** · Límite de 80 registros por ejecución · IMPLEMENTADO
- [ x ] **P165** · Actualizar la tabla sin HTML no confiable · IMPLEMENTADO
- [   ] **P166** · Evitar recomputar mapas en cada pulsación · PENDIENTE
- [   ] **P167** · Retrasar vistas secundarias hasta pedirlas · PENDIENTE
- [   ] **P168** · Analizar el perfil móvil de la demo · PENDIENTE
- [   ] **P169** · Reducir coste de renderizado de tablas largas · PENDIENTE
- [   ] **P170** · Presupuestos de rendimiento para cada escenario · PENDIENTE

## 18 · Confianza comercial

- [   ] **P171** · No atribuir resultados ficticios a clientes · PENDIENTE
- [   ] **P172** · No afirmar ROI sin datos verificados · PENDIENTE
- [   ] **P173** · Explicar qué significa listo frente a ejecutado · PENDIENTE
- [   ] **P174** · Enlazar casos reales con pruebas públicas · PENDIENTE
- [   ] **P175** · Clarificar el alcance de pruebas gratuitas · PENDIENTE
- [   ] **P176** · Explicar precio orientativo sin promesas · PENDIENTE
- [   ] **P177** · Mostrar de forma humana cómo sería la implantación · PENDIENTE
- [   ] **P178** · Ofrecer un entregable claro después del diagnóstico · PENDIENTE
- [   ] **P179** · Exponer políticas de soporte y mantenimiento · PENDIENTE
- [   ] **P180** · Confirmar recepción sin confundir envío con lectura · PENDIENTE

## 19 · Fiabilidad y producto

- [ x ] **P181** · Pruebas unitarias de todos los 18 ejemplos · IMPLEMENTADO
- [ x ] **P182** · Pruebas de ayuda contextual por columna · IMPLEMENTADO
- [ x ] **P183** · Pruebas de ordenación estable · IMPLEMENTADO
- [ x ] **P184** · Prueba de integridad de celdas · IMPLEMENTADO
- [ x ] **P185** · Prueba de rehacer una edición en navegador · IMPLEMENTADO
- [ x ] **P186** · Prueba de enlace compartible sin datos · IMPLEMENTADO
- [ x ] **P187** · Prueba de errores CSV con foco accesible · IMPLEMENTADO
- [ x ] **P188** · Prueba real de flujo en Chrome y Firefox · IMPLEMENTADO
- [   ] **P189** · Prueba de archivos con separadores regionales · PENDIENTE
- [   ] **P190** · Recorrido de usuario con tecnologías de asistencia · PENDIENTE

