# reglasPasoDos

Este proceso se comparte con dos functions, la primera es un trigger onCreate, que reacciona a la creación de un documento en la colección catalogs de firestore.

La segunda function es HTTP, misma que se llama desde IBN web por el rol de datos maestros (mdm) con el fin de reprocesar las transformaciones una vez ajustado su mapa de tranformaciones.

## Descripción

Este proceso realiza la validación de las **Reglas complejas** y las **Transformaciones** por medio de la libreria <code>motor-de-reglas</code>.

Un ejemplo de regla compleja es que todos los UPC de un estilo tengan el mismo Color o que todos los UPC de un estilo tengan diferentes tallas.

Cuando se habla de transformaciones, es convertir o sustituir los valores de los campos de los productos, por ejemplo, cambiar el género MALE a HOMBRES.

Estas reglas y transformaciones son definidas por el rol de datos maestros en la sección de Calidad de datos de la app web.

Una vez realizados las validaciones y transformaciones, se escribe en la ruta del catálogo en storage los resultados de dichos procesos, en archivos .json:

- <code>error_rules2_provider.json</code>: arreglo de objetos que NO pasaron la validación de reglas complejas. Cada objeto contiene el campo \_errors\_, un array que contiene las descripciones de las reglas que no cumplió el objeto.

- <code>error_transformations_mdm.json</code>: json con los errores en las transformaciones. Tiene dos campos:

- <code>products</code>: arreglo de productos que no se pudieron transformar, cada objeto contiene el campo \_errors\_, un array que indica cuál transformación no se pudo realizar.

Dependiendo de los resultados de las validaciones y transformaciones, se actualizan en el documento del catálogo, en firestore, los campos: item_status, status, paths, date_updated.

- <code>item_status</code>, un objeto que contiene los campos:

  - <code>total_error_provider</code>: total de objetos que no pasaron las reglas complejas.
  - <code>total_error_MDM</code>: total de productos que no se pudieron transformar.
  - <code>total_ok</code>: total de productos que pasaron las reglas y se pudieron transformar.
  - <code>total_reutilizados</code>: total de UPC que se identificaron como reutilizados (mismo UPC con diferente estilo ver [DeteccionDeDuplicados](#upc-reutilizados)).
  - <code>total_inactivos</code>: total de UPC que tenian el campo active = false;
  - <code>total_activos</code>: total de UPC que tenian el campo active = true

- <code>status</code>, puede tener uno de los siguientes valores:

  - **revision**: cuando apenas incia el proceso de esta función.
  - **procesando**: cuando el total de productos que no se pudieron transformar es > 0.
  - **aprobado**: cuando el total de productos que se pudieron transformar es 0.

- <code>paths</code>:
  - <code>error_rules2</code>: path de storage donde están los productos que NO aprobaron las reglas complejas.
  - <code>error_transformations</code>: path de storage donde están los productos que NO se pudieron transformar.
- <code>date_updated</code>: fecha que se actualiza cada que cambia el arreglo de productos que pasaron las reglas y se pudieron transformar.
- <code>filters</code>: es un mapa que contiene un conteo de cuantos UPC tienen cierto Deporte, Banner propuesto, División, Talla, etc.

### Detección de cambios

Una vez que los productos han sido transformados correctamente, se realiza la detección de cambios.

La detección de cambios compara cada producto entrante de un nuevo catálogo con los productos que ya están dados de alta en SAP (nodo /Materiales), y verifica los campos almacenados en firestore > config > AppConfig > data > fieldsToCheckChanges, donde cada key de este mapa (fieldsToCheckChanges) es el nombre del campo en /Materiales y el value, el nombre del campo en el catálogo entrante.

Si se ha detectado un cambio en un Material, se almacena un nodo en realtime bd_default > Cambios, para su consumo en react, con la siguiente estructura:

```json
{
  "allChangesCheck": false,
  "cabecera": {
    "brandID": "Vb1Cn7tyaRxmbYSZiKkw",
    "catalogID": "Tk5Z3YWuJ5KfZOrT2BGE",
    "catalogName": "PUMAF",
    "date": "2024-06-14T23:41:21",
    "estilo": "401005 40",
    "generico": 356822,
    "productName": "REBOUND V6 LOW WNS",
    "providerID": "lCaZmpxDV72SHtHzI6ci",
    "providerIDSAP": "1000104",
    "season": "2024 Q1",
    "sociedad": "1001",
    "variantesIBN": [
      "04067983864674",
      "04067983864735",
      "04067983864681",
      "04067983864742",
      "04067983864698",
      "04067983864759",
      "04067983864704",
      "04067983864766",
      "04067983864711",
      "04067983864773",
      "04067983864728",
      "04067983864780"
    ],
    "variantesSAP": [1, 7, 2, 8, 3, 9, 4, 10, 5, 11, 6, 12]
  },
  "cambios": {
    "Color": {
      "after": "BLANCO",
      "before": "MULTICOLOR"
    }
  },
  "id": "356822-1001",
  "precios": {
    "compra": "673.78",
    "venta": "1699.00"
  }
}
```

Revisar [DetecciónDeCambios](./../../DeteccionCambios/Readme.md) para saber más sobre el nodo /Cambios.

### UPC Reutilizados

Dentro del proceso de Detección de Cambios, se identifican también los UPC Reutilizados, es decir, UPCs que ya se hayan dado de alta en SAP (consultando nodo Materiales), y que además tengan un Estilo DIFERENTE al UPC que se quiera dar de alta en el catálogo.

Dichos UPC no se guardan como parte del catálogo, porque no son seleccionables por compras, tampoco se guardan como error de proveedor, ni error de MDM.

Son almacenados en un nodo en realtime (UPCReutilizados/{idCatalogo}) para que compras los pueda visualizar y así tomar acciones con proveedor (externas a IBN).
El conteo de los UPC reutilizados se guarda en el catálogo > item_status > total_reutilizados.

### Detección de jerarquias faltantes

Por cada producto que tenga el catálogo, se evalúa la información y se compara la jerarquía del producto con las jerarquías que se tienen registradas por la [R98](./../../Integraciones/S4/R98_Jerarquias/Readme.md)

Cuando la jerarquía del producto no se tenga, se registrará este issue en `db.ref('JerarquiasSolicitadas')` para que los MDM puedan ver los issues en un monitor de jerarquías. El monitor realmente no tiene función, los usuarios MDM crearán las jerarquías en S4 y se replicarán a IBN por medio de la R98, lo cual solucionará el issue automáticamente y borrará el registro del error para que desaparezca del monitor.

También se evalúa si las jerarquias del catálog que si existen están reportadas como issues en `db.ref('JerarquiasSolicitadas')`, se aplicará el proceso para borrar los nodos que las contengan.

## reglasPasoDos_onCreate

Realiza el proceso explicado [aquí](#descripción) cada que se crea un documento en la colección catalogs de firestore.

### Endpoint

/CargaCatalogo-reglasPasoDos_onCreate

## reglasPasoDos_HTTP

Esta función ejecuta el mismo [proceso](#descripción), con la diferencia de que puede llamarse en cualquier momento dentro de la app web (función onCall).

### Endpoint

/CargaCatalogo-reglasPasoDos_HTTP

### Request body

```json
{
  "data": {
    // id del documento del catálogo que se está evaluando
    "catalog": "szVTwnmBTgIWWV45pcrs",

    //true para indicar si el MDM está reevaluando los productos con errores de transformación, false o no mandarla cuando el proceso se está realizando en base al archivo de entrada all_products.json
    "isError": false
  }
}
```

### Response

```json
{
  "data": {
    "catalogID": "zjmFQ2nO68frLP8Dngs2"
  },
  "error": false,
  "msg": "Se reprocesaron las reglas complejas y las transformaciones correctamente."
}
```
