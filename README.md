# RevOps Studio · V104

**Customer Success × Revenue Operations × datos × automatización.**

[**Abrir web de demostración**](https://gracianb.github.io/revops-studio/) · [**Probar escenarios ficticios**](https://gracianb.github.io/revops-studio/demo.html) · [**Ver publicación V104**](docs/V104-PUBLICACION-SITIO.md) · [**Histórico íntegro**](HISTORY.md)

## Estado actual: demo V104 integrada

La [PR #105](https://github.com/GracianB/revops-studio/pull/105) quedó **fusionada en `main` el 12 de octubre de 2026** mediante commit [`90371736`](https://github.com/GracianB/revops-studio/commit/90371736c2636f1807382ddbd077baff9b9a019c). El repositorio contiene una **demostración estática**, con ejemplos sintéticos, tres procesos modelados y herramientas locales de diagnóstico, calidad de datos, escenarios, planificación y revisión humana.

La CI pública aprobada y la auditoría programada [live production audit](https://github.com/GracianB/revops-studio/actions/workflows/) acreditan ejecuciones técnicas fechadas, **no** una certificación permanente del estado de Pages. Contrasta el SHA publicado con los recursos esperados antes de afirmar que un cambio nuevo está en producción.

### Qué hace realmente

- Importa y valida **CSV de ejemplo** en el navegador; reglas deterministas, diagnóstico de errores, detección de bloqueos y corrección supervisada.
- Permite escenarios simulados de pedidos, soporte y operaciones, junto con forecast, políticas, evidencia, auditorías y colas de acción.
- Ofrece resúmenes, exportaciones y protocolos de evaluación. Los CSV detallados pueden contener los datos que la persona introduzca, así que **no pegues información personal o confidencial**.
- Los módulos de piloto muestran **propuestas o ensayos simulados** y mantienen un límite de autorización humana.

### Qué NO hace ni certifica

**V104 NO está conectada a CRM, ERP, datos privados ni clientes reales.** No ejecuta decisiones empresariales, no acredita ROI comercial ni sustituye aprobación organizativa, revisión legal, análisis de seguridad, pruebas manuales de accesibilidad o puesta en producción. Los documentos de auditoría históricos pueden decir «NO PUBLICAR» porque se redactaron **antes** de la fusión de la demo; esos avisos no deben confundirse con el estado actual del sitio.

La frontera de ejecución empresarial sigue siendo **`productionGo: false`**. No crear conectores ni aceptar datos de clientes como parte de esta revisión documental.

## Navegación

| Espacio | Alcance |
|---|---|
| [Portada](index.html) | Servicios, valor y formulario de contacto |
| [Demo funcional](demo.html) | Escenarios locales ficticios y motor observable |
| [Documento de publicación V104](docs/V104-PUBLICACION-SITIO.md) | Qué se integró, controles realizados y límites |
| [Auditoría histórica PR104](docs/PR104-CHAIN-RELEASE-REVIEW.md) | Riesgos identificados *antes* del cierre |
| [Índice histórico PR80–PR104](docs/V104-HISTORICAL-PR-INDEX.md) | Los 25 hitos contextualizados, incluidos los documentos disponibles |
| [README original preservado](HISTORY.md) | Toda la narrativa técnica V40–PR104, sin pérdida de contenido |

## Desarrollo y pruebas

Requiere Node.js compatible con la configuración del proyecto, dependencias del repositorio y un navegador Chromium/Chrome instalado.

```bash
npm ci
npm test
npm run validate
npm run verify:pre-release
```

Los scripts `scripts/browser-smoke.mjs`, `scripts/performance-budget.mjs` y `scripts/audit-live.mjs` utilizan Chrome como canal por defecto, pero también admiten **`CHROMIUM_BIN`** para un Chromium ya instalado:

```bash
CHROMIUM_BIN=/usr/bin/chromium node scripts/performance-budget.mjs
CHROMIUM_BIN=/usr/bin/chromium node scripts/audit-live.mjs
CHROMIUM_BIN=/usr/bin/chromium node scripts/browser-smoke.mjs
```

El motor del smoke sigue pudiendo seleccionar Firefox mediante `REVOPS_BROWSER=firefox`; esa opción **no se sustituye** por `CHROMIUM_BIN`. La auditoría HTTPS depende de acceso real a la web y de su versión publicada, de modo que no se considera aprobada solo por el éxito de las pruebas unitarias.

**Principio de release:** diferenciar siempre rama, PR, prueba local, CI, sitio Pages y autorización empresarial. Son seis estados distintos, aunque GitHub a veces haga lo posible por mezclarlos visualmente.

---

© 2026 GracianB · Código y documentación sujetos a su licencia original.
