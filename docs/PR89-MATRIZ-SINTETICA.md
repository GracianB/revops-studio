# PR89 · Matriz de pruebas funcionales sintéticas

**Estado:** borrador apilado sobre PR88. No publicar, fusionar ni conectar sistemas.

## Propósito

El visitante puede comparar el resultado de su muestra actual con seis casos sintéticos del mismo flujo: original, datos correctos, duplicados, campos faltantes, revisión humana y casos límite. La matriz reejecuta el mismo motor PR80 y los modelos PR81–PR87 para cada patrón ficticio y solo presenta agregados.

Esta función evidencia diferencias entre casos normales y adversos, sin crear un benchmark artificial ni extrapolar resultados a producción. No es una prueba de carga o latencia.

## Contrato

- Seis perfiles por escenario y 18 pruebas sintéticas de referencia en total.
- Por perfil: registros, bloqueos, revisiones, controles superados, riesgos altos, tareas requeridas y diferencia frente a la muestra actual.
- El filtro muestra todos, con incidencias o sin ellas; no cambia ni sustituye el CSV activo.
- Exportación JSON de estados y métricas agregadas, sin valores originales ni IDs de registros.
- Todos los perfiles conservan la decisión de producción NO-GO.

## Experiencia

Sección 07 del centro de control PR85 con tabla accessible de desplazamiento horizontal limitado en pantallas de 320 px, etiquetas visibles y select nativo. Ningún dato se almacena fuera de memoria o se transmite.

## Pruebas

- Tres escenarios × seis muestras como origen × seis perfiles sintéticos, con comparación de retorno exacto sobre el mismo perfil.
- Reglas de independencia, protección de identidades, prohibición de aprobaciones falsas.
- Chrome/Firefox: seis filas visibles, filtros, verificación de que el CSV original no cambia, JSON, axe y móvil.

**Limitación:** No demuestra capacidad operativa, concurrencia, fiabilidad de redes ni beneficios empresariales reales.
