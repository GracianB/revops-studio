# RevOps PR76 · Scenario Builder seguro

> **Contexto histórico anterior a V104.** Este documento conserva el diseño y las condiciones de su PR original. Su contenido quedó integrado en la rama principal con `90371736c2636f1807382ddbd077baff9b9a019c`; las menciones a borrador, bloqueo de integración o ausencia de publicación corresponden a aquella etapa. Consulta [Publicación V104](V104-PUBLICACION-SITIO.md) para el alcance vigente. Los límites sobre integraciones reales, datos de clientes y aprobaciones externas siguen vigentes. El despliegue público actual requiere su propia comprobación HTTPS.

**Estado:** implementación de desarrollo en borrador, sobre PR75. No fusionar ni desplegar.

## Resultados funcionales

1. Punto de partida del mismo CSV: ejecución del motor V40 sin alterar entradas.
2. Variante para pedidos: importes positivos por debajo de un umbral validado pasan adicionalmente a revisión humana.
3. Variante para soporte: prioridad media abierta pasa a revisión, sin alterar alta, duplicados o cerrados.
4. Variante para datos: cifras superiores a un umbral acotado requieren revisión, sin alterar negativos o errores.
5. Presets inicial, cauteloso y estricto, con límites explícitos.
6. Edición manual de un único control por escenario; se rechazan parámetros no reconocidos.
7. Comparación agregada de propuestas listas, bloqueos y revisiones sobre las mismas filas.
8. Identificación por posición de qué filas recibirían revisión adicional, sin exportar sus valores.
9. Preservación comprobada de TODOS los bloqueos originales.
10. Preservación comprobada de todas las revisiones previas y casos históricos.
11. Reversión instantánea a las reglas originales sin tocar el CSV.
12. Exportación JSON de configuración únicamente (versión, escenario, parámetro y estado NO EJECUTADO).
13. Importación de perfiles con tamaño, estructura, escenario y tipos validados estrictamente.
14. Informe TXT agregado de consecuencias y límites, sin filas, IDs o emails.
15. Carga bajo demanda de JS y cierre accesible con restauración de foco.
16. Pruebas automáticas en los 18 ejemplos, borde numérico, plantillas, reversión y Chrome/Firefox/móvil.

## Política irreversible dentro de la simulación

- Los cambios candidatos solo pasan de «listo» a «revisar». Jamás de «bloqueado» o «revisar» a «listo».
- Ninguna variante habilita bypass de validaciones, desactiva controles o ejecuta colas.
- El resultado del motor original es la línea base real de la demo, pero no una medición empresarial real.
- Umbral 0 equivale a control adicional desactivado. Enteros entre 0 y 5.000 únicamente.
- Las acciones preparadas no se consideran ejecutadas; no hay identidad real ni aprobación humana verificada.
- No se almacena la muestra en plantillas o informes ni se conecta con CRM/ERP.
- La configuración del candidato no modifica la tabla ni las anotaciones del PR75.
- El repositorio sigue público aunque la PR sea draft.

## Pruebas y aceptación

`npm run verify`, regresión V40, 18 conjuntos de ejemplo con preset base, umbrales y estados de revisión, rechazo de plantilla corrupta o ajena, E2E en Chrome y Firefox incluyendo exportación y rollback, presupuestos de rendimiento sin relajación. No merge/deploy.
