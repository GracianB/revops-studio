# PR104 · Auditoría completa del grafo de integración RevOps Studio

**Fecha de comprobación:** 12 de octubre de 2026. **Producción:** NO-GO. **Promoción de ramas:** DETENIDA. **Operaciones realizadas:** lectura de metadata y código, creación de PR de auditoría. **Ninguna fusión ni publicación.**

## 1. Hallazgos verificados en GitHub

Se han consultado las 35 PR **#69 a #103**, sus nombres reales de ramas, commits de cabeza, bases, estado borrador y sus 35 comparaciones reales `base...head` mediante GitHub. El conjunto está encadenado desde `main` V40 (commit `c7e17ab4f314035db67f60c9eb1c394273e0bfe8`) hasta PR103, pero no todos los antecesores están sincronizados.

**PR79 es divergente frente a PR78:** `behind_by=1`, `ahead_by=17`, merge base `4a174f0ad7bb81eb5f680ed697fbfe166a4900ea`. El commit ausente es `56a96b1a4514782abdca8bd9184201a5fd29ee4e`: **«test(pr78): browser-native DOM selector uses :not([hidden]), not Playwright-only :visible»**.

No es una vulnerabilidad explotada ni evidencia de fallo de producción. Es **un riesgo real de integración**: PR79 se había creado desde un antecesor de PR78 antes de esta corrección; las ramas descendientes hasta PR103 tampoco contienen ese commit por descendencia. Una PR marcada como fusionable en GitHub puede esconder este tipo de desfase.

Las otras 34 comparaciones fueron `ahead` con `behind_by=0` al comprobarlas. Este resultado vale para los SHA registrados, no garantiza el estado de ramas que cambien posteriormente.

## 2. Artefactos y automatización

- `docs/pr104-integration-snapshot.json`: inventario legible de los **35 PR con SHA exactos**, referencias, fases, distancias de ancestro y condición del PR79. Esta instantánea es evidencia fechada, **no un estado GitHub actualizado en vivo**.
- `scripts/pr104-integration-chain.mjs`: comprueba secuencia #69–#103, bases encadenadas, identidad de heads, origen `main`, campos válidos, inexistencia de autorizaciones falsas, única excepción de ancestro conocida; exige siempre `productionGo:false`.
- `node scripts/pr104-integration-chain.mjs --live`: compara la instantánea con el estado actual de GitHub mediante lecturas autenticadas de su API, incluidas **35 consultas de ascendencia** a la comparación de commits con concurrencia acotada a 4. Usa un token de solo lectura en Actions. Si cambia `main`, una rama, un SHA, una base, el estado borrador o una distancia de antecesores, el gate falla hasta que se investigue y se actualice el manifiesto.
- `.ci-artifacts/pr104-chain-report.json` y `.ci-artifacts/pr104-chain-report.md`: informes técnicos, no certificados ni firmas.
- `revision.html`: mapa de revisión de las PR y etapas, filtro por fase/PR, aviso visible PR79, vínculos directos a GitHub y estado NO-GO. Se alimenta de la instantánea; **no afirma ser una consulta en vivo**, no introduce permisos ni almacena datos.
- `tests/pr104-integration-chain.test.js`: control de errores de integración, cambios de SHA, bases falsas, avances indebidos, desplazamiento de `main`, alteración de permisos e implementación simulada de las 35 consultas GitHub con prohibición de escrituras.
- `scripts/browser-smoke.mjs`: comprueba la nueva vista en Chromium/Firefox, filtros, móvil, teclado y el aviso de que falta autorización.

La **CI verde** significa: las validaciones y lecturas de la cadena técnica han funcionado y la divergencia conocida aparece correctamente como bloqueo. **No significa** que el grafo esté listo para fusionar, que exista aprobación empresarial, que se hayan realizado pruebas reales de accesibilidad o que el producto esté autorizado para producción.

## 3. Orden seguro de integración

| Fase | PR | Propósito | Condición de salida |
|---|---|---|---|
| A · Base y experiencia | #69–#78 | Diagnóstico, discovery, importación, UX y seguridad base | Revisar todas las diferencias; CI vigente para el SHA elegido; sin fuga de datos |
| B · Punto de sincronización | #79 | Detectar y absorber el commit pendiente #78 `56a96b1...` | Reconciliar en una rama de integración temporal, sin sobrescribir el commit corregido; revisar resultado y repetir CI |
| C · Piloto | #80–#90 | Plan de ejecución, riesgos, pruebas, atlas sintético | Verificar integridad de contratos y rutas, actualizar la cadena tras B |
| D · Controles | #91–#100 | Revisión de evidencia, accesibilidad, capacidad, privacidad y hito | Repetir aceptación técnica sin declarar signoffs falsos |
| E · UX y aceptación | #101–#103 | Vista esencial, comparación antes/después, protocolo humano | Repetir UI en escritorio/móvil y UAT externa antes de prometer lanzamiento |

**Importante:** estas son fases de revisión y reconciliación, no un script de fusión automática. El orden real comienza por #69, que es la primera PR cuyo destino es `main`. No fusionar directamente #100, #103 o #104 contra `main`: arrastrarían decenas de cambios acumulados que no han sido revisados individualmente. No modificar las PR ya aprobadas sin comprobar cómo afecta a sus descendientes.

### Procedimiento de reconciliación PR78 → PR79

1. Comparar el SHA actual de PR78 con el manifiesto; si cambió, detener y revisar de nuevo.
2. Revisar la corrección exacta `56a96b1...` del selector `.workbench-row:not([hidden]) .workbench-row-edit` frente al uso inválido en DOM nativo de `:visible`.
3. Crear **una rama temporal de integración** desde PR79, aplicar o fusionar de forma controlada el cambio de PR78 y comprobar el diff resultante sin alterar commits de terceros ni aprobar nada ficticiamente.
4. Ejecutar `npm run verify`, aceptación integral PR80/PR99/PR100/PR103, Chrome/Firefox y reflujo 320 px en dicha rama.
5. Verificar los dependientes PR80–PR103 para asegurar que incorporan exactamente la corrección y no hay regresiones; actualizar bases/heads e inventario de forma revisada. Solo entonces puede evaluarse el merge de la cadena en orden.
6. La integración se mantiene separada del despliegue. Después de una fusión autorizada harán falta pruebas en un entorno aislado.

No se ha ejecutado la reconciliación en PR104 porque las ramas apiladas representan entregas en borrador; cambiar 24 heads sin revisión produciría un falso sentido de seguridad.

## 4. Cinco validaciones externas para cualquier GO

1. **UAT real:** sesiones con personas independientes sobre las tareas PR103, problemas documentados y resueltos, sin usar datos identificativos en el repositorio.
2. **Accesibilidad manual:** ocho comprobaciones PR98, incluidos lectores reales, zoom, contraste, tactilidad y comprensión.
3. **Seguridad y privacidad:** revisión independiente de integraciones, tratamiento real, permisos, exposición, exportaciones y dependencias.
4. **Integración / rollback:** permisos de CRM/ERP reales y una reversión comprobada, más un responsable de incidentes.
5. **Autorización de negocio:** evidencia y aprobación expresa de personas responsables; la UI no expide certificados.

Falta **al menos** el desfase PR79 y siguen pendientes las cinco validaciones. Resultado permitido por el software: **NO-GO**. GitHub Actions no debe ni puede conceder autorización externa.

## 5. Mantenimiento

Si cambia cualquier rama, volver a generar y revisar el manifiesto. No basta con actualizar un número esperado en las pruebas: comprobar el nuevo diff y los 35 compare endpoints. Mantener el script `--live` como control previo a cualquier promoción.

La página de revisión se mantiene fuera de navegación comercial y con `noindex`: es herramienta de auditoría para el equipo, no un compromiso público de fecha de lanzamiento.
