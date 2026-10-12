# RevOps Studio · Publicación V104 (sitio de demostración)

**Fecha de preparación:** 12 de octubre de 2026.

## Alcance explícito
Esta entrega integra el contenido acumulado de las PR69–PR104 en la rama principal y lo distribuye como **demostración estática** de RevOps Studio en GitHub Pages. La autorización del usuario cubre publicar el código y la web. **No equivale** a autorizar conectores reales, permisos de clientes, procesamiento de datos privados o acciones de producción en un CRM/ERP.

## Contenido incluido
- Portada comercial, diagnóstico contextual, casos de uso y formularios ya existentes.
- Demo de tres procesos, exploración de decisiones, importador con reglas y edición reversible.
- Informes agregados CSV/TXT/JSON/PDF sin necesidad de backend privado.
- Consola de preparación de piloto con plan, riesgos, evidencia, capacidad, ensayos defensivos, accesibilidad, atlas sintético y panel V100.
- Vista esencial UX, comparación antes/después, protocolo de evaluación humana y revisión de la cadena de PR.
- Pruebas Node, Chrome, Firefox, límites de rendimiento, integridad de informes, privacidad, control de 320 px y auditoría pública HTTPS.

## Integridad del histórico
Las 35 PR originales #69–#103 y PR104 quedan enlazadas a través de sus ramas originales y de los commits que pertenecen al candidato acumulado. Se ha reconciliado la ascendencia PR78→PR100 hasta octubre de 2026, preservando el contenido de cada rama. La rama candidata final conserva **todo el árbol de archivos y cambios de PR104**, incluyendo la corrección `:not([hidden])` de PR78, que ya estaba presente en código aunque faltaba en su ascendencia antigua.

`docs/pr104-integration-snapshot.json` constituye una **fotografía histórica anterior a la reconciliación**. Se conserva como evidencia y se verifica estáticamente en CI. El control `--live` permanece disponible solo para una nueva auditoría de la cadena; no se ejecuta automáticamente en `main`, ya que el objetivo es cerrarla y sus antiguas referencias cambiarán tras la integración.

## Procedimiento de publicación
1. Ejecutar CI íntegra sobre el candidato de integración, comprobar mismo SHA que su PR.
2. Integrar a `main` con merge no destructivo, solo si la PR es fusionable y la validación está verde.
3. Comprobar CI de `main` para el nuevo commit.
4. Comprobar `live production audit` que espera a GitHub Pages y compara hash SHA-256 de los recursos servidos sobre HTTPS.
5. Probar rutas públicas (portada, demo, laboratorio, privacidad, gracias) y registrar su disponibilidad; la evaluación y revisión son herramientas auxiliares con `noindex`.
6. Cerrar las PR antiguas apiladas que todavía estén abiertas indicando que su código quedó incluido en el nuevo commit principal, en lugar de fusionarlas de nuevo o reescribir trabajo.

## Lo que esta publicación NO certifica
El producto público es una **demo funcional** con datos de ejemplo. Mantiene `productionGo:false` para el uso empresarial real. Faltan evaluación independiente de seguridad/privacidad, tests humanos NVDA/VoiceOver, pruebas en red corporativa, rollback real, permisos de integración y firmas de negocio. No afirmamos que se hayan realizado.

**Publicar la web y preparar operaciones reales son dos decisiones distintas.** Este documento deja esa separación explícita para futuras versiones.
