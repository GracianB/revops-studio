# RevOps Studio · Auditoría integral de experiencia del candidato V100

**Ámbito:** código actual de la rama candidata V100, cubriendo la web pública, la demostración de procesos, el laboratorio, privacidad y confirmación. La revisión cruza arquitectura del núcleo V1–V40 con las capacidades acumuladas hasta la PR100. **No** afirma haber repetido manualmente todas las versiones históricas ni haber auditado despliegues que permanecen sin publicar.

**Decisión:** candidato técnico de demostración, **NO AUTORIZADO PARA PRODUCCIÓN**. `main` sigue en V40. Este trabajo queda en PR de borrador, independiente de una decisión de lanzamiento.

## 1. Hallazgos y acciones realizadas

| Severidad | Hallazgo comprobable | Solución desarrollada | Verificación |
|---|---|---|---|
| Alta · P1 | La consola de piloto acumulaba decenas de controles, informes, listas y métricas en una única vista de más de 20 KB de HTML. El usuario debía recorrer contenido técnico antes de distinguir la siguiente decisión. | **Vista esencial por defecto** con el tablero ejecutivo V100 y solo tres prioridades. Análisis completo accesible bajo demanda. | Prueba real Chrome/Firefox: visibilidad inicial, control de expansión, foco, teclado y regreso al resumen. |
| Alta · P1 | Los informes, riesgos y ensayos aparecían a la vez que el resumen. Se duplicaba la información y era difícil distinguir qué era decisión y qué era evidencia técnica. | Jerarquía progresiva: etapa/estado, próximos pasos, riesgos clave y, después, herramientas completas. Se mantienen intactos cálculos y límites de autorización. | Módulo `pilot-ux-progressive.js` más pruebas unitarias y de navegador. |
| Alta · P1 | Una acción priorizada desde el resumen podía llevar a un título dentro de una zona plegada. | Las acciones ejecutan primero la apertura del detalle, después trasladan el foco al control de destino. | Flujos PR92 y V100 comprobados en navegador. |
| Media · P2 | Privacidad y confirmación carecían de atajo accesible al contenido, a diferencia de portada y demo. | Enlace “Saltar al contenido”, destino `main` y foco programático. | Auditoría automática de las cinco páginas; pruebas de enlaces y destinos. |
| Media · P2 | El laboratorio mezclaba títulos en inglés y español, aunque la experiencia comercial se dirige en español. | Textos naturales y coherentes para guía de 60 segundos, explicación de decisiones, estados vacíos e historial. | Revisión de texto y regresiones de laboratorio. |
| Media · P2 | Los enlaces internos de la web no disponían de una comprobación transversal y reproducible en el pipeline específico de V100. | Analizador de cinco páginas: destinos locales, anclas, IDs duplicados, navegación etiquetada, H1, idioma, viewport y salto de teclado. | `node scripts/ux-audit.mjs` en CI con informe JSON conservado. |
| Media · P2 | El resumen podía ocultar demasiadas prioridades tras el cambio de vista. | Se muestran tres pasos de forma explícita, con texto que indica cuántos quedan y botón para verlos todos. | CSS responsive y pruebas de recuento/estado, con foco estable. |

## 2. Arquitectura y alcance funcional

La auditoría distingue cinco recorridos públicos y evita confundirlos:

1. **Portada (index.html):** problema, servicios, casos documentados y contacto.
2. **Primera visita (demo.html, modo simple):** problema reconocible → hallazgo → una corrección → resultado.
3. **Consola avanzada (demo.html, modo avanzado):** salida verificable del motor y preparación del piloto. Dentro de ella, la vista esencial permite interpretar la información sin cargar con cada tabla y checklist a primera vista.
4. **Laboratorio (laboratorio.html):** scoring, forecast, reglas, trazabilidad, evidencia y límites del motor V40, incluyendo un área avanzada plegable.
5. **Privacidad y confirmación:** destino claro, información sobre envío y regreso a la web.

Se mantienen las 18 muestras sintéticas existentes, el inventario técnico PR99 ampliado a 21 módulos de piloto, las verificaciones V100, la política de exportación y las fronteras de autorización. `npm run verify` conserva deliberadamente el contrato histórico V40.

## 3. Principios de diseño aplicados

- **Explicación antes que botones:** quién usa la vista, qué puede hacer y qué no.
- **Vista esencial como primera capa:** una decisión, riesgos relevantes y próximos pasos. No es un resumen inventado: usa el mismo motor que la consola técnica.
- **Profundidad opcional sin recorte funcional:** los controles avanzados siguen presentes, pero no saturan la primera lectura.
- **Teclado real:** botones nativos, `aria-expanded`, `aria-controls`, foco a la navegación al expandir, regreso al botón al plegar, enlace de salto en todas las páginas.
- **Lectura móvil:** vista ejecutiva y lista de prioridades en una columna, objetivos táctiles de 44 px y tablas avanzadas contenidas.
- **Privacidad por diseño:** modo de presentación en memoria, sin cuentas, persistencia, cookies nuevas o recopilación de CSV. Se conservan informes con lista positiva, cero firmas y cero ejecuciones externas.
- **Sin falsas señales de lanzamiento:** resultado NO-GO visible incluso cuando el atlas sintético completo está verde.

## 4. Pruebas incorporadas

`tests/pilot-ux-progressive.test.js`: modo inicial, contador de prioridades, alternancia, foco, cierre, reinicio, validación de entradas, integridad del DOM y no persistencia.

`tests/v100-ux-audit.test.js`: cinco superficies públicas, navegación local, anchors, duplicación de IDs, idioma, hitos, controles semánticos y pruebas negativas que deben fallar si se eliminan elementos esenciales.

`scripts/browser-smoke.mjs`: navegación real Chrome y Firefox, modo esencial inicial, tres pasos visibles, expansión, foco de teclado, regreso al resumen, enlaces profundos desde la ruta de remediación, exportaciones y móvil de 320 px. La CI mantiene presupuestos de rendimiento y validación de las 18 muestras.

`scripts/ux-audit.mjs`: genera `.ci-artifacts/v100-ux-audit.json` con resultado reproducible y observaciones. Es una auditoría **estructural**, no sustituye una sesión con usuarios ni una evaluación visual humana.

## 5. Pendientes que bloquean cualquier lanzamiento

**P0 externos:** autorización empresarial explícita, pruebas de integración/permisos/reversión reales, evaluación independiente de seguridad y privacidad. Las ocho pruebas manuales de accesibilidad de PR98 continúan pendientes: NVDA, VoiceOver, zoom real, alto contraste, teclado completo, dispositivos táctiles y comprensión de mensajes.

**P1 experiencia real:** probar con al menos tres perfiles humanos distintos: responsable de operaciones no técnico, analista que necesita corregir datos y persona que evalúa la demo en móvil. Registrar tiempo hasta identificar una decisión, errores de navegación, capacidad de encontrar la privacidad y comprensión de que NO-GO significa sin ejecución externa. No se han inventado resultados ni tiempos.

**P2 evolución posterior:** análisis visual comparativo con capturas, observación de sesiones reales con consentimiento, prueba manual de lectores de pantalla y revisión de textos restantes del laboratorio. Los avisos de longitud de HTML se consideran observaciones, no fallos inventados ni comparativas de rendimiento.

## 6. Criterio para cerrar esta PR

CI completa en verde para el commit final (tests Node, regresiones V40 y PR80/PR99/PR100, auditoría UX, navegador Chrome/Firefox, 320 px y rendimiento sintético). Revisión manual posterior independiente antes de cualquier publicación. Fusionar o desplegar no forma parte de esta PR.

**Resultado de la auditoría:** la simplificación inicial está implementada en código; su validación automatizada puede ser completa, pero la usabilidad y accesibilidad finales solo se demostrarán al ensayarlas con personas y dispositivos reales.
