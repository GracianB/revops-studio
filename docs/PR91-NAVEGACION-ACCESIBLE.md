# PR91 · Navegación y accesibilidad del piloto

Rama de borrador basada en PR90. Se añade un índice accesible de ocho secciones con botones nativos, orden lógico de lectura, teclas flecha/Inicio/Fin, indicador de posición y foco trasladado al título elegido. Todos los encabezados de destino tienen tabindex=-1.

El índice es horizontal desplazable, pero el panel completo no desborda en pantallas estrechas. El estado `aria-current` ofrece una pista adicional al borde visual; las etiquetas numéricas y el mensaje de estado no dependen de los colores.

Se añaden pruebas estructurales de IDs/jerarquía, navegación real de teclado en Chrome/Firefox, recuperación de foco anterior y auditoría axe ya existente.

No se afirma haber completado pruebas manuales de lector de pantalla, zoom real con tecnología asistiva ni certificación WCAG. Se mantienen los bloqueos de producción y el modo privado, sin persistencia o envío externo.