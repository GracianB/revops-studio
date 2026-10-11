# PR97 · Rendimiento mediante análisis local reutilizable

El centro de control de PR95 recalculaba modelos relativamente costosos (matriz de seis muestras y cuatro capacidades) en cada cambio de filtro o casilla. PR97 introduce una memoria **limitada a una sola muestra** y dos hipótesis de capacidad, además de la matriz sintética del proceso. Evita recrear el plan, riesgos y requisitos cuando el origen y el resultado no cambian.

Se invalida por escenario, contenido exacto del CSV o referencia del resultado; se borra expresamente cuando se limpia el estado de la consola. No se almacena en disco, service workers, sesiones persistentes ni APIs externas. Se mantienen bloqueos de aprobación y las exportaciones recalculables.

Pruebas 18 fixtures × 30 redibujos, verificando identidad del resultado, 60 reutilizaciones, invalidación correcta, capacidad inválida y resultado cruzado. GitHub CI existente conserva navegadores, regresión V40 y presupuesto de rendimiento. No se presenta una mejora porcentual sin medición comparativa.