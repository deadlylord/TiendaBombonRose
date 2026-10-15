# Tienda Bombón y Street Legends

## Catálogo por empresa (0.3.0)

En **Admin → General → Empresa del catálogo**, selecciona **Bombón y Street Legends** o **Otra empresa de Vestika** e ingresa su identificador. Guarda la configuración. Solo los administradores pueden cambiarla.

`store/config.inventoryCompanyId` identifica la empresa del inventario; no cambia de proyecto Firebase. Su valor inicial, compatible con configuraciones existentes, es `default_company`, según `types.ts` del POS `deadlylord/Sistemabomb-nrecu`.

El catálogo consulta `inventory` por `companyId`. Para la empresa original incluye además las sedes `1`, `2` y `3` (INITIAL_STORES del POS), y filtra los registros con empresa explícita distinta. Los productos antiguos sin empresa únicamente se admiten en esas sedes originales. Las empresas nuevas deben tener `companyId` explícito en su inventario. No hay consulta alternativa del inventario completo.

Las categorías y personalizaciones se consultan únicamente por los identificadores referenciados en ese inventario, en grupos de hasta 30. Las personalizaciones históricas sin `companyId` y las categorías históricas pertenecen a la empresa original. Cada carrito se guarda por separado por empresa; los carritos anteriores a 0.3.0 no se migran automáticamente.

Los productos con SKU, nombre, categoría, proveedor y precio iguales se consolidan entre sedes. Productos sin SKU conservan su identidad individual. No se modifica el stock del POS.

## Administración y pedidos

- Los pedidos y usuarios no se consultan al abrir el catálogo público; requieren acceso al administrador. Los usuarios solo se cargan para el rol admin.
- Los pedidos nuevos llevan `companyId`; los históricos sin esa propiedad se muestran únicamente en la empresa original.
- Se retiró la creación automática de cuentas de demostración. Crear un usuario utiliza una sesión Firebase separada para conservar la sesión del administrador.
- El pedido y su número se guardan en una sola transacción antes de abrir WhatsApp. Un intento repetido reutiliza el documento pendiente y el botón se bloquea mientras se guarda.
- Se revisan existencias, precio y disponibilidad de talla/color del catálogo actual. La recogida exige escoger sede.
- Es necesario configurar el WhatsApp real en Admin → General. El número de ejemplo `573001234567` no permite enviar pedidos.

## Validación

```sh
npm ci
npm run lint
npm test
npm run build
```

## Alcance pendiente

El filtrado del cliente no sustituye las reglas de seguridad de Firebase. Esta versión no despliega ni modifica reglas de Firestore, no revoca cuentas existentes, no reserva stock ni valida pagos. La comprobación de precios/stock debe complementarse con un servicio de pedidos en servidor antes de ofrecer una compra automática con pago y reserva. Las reglas efectivamente desplegadas requieren revisión con acceso administrativo a Firebase; el archivo `firestore.rules` heredado no es una definición utilizable.

El servidor Express contiene funciones de IA e Instagram; el build estático de Vite no las despliega como funciones Netlify. Esta actualización mantiene su infraestructura actual.

## Experiencia de compra (0.4.0)

La búsqueda reconoce palabras con o sin tilde y consulta nombre, nombre original, categoría y descripción. El catálogo completo y las categorías permiten filtrar por tallas y colores disponibles, ver ofertas y ordenar por precio final o fecha. Se muestran 24 productos inicialmente, con un botón para ampliar la lista sin consultar nuevamente Firebase.

En el editor de productos se pueden guardar fotografías adicionales (URLs, una por línea) y una guía de tallas propia de la prenda. La guía solo aparece si se ha completado. Las fotos de producto se cargan bajo demanda y muestran un aviso si faltan; la fotografía principal de la ficha tiene carga inmediata. La cantidad máxima en celular y escritorio respeta el stock del catálogo. Los enlaces compartidos usan `/product/:id` y las recomendaciones permiten cambiar de prenda sin pasar por la portada.

Guardar un producto espera la respuesta de Firebase; un error conserva el editor abierto. No se marca el origen colombiano automáticamente.

El panel administrativo se descarga únicamente al abrirlo, y Tailwind se compila en el build en lugar de depender de un script CDN. Se eliminó la incorporación completa de `process.env` al frontend. `netlify.toml` establece validación y compilación antes de publicar `dist`; la conexión y el despliegue efectivos en Netlify deben comprobarse en esa plataforma. Las rutas conservan el fallback SPA de `public/_redirects`.

## Categorías y navegación (0.4.1)

Las categorías femeninas y generales aparecen antes que las masculinas, conservando orden alfabético dentro de cada grupo. La clasificación usa el nombre de la categoría: una etiqueta explícita de mujer/dama tiene prioridad, y hombre/caballero/Street o camisas/camisetas se agrupan después. Se aplica el mismo orden al menú y a los filtros, sin lecturas adicionales.

Abrir una ficha conserva la búsqueda o categoría debajo, incluidos filtros y productos ya mostrados. Cerrar la ficha, agregar al carrito desde ella o usar el gesto de atrás vuelve a la entrada anterior del historial y recupera su posición vertical. Los productos relacionados retroceden uno por uno. Una ficha abierta directamente desde un enlace vuelve al catálogo al cerrarla. El cierre ya no agrega visitas artificiales al inicio.

## Carga inicial (0.4.2)

El HTML incluye una pantalla de carga con estilos y animaciones críticos, visibles antes de descargar JavaScript. React usa la misma pantalla mientras descarga la aplicación y consulta el catálogo. Los estilos completos se cargan con el módulo de la aplicación y las fuentes externas no bloquean la pantalla inicial. Con movimiento reducido el círculo gira más despacio; no se añaden consultas ni una espera mínima. Si falla la descarga del módulo de la tienda, se muestra un aviso con un botón para volver a intentar.

## Círculo de carga (0.4.3)

Se restaura el diseño anterior: fondo blanco, círculo rosa de 40 px y «Descubre tu próximo outfit». El giro tiene una duración propia para evitar que la regla global de movimiento reducido lo acelere a 0,01 ms y parezca inmóvil. Con esa preferencia el giro se ralentiza a dos segundos.

## Tamaño de logos (0.4.4)

Los logos de Bombón y Street Legends comparten una altura de 64 px en celular y 72 px en pantallas mayores, con sus proporciones originales. El componente `StoreLogo` encuadra las dos imágenes actualmente configuradas para excluir sus márgenes vacíos, sin modificar los archivos originales. Otras imágenes conservan el ajuste estándar. El menú lateral usa el mismo encuadre. La cabecera, su espacio reservado y la posición fija de categorías se ajustan juntos para evitar superposiciones.


## Selector visual y pagos (0.4.5)

El selector aparece debajo del banner del inicio y al comienzo de las categorías y la búsqueda. Muestra fotografías circulares del catálogo, prioriza prendas disponibles y conserva mujer antes de hombre. Se desplaza horizontalmente, con bordes rosados y estado seleccionado accesible, sin nuevas lecturas de Firebase. Ya no queda fijo sobre el contenido.

La pieza de pagos local incluye Addi, Sistecrédito y tarjetas, sin Mercado Pago. Reemplaza la imagen predeterminada anterior incluso en configuraciones guardadas; se conservan otras imágenes personalizadas.


## Cabecera, imágenes y carga (0.4.6)

La cabecera usa 80/96 px más 32 px opcionales de anuncios, sin eslogan ni espacio antes del banner. Los círculos miden 112 px en celular y 160 px en escritorio. Admin → Categorías → Imágenes de los círculos permite elegir fotografías del catálogo, subir imágenes o restaurar la selección automática, incluido Todo. Las imágenes se guardan por empresa en la configuración existente; se espera la confirmación de Firebase y se bloquea guardar durante las subidas.

La carga inicial y la de React comparten un carrusel continuo de contornos SVG rosados de prendas en ganchos. La animación no espera recursos externos y se ralentiza con movimiento reducido. El estado de error conserva su botón de reintento.


## Carga restaurada (0.4.7)

Se restaura el círculo rosa giratorio y «Descubre tu próximo outfit», tanto en el HTML inicial como en React. Se conservan los cambios de cabecera y las imágenes editables de categorías.
