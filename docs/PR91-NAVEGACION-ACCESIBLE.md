# PR91 · Navegación y accesibilidad del piloto

> **Contexto histórico anterior a V104.** Este documento conserva el diseño y las condiciones de su PR original. Su contenido quedó integrado en la rama principal con `90371736c2636f1807382ddbd077baff9b9a019c`; las menciones a borrador, bloqueo de integración o ausencia de publicación corresponden a aquella etapa. Consulta [Publicación V104](V104-PUBLICACION-SITIO.md) para el alcance vigente. Los límites sobre integraciones reales, datos de clientes y aprobaciones externas siguen vigentes. El despliegue público actual requiere su propia comprobación HTTPS.

Rama de borrador basada en PR90. Se añade un índice accesible de ocho secciones con botones nativos, orden lógico de lectura, teclas flecha/Inicio/Fin, indicador de posición y foco trasladado al título elegido. Todos los encabezados de destino tienen tabindex=-1.

El índice es horizontal desplazable, pero el panel completo no desborda en pantallas estrechas. El estado `aria-current` ofrece una pista adicional al borde visual; las etiquetas numéricas y el mensaje de estado no dependen de los colores.

Se añaden pruebas estructurales de IDs/jerarquía, navegación real de teclado en Chrome/Firefox, recuperación de foco anterior y auditoría axe ya existente.

No se afirma haber completado pruebas manuales de lector de pantalla, zoom real con tecnología asistiva ni certificación WCAG. Se mantienen los bloqueos de producción y el modo privado, sin persistencia o envío externo.