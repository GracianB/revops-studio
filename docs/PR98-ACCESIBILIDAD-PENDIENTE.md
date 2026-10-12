# PR98 · Protocolo de accesibilidad pendiente, sin certificaciones falsas

**Objetivo:** facilitar un conjunto reproducible de controles estructurales y una lista concreta de pruebas manuales. La consola comprueba seis propiedades del DOM real: títulos navegables, ocho destinos accesibles, etiquetas de select, estados aria-live, firma externa deshabilitada y tablas con regiones desplazables identificadas.

Ocho pruebas de accesibilidad manual permanecen **siempre pendientes**, sin un botón para marcarlas artificialmente: teclado completo, NVDA + Firefox, VoiceOver + Safari, zoom real 200/400%, contraste alto, movimiento reducido, táctil/orientaciones y comprensión del estado NO-GO.

CSS: mejora la posición del foco respecto a la cabecera fija y respeta prefers-reduced-motion. Nueva exportación JSON local con seis resultados y ocho obligaciones, zero manualVerified y productionGo false. El esquema se incorpora a PR96 para impedir exportaciones desconocidas.

La prueba automática incluye fixtures DOM correcto y roto, ausencia de aprobación manual, privacidad y Chrome/Firefox con 6/6 controles y 8 tareas explícitamente pendientes. Los tests automatizados **no sustituyen** una auditoría WCAG humana.