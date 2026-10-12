# RevOps PR71 · Discovery Studio

## Estado
Desarrollo en rama apilada sobre la PR70 (que a su vez depende de R1). **Borrador, no fusionar ni desplegar**. No equivale a oferta ni integración.

## Funcionalidades verificables que aporta PR71

1. **Cuatro perfiles de decisión**: dirección, operaciones, analítica y soporte, con interpretación contextual.
2. **Resultado buscado**: pasos manuales, errores, fiabilidad de información o trazabilidad.
3. **Prioridad temporal**: exploración, objetivo trimestral o urgencia sin asumir fechas.
4. **Madurez del proceso**: desconocido, documentado o alcance preliminar acordado.
5. **Responsable de aceptación**: conocido, pendiente o desconocido, con bloqueo explícito para el piloto.
6. **Datos de prueba**: disponibles, incompletos o inexistentes; sin promesas de impacto sin datos.
7. **Dependencia de integraciones**: aislado, por evaluar u obligatorio; nunca afirma que un CRM esté conectado.
8. **Sensibilidad**: ejemplos anónimos, información interna o datos personales/sensibles; la tercera activa revisión formal antes del piloto.
9. **Tres notas editables de alcance**: objetivo, condición y exclusión, con longitud máxima.
10. **Viabilidad condicional**: análisis de huecos y riesgos reproducible por reglas, sin porcentajes de confianza inventados.
11. **Tres fases y cuatro criterios de aceptación** ligados al diagnóstico de R1.
12. **Brief completo revisable y editable**, con protección al cambiar las condiciones: ediciones humanas no se reemplazan en silencio.
13. **Descargas locales TXT y JSON**; ambas requieren clic, y JSON refleja también el texto modificado.
14. **Enlace de demo recomendado por escenario**, sin información introducida por el usuario en el URL.
15. **Handoff explícito de un extracto al formulario**, sin tocar mensajes/servicios ya escritos, con consentimiento requerido para enviar.
16. **Invalidación de brief desactualizado** si cambian los parámetros después de adjuntarlo.
17. **Interfaz adaptable y foco restaurado** al cerrar el panel.
18. **Carga diferida de JS y CSS** solo al abrir Discovery Studio, para no incrementar las peticiones de la primera visita.

Los puntos anteriores constituyen resultados útiles, no cambios de estilo contados artificialmente.

## Comportamiento de privacidad

- La página opera localmente hasta que la persona decide enviar el formulario de contacto existente.
- Ni el brief ni las notas se almacenan en servidor por generar, editar, copiar o descargar.
- El JSON y el TXT incluyen lo que el visitante escribió **solo al descargarlos conscientemente**. No deben incluirse datos confidenciales.
- El traspaso adjunta un **extracto limitado** para mantener un tamaño manejable y no sustituye el campo de mensaje redactado por el visitante.
- No hay subida de archivos, CRM, ERP, fuentes de datos externas ni envío automático en este flujo.
- La web y el repositorio GitHub son actualmente públicos; una PR en borrador no es control de privacidad del código.

## Controles de aceptación

- Unitarias: 48 rutas R1 ampliadas, 16 cruces de roles y resultados, restricciones de muestra/aprobación, entrada inválida, sanitización, exportación determinista y mapeo de demo.
- Chrome y Firefox: carga diferida, vista móvil, estados, guardado de edición, bloqueo de exportaciones obsoletas, regeneración, TXT/JSON, traspaso voluntario, no sobrescritura y limpieza del extracto desactualizado.
- Validación del sitio, contrato de JS ligero, regresión del motor V40, smoke de interfaz y presupuestos de rendimiento.
- Ninguna fusión o despliegue sin aprobación de publicación.
