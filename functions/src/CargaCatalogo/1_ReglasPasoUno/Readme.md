# reglasPasoUno_HTTP

## Descripción

Este proceso realiza la validación de reglas simples o de formato a un catálogo nuevo, por ejemplo, la longitud de los campos, el formato de los mismos, la eliminación de valores no permitidos, dependiendo lo que el rol de datos maestros haya configurado en la sección de Calidad de Datos en la app web.

Fue realizada para igualar el proceso de carga de un catálogo en react, pero convertido en API.

Utiliza la libreria <code>motor-de-reglas</code> para aplicarlas.

## Endpoint

/CargaCatalogo-reglasPasoUno_HTTP

## Headers

Para llamar a esta API, es necesario el header <code>x-ibn-token</code>.
Mismo que debe incluir el token de un usuario del proyecto con rol service, tester o proveedor.

## Request Body

El catálogo nuevo debe cumplir con la estructura de Cabecera y Detalles, estas hojas deben ser enviados en el body como arreglos de objetos.

```json
{
  "data": {
    "cabecera": [
      {
        "ID Catálogo": 11115,
        "ID proveedor SAP": "4202309",
        "Temporada": "Q2",
        "ID Marca": "003",
        "Año": 2024
      }
    ],
    "catalog": [
      {
        "UPC": "4099686973506",
        "Unidad de medida": "PZA",
        "Estilo": "520257 40",
        "Género": "Female",
        "Talla": "ECH",
        "Silueta": "PLAYERA",
        "Descripción larga del producto": "TRAIN FAVORITE TANK",
        "Descripción corta del producto": "TRAIN FAVORITE T",
        "Deporte": "ENTRENAMIENTO",
        "División": "TXT",
        "Color": "VERDE",
        "Disponible desde": "01.01.2024",
        "Precio venta del producto": "699.0",
        "Precio de compra del producto": "277.21",
        "Moneda venta": "MXN",
        "Moneda costo": "MXN"
      },
      {
        "UPC": "4099686973612",
        "Unidad de medida": "PZA",
        "Estilo": "520257 40",
        "Género": "Female",
        "Talla": "EXXXG",
        "Silueta": "PLAYERA",
        "Descripción larga del producto": "TRAIN FAVORITE TANK",
        "Descripción corta del producto": "TRAIN FAVORITE T",
        "Deporte": "ENTRENAMIENTO",
        "División": "TXT",
        "Color": "VERDE",
        "Disponible desde": "01.01.2024",
        "Precio venta del producto": "699.0",
        "Precio de compra del producto": "277.21",
        "Moneda venta": "MXN",
        "Moneda costo": "MXN"
      }
    ]
  }
}
```

## Response

El proceso puede terminar de tres maneras:

1. **La validación de reglas simples fue exitosa**

Cuando la validación es exitosa, se almacena el json de cabecera y de productos en storage, y se crea un nuevo documento en la colección <code>catalogs</code> (mismo que contendrá las rutas donde se almacenaron los json).

La creación del documento acciona el siguiente paso en la carga de catálogo, la función [reglasPasoDos_onCreate](./../2_ReglasPasoDos/Readme.md/#reglapasodos_oncreate).

```json
{
  "error": false,
  "msg": "Catálogo creado.",
  "data": {
    "catalogID": "0fwK6ssH0R9OfKVIIKQF"
  }
}
```

> NOTA: Puede que la validación haya sido exitosa, pero el output de la misma contenga warnings (reglas que no obstruyen la subida del catálogo, pero alertan sobre la calidad de los datos), en dicho caso, los warnings serán almacenados en storage bajo el nombre de results.json. La respuesta del servicio indicará la ruta donde está almacenado este json.

```json
{
  "error": false,
  "msg": "Catálogo creado.",
  "data": {
    "catalogID": "0fwK6ssH0R9OfKVIIKQF",
    "validationResults": "SimpleRulesResults/3ZRs4E9Lktb3KXBaxxnn8FLBRMZ2/2023-12-20T00:07:28 - 0fwK6ssH0R9OfKVIIKQF"
  }
}
```

2. **La validación de reglas simples falló**

Cuando el proceso de validación de reglas simples falla, no se crea un nuevo documento, sino que se guarda el input recibido en storage, un solo json para Cabecera y Detalles con el nombre input.json. También se almacenan los resultados de la validación con el nombre results.json.

La respuesta del servicio indicará la ruta donde se almacenaron estos json.

```json
{
  "error": false,
  "msg": "Se encontraron errores en la validación de las reglas simples.",
  "data": {
    "validationResults": "SimpleRulesResults/3ZRs4E9Lktb3KXBaxxnn8FLBRMZ2/2023-12-20T00:38:19"
  }
}
```

3. **Algún error interno**

Si algo falla durante el proceso de validación, se recibirá una respuesta como la siguiente:

```json
{
  "error": true,
  "msg": "Error X",
  "data": null
}
```
