# PR103 · Aceptación humana y secuencia controlada de integración

**Estado: CANDIDATO, NO AUTORIZADO PARA PRODUCCIÓN.** Documento operativo, no aprobación ni resultado de una evaluación con usuarios.

## 1. Arquitectura y objetivo

El producto acumuló muchos controles reales; PR101 disminuyó la sobrecarga y PR102 explicó el antes/después de una corrección. PR103 aborda la incógnita restante: ¿pueden personas ajenas al desarrollo completar tareas esenciales y entender las fronteras de seguridad sin que nadie les explique la interfaz?

Se ofrece `evaluacion.html`, una sala de observación **local y anónima** para pruebas presenciales o remotas moderadas. El observador abre las tareas en pestañas nuevas, mide tiempos con una herramienta externa y registra únicamente resultado (`completed`, `failed`, `blocked`), ayuda recibida (`none`, `hint`, `guided`) y segundos enteros (1–3600). No se solicitan nombres, notas libres, archivos de clientes ni credenciales. **No existe almacenamiento permanente ni backend**: cerrar o recargar la página pierde las observaciones no exportadas. El interruptor de tema preexistente puede recordar exclusivamente el tema.

Los resultados declarados se exportan como JSON/TXT sin identidades, utilizando la lista positiva de esquemas de PR96. En ningún caso una casilla cumplimentada prueba una evaluación independiente o libera el producto a producción.

## 2. Matriz de participantes, evidencia y mínimos

La sala incorpora 15 pruebas observables. Para que la muestra sea representativa conviene reclutar al menos tres personas **distintas y ajenas al desarrollo**, idealmente una por perfil; una sola persona marcando todos los pasos no constituye la prueba requerida.

| Perfil | 5 tareas | Criterios de observación |
|---|---|---|
| Responsable de operaciones | Identificar problema, distinguir bloqueado/revisar/preparado, corregir, reconocer la ausencia de ejecución externa, localizar contacto | Comprende la propuesta sin vocabulario técnico ni expectativas de automatización real |
| Analista de datos | Abrir avanzado, cargar muestra, explicar reglas, corregir con trazabilidad, exportar sin filas sensibles | Reconstruye decisiones reales del motor y comprende el alcance de las descargas |
| Móvil y accesibilidad | Usar 320 px, teclado/foco, preferencias de contraste, privacidad, lector de pantalla real | Sin desplazamiento horizontal ni trampas de foco; verificar resultados manuales, nunca asumir conformidad WCAG |

El protocolo define un **tiempo objetivo indicativo** para cada tarea, entre 120 y 360 segundos, como criterio de fricción para la siguiente entrevista, no como garantía comercial ni SLA. Ayuda recibida o superación del tiempo objetivo se registran por separado: no se ocultan detrás de un estado «completada». Las personas observadoras revisarán y resolverán los fallos cualitativos mediante su procedimiento autorizado, sin incluir datos sensibles en estos informes.

### Procedimiento recomendado

1. Abrir `evaluacion.html` (protocolo de revisión, no la home de clientes) y seleccionar un perfil.
2. Explicar que se usarán **solo ejemplos ficticios**; obtener consentimiento para participar según los procedimientos internos aplicables.
3. Leer en voz alta la tarea, no su respuesta esperada, y abrir su enlace. El observador toma tiempo manualmente.
4. Anotar resultado, grado de ayuda y duración. Si se detecta un fallo, registrarlo de manera segura **fuera** de esta demo, sin información identificativa de clientes.
5. Repetir cinco tareas y exportar JSON/TXT. Antes de compartir el informe, revisar los datos y seguir el proceso de custodia aprobado.
6. Completar los tres perfiles y someter resultados a revisión externa. Un registro completo no equivale a una firma ni una auditoría.
7. Verificar independientemente NVDA/Firefox, VoiceOver/Safari, zoom real, alto contraste, orientación táctil y comprensión de mensajes. El protocolo no certifica WCAG.

## 3. Gate técnico PR103

`node scripts/pr103-acceptance.mjs` valida desde cero la estructura del procedimiento, rutas, interfaz de evaluación, inventario, enlace desde el candidato V100, cobertura Chrome/Firefox y bloqueo explícito de producción. Genera `.ci-artifacts/pr103-uat-preparation.json`.

**Importante:** este artefacto siempre registra `observedRealParticipants: 0`, `verifiedHumanStudies: 0`, `verifiedManualAccessibility: 0`, `productionGo: false`. Una CI verde significa que **está preparado el procedimiento**, nunca que personas externas lo hayan completado.

`tests/pilot-uat-protocol.test.js` cubre 15 tareas, tres perfiles, integridad de la sesión, errores, privacidad y negativa a autorizar producción incluso si se declaran 15 completadas. `tests/pr103-acceptance.test.js` comprueba fallos cerrados. `scripts/browser-smoke.mjs` prueba la pantalla realmente en Chromium y Firefox, exportación, reset, 320 px y accesibilidad automática.

## 4. Integración de ramas y restricciones

El 12 de octubre de 2026 se comprobaron en GitHub las PR79–PR102: todas abiertas en borrador, cada una basada en la rama anterior, sin integración en `main`. PR103 se añade **encima de PR102**. No se deben fusionar arbitrariamente las últimas PR contra `main`: siguen existiendo antecedentes desde la PR41 y la primera rama de esta secuencia que desciende de V40.

Orden seguro sujeto a revisión: comprobar **toda** la cadena desde el primer PR pendiente que nace de `main`, verificar diferencias/mergeability/CI en cada cabeza, realizar revisión humana por fases y solo entonces promover las ramas en orden. Retarget de bases y cierre de PR tras merges son operaciones deliberadas, no automáticas. Evitar fusionar PR103 antes de sus dependencias.

**Bloqueos de publicación que requieren pruebas externas:**
- Pruebas reales de aceptación, con problemas documentados y comprobación independiente.
- Ocho verificaciones manuales de accesibilidad PR98; no deben expresarse como completadas tras axe/Playwright.
- Privacidad y seguridad independientes para datos reales.
- Verificación de integración con herramientas autorizadas, control de permisos y plan de reversión realmente probado.
- Aprobación explícita empresarial y de responsables del tratamiento donde proceda.
- Pruebas finales sobre un despliegue de candidato aislado, no sobre la rama principal pública.

### Reglas de decisión

Si falta cualquier gate externo: **NO-GO**. Si la muestra automatizada es verde pero falla una sesión humana: **NO-GO**. Si la revisión externa pasa pero aparece un fallo de permisos o privacidad: **NO-GO**. Solo responsables humanos podrán autorizar una publicación tras comprobar las condiciones anteriores fuera de esta simulación.

## 5. Alcance honesto de las afirmaciones

Estos cambios no constituyen una auditoría WCAG formal, prueba en red corporativa, evaluación legal, validación con personas, certificado criptográfico ni publicación. La aplicación almacena únicamente códigos y tiempos de la sesión en memoria hasta exportación. Se prueba con ejemplos sintéticos y nunca se ejecutan acciones en CRM/ERP reales.

**Resultado deseado:** pasar de una demo técnica defendible a un candidato entendible, evaluable y demostrable sin confundir desarrollo completado con aprobación.
