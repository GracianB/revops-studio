# Caso de uso · Primera visita sin conocimientos técnicos

**Hipótesis de usuario, no estudio con participantes reales.** El recorrido siguiente se diseñó desde el punto de vista de una persona responsable de operaciones y se convierte en un contrato de pruebas automatizadas de navegador. No existe evidencia de que clientes reales hayan completado ya el recorrido.

## Persona y trabajo que intenta resolver

**Laura**, responsable de operaciones de una empresa pequeña, usa email, Excel y una aplicación de gestión. Recibe pedidos repetidos y dedica tiempo a comprobarlos antes de enviarlos a otras personas. No sabe programar, no tiene un fichero de muestra a mano y nunca ha oído la expresión «mapeo de columnas».

Su pregunta no es «¿cómo funciona el motor CSV?». Es **«¿Me evitará revisar pedidos duplicados uno por uno y podré confiar en lo que se descarta?»**.

## Dónde se perdía en la interfaz anterior

| Momento | Fricción | Consecuencia potencial | Decisión |
| --- | --- | --- | --- |
| Primer vistazo | Tres áreas, seis recetas, cuatro pasos técnicos, un editor de filas y varios informes | No sabe por dónde empezar | Entrar por un problema reconocible, sin archivos |
| Selección | «Pedidos y CRM», «Soporte», «Datos» | Tiene que interpretar categorías de servicios | Preguntas «Se nos duplican los pedidos», «Las incidencias se acumulan», «Los datos no cuadran» |
| Primera ejecución | KPI «Listos» confundible con acciones nuevas | No se fía del conteo | Mostrar por separado bloqueados, revisión humana y acciones propuestas, con nota sobre históricos |
| Primer error | Debe descubrir filtros, tabla, botón Editar y cinco columnas | Abandona sin probar el valor real | Un botón «Quiero corregir uno» abre directamente la fila y marca el campo conflictivo |
| Después de corregir | Resultado en varios paneles | No sabe si ha funcionado | Antes/después calculado con el motor real, explicado en una oración |
| Exportación | Varios CSV e informes con nombres técnicos | Miedo a compartir datos privados | Una sola acción principal «Descargar explicación sin filas ni emails» |
| Siguiente paso comercial | Link de consulta alejado de la prueba | No relaciona lo probado con contratar | Consulta contextual que lleva solo cifras agregadas al brief |
| Usuario experto | Ocultar las herramientas siempre sería limitante | No puede probar sus propios archivos | Botón visible para cambiar a herramientas completas, sin perder lo procesado |

## Recorrido objetivo comprobable

1. Laura abre `demo.html`. **Vista sencilla** activa por defecto. No se muestran el CSV, los 18 datasets ni los cinco botones de exportación. Puede acceder a ellos con «Abrir todas las herramientas».
2. Reconoce «Se nos duplican los pedidos» y pulsa «Ver qué pasa con estos pedidos».
3. Lee el resultado real de seis pedidos ficticios: dos bloqueados, uno para revisión humana, dos acciones preparables y un registro histórico que no debe ejecutarse como pedido nuevo.
4. Pulsa «Quiero corregir uno de estos errores». El sistema abre la fila con duplicado, destaca el identificador conflictivo y explica cómo corregirlo.
5. Cambia uno de los identificadores ficticios a `PED-999` y guarda. El motor recalcula todas las filas: **los bloqueos bajan de 2 a 1 y las acciones preparables suben de 2 a 3**. Se explica que el efecto pertenece solo al ejemplo.
6. Descarga un informe de simulación con conteos agregados, sin identificadores, emails o filas.
7. Si desea valorar un proyecto real, usa «Consultar cómo aplicarlo a mi empresa». El formulario recibe solo un resumen agregado, no datos originales; sigue sin enviarse automáticamente.

## Lo que no hace

La demo **no lee la base de datos de Laura, no conecta con su CRM, no ejecuta pedidos, no estima ahorros reales y no está avalada por entrevistas de usabilidad con clientes externos**. Si decide importar algo, se debe usar información ficticia o anonimizada.

## Aceptación y pruebas

- Visita sin parámetros: `body[data-experience="simple"]`, recorrido visible, herramientas CSV ocultas.
- Cambiar entre tres problemas de negocio actualiza el resultado del motor sin persistencia externa.
- Cada CTA guía al siguiente paso; el editor usa el campo causante del bloqueo.
- Un cambio en la fila recalcula el resultado y el paso final explica los contadores reales antes/después.
- Descarga del informe solo con información agregada.
- Cambio a modo avanzado y vuelta a modo sencillo sin perder el resultado.
- Vista móvil estrecha sin desbordamiento y sin errores de ejecución de JavaScript.
- Paso a contacto con resumen sin emails ni identificadores de muestra.
- Enlaces directos avanzados anteriores `?scenario=...` conservan su experiencia; `?view=simple` abre la nueva guía.

## Referencias de criterio

- Nielsen Norman Group: [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/), priorizar acciones esenciales y relegar funciones infrecuentes.
- GOV.UK Design System: [Start using a service](https://design-system.service.gov.uk/patterns/start-using-a-service/), explicar el propósito y el siguiente paso sin sobrecargar.
- GOV.UK Design System: [Error summary](https://design-system.service.gov.uk/components/error-summary/), ofrecer correcciones concretas en el momento necesario.
- Baymard Institute: [Proper Indicators for Hidden Elements](https://baymard.com/research-articles/trigger-indicators), dejar visible el acceso a capacidades avanzadas.
