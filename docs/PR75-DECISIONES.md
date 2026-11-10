# RevOps PR75 · Rules & Human Decision Studio

> **Contexto histórico anterior a V104.** Este documento conserva el diseño y las condiciones de su PR original. Su contenido quedó integrado en la rama principal con `90371736c2636f1807382ddbd077baff9b9a019c`; las menciones a borrador, bloqueo de integración o ausencia de publicación corresponden a aquella etapa. Consulta [Publicación V104](V104-PUBLICACION-SITIO.md) para el alcance vigente. Los límites sobre integraciones reales, datos de clientes y aprobaciones externas siguen vigentes. El despliegue público actual requiere su propia comprobación HTTPS.

**Estado:** PR en borrador basada en PR74. No fusionar ni publicar.

## Diseño estructural

El motor `workflow-engine.js` y la auditoría utilizan el mismo `workflow-policy.js`: un registro ordenado de 9 reglas para pedidos, 8 para soporte y 7 para datos. La primera regla aplicable determina exactamente estado, motivo y acción del motor. Cada regla tiene ID estable, precedencia, campo asociado, tipo de decisión y razón explicable.

## Capacidades comprobables

1. Registro de reglas por escenario, con ID, campo, razón y precedencia.
2. Motor de validación y trazabilidad basados en el MISMO catálogo, sin traducciones aproximadas.
3. Prioridad estricta de identificador vacío y duplicados antes de reglas específicas.
4. Trazabilidad de cada fila con regla ganadora, posición y estado.
5. Detección de condiciones simultáneas y reglas restrictivas eclipsadas.
6. Recuento por regla: aplicaciones efectivas y bloqueos secundarios.
7. Cobertura de reglas aplicadas sobre los mismos registros procesados.
8. Navegación de un conflicto a la fila y al editor ya existente.
9. Bandeja de revisión humana limitada a los casos marcados «revisar».
10. Estado local de revisión: pendiente y en revisión.
11. Anotación de aprobación simulada con justificación suficiente, sin identidad verificada.
12. Rechazo simulado con justificación suficiente, sin ejecución externa.
13. Prohibición de aprobar filas bloqueadas o preparadas.
14. Aprobación simulada NO modifica estados de motor ni exportación de acciones.
15. Invalida anotaciones al modificar origen, escenario o resultado.
16. Exportación TXT agregada sin filas, emails, identificadores ni justificaciones.
17. Carga opcional de consola: sin descarga inicial adicional para la primera visita.
18. Interfaz responsive y navegación de teclado, con etiquetas y estados accesibles.
19. Equivalencia de reglas probada en los 18 conjuntos de ejemplo, más casos conflictivos.
20. Pruebas de navegador con intento de aprobación sin motivo, invalidación y descarga segura.

## Restricciones verificables

- No hay firma, autenticación ni verificación de identidad: son anotaciones demostrativas.
- No se implementa conexión, envío, autenticación o aprobación real en CRM/ERP.
- La prioridad de una regla puede ocultar restricciones inferiores; se explican pero no se reordenan.
- La aprobación simulada no autoriza una acción, no reduce la revisión del motor y no cambia cola preparada.
- La documentación agregada omite los textos de justificación introducidos.
- Los datos y las anotaciones viven solo en memoria; cambiar el CSV invalida las anotaciones.
- Ningún número se presenta como ahorro/ROI.
- El repositorio es público en GitHub aunque la PR sea draft.

## Criterios de aceptación

- `npm run verify` con equivalencia íntegra respecto al motor anterior y release gate V40.
- Todas las pruebas unitarias PR75, incluidos bloqueos, reglas simultáneas, rechazos, informes y datos obsoletos.
- Chrome y Firefox: E2E auditando precedencia, justificación, cola excluyente, descarga limpia, invalidación, móvil.
- No aumentar los presupuestos de rendimiento ni autorizar un despliegue desde la PR.
