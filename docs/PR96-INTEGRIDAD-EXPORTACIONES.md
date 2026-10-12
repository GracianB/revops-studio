# PR96 · Política de integridad y privacidad de las exportaciones

Añade un filtro técnico **fail-closed** antes de descargar los JSON del centro de control: permite un conjunto conocido de esquemas de piloto, impone límites de tamaño/profundidad, prohíbe campos de datos privados (CSV, correos, tokens y registros) y rechaza cualquier aprobación, evidencia real verificada, ejecución externa o lanzamiento autorizado. Además, comprueba que los informes HTML imprimibles no incluyan scripts, iframes, recursos remotos o eventos HTML activos.

El verificador se ejecuta justo antes de crear los Blob de exportación, además de las listas positivas de los serializers. No autoriza documentos externos y no pretende demostrar ausencia absoluta de vulnerabilidades; es una defensa adicional y auditable.

La prueba PR96 recorre las 18 muestras y los serializers de riesgos, evidencias, capacidad, aprobación, matriz sintética, defensas, ruta, revisión y atlas. Las descargas reales siguen siendo locales. Ningún dato se envía, no se altera `main` ni se declara disponibilidad de producción.