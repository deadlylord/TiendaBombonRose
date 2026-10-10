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
