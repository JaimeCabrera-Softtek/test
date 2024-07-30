# AltaMateriales-batchCreation

Endpoint que recibe un batch de N items y genera N jobs para `AltaMateriales`

## Tipo nuevo_completo

El primer escenario es la selección de materiales que hace un comprador. El usuario explora catálogos y selecciona productos que le interesa comprar. [Selección de materiales](../../SeleccionMateriales/Readme.md)

Esos materiales a partir de aquí se procesarán individualemente como jobs de tipo `nuevo_completo` lo cual quiere decir que se tienen que enviar 6 segmentos a CPI->SAP

El evento de escribir en realtime DB un job, detona [AltaMateriales-startTrigger](../02_start_trigger/Readme.md)

## Tipo extension_de_banner

El segundo escenario es la extensión de banner.

Se identifica una extensión de banner cuando el producto ya ha sido dado de alta a otro banner, por ejemplo, originalmente se dio de alta al banner INNOVA, y en esta nueva selección, el comprador selecciona el banner INNVICTUS.

> Hay una regla de negocio que especifica que todos los nuevos articulos, independientemente del banner seleccionado en la sociedad 1001, debe extenderse inmediatamente después de su creación al banner OUTLET.

Los jobs de tipo extension_de_banner, solamente envian a SAP los segmentos 3, 4, 5 y 6.

### Extensión de banners entre sociedades

Existen dos sociedades que clasifican los banners e identifican ciertas reglas de negocio del cliente, la sociedad 1001 y la sociedad 2001. Un artículo puede compartirse entre sociedades, es decir, puede estar extendido a N banners de la sociedad 1001, y al único banner (hasta ahora) de la sociedad 2001, INNERGY.

Lo más relevante que diferencia ambas sociedades en el job del alta de artículos son los canales de distribución. Para la sociedad 1001 se envía a SAP el canal 10, y para la sociedad 2001, se envian los canales 50, 60 y 70.

## Tipo cambio_precios

Los jobs que son tipo cambio_precios envian a SAP solamente los segmentos relacionados al precio de los productos.

Para este tipo de job no se llama el API, si no que se aprovecha la lógica dentro de [HandleMonitor](./../../DeteccionCambios/HandleMonitor/Readme.md/#descripción), que identifica al campo subtype, mismo que dice cuales segmentos se enviaran a SAP:

- Cambio de precios compra y venta: segmento 4 y 5
- Cambio de precio compra: segmento 4
- Cambio precio venta: segmento 5
