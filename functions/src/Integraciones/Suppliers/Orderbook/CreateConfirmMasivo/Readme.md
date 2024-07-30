## Integraciones-Suppliers-orderbookCreate

Satisface el requerimiento R44. Recibe un JSON que contiene mas de un orderbook y se guarda en Firebase para ser utilizado por el portal de IBN y se genera una petición para subirlo a S4/Hana (SAP).

Se pueden enviar n orderbooks en el arreglo, SAP va haciendo el registro de cada orderbook y los responses se van guardando dependiendo del contrato

### Endpoint

/Integraciones-Suppliers-orderbookCreate

### Request Body

| Description                                                          | Key                    | Value      |
| -------------------------------------------------------------------- | :--------------------- | ---------- |
| Sold to Number                                                       | soldToNumber           | (text)     |
| Sold to Name                                                         | soldToName             | (text)     |
| Ship to Number                                                       | shipToNumber           | (text)     |
| Ship to Name                                                         | ShipToName             | (text)     |
| Banner                                                               | banner                 | (text)     |
| Tipo de Orden                                                        | tipoOrden              | (text)     |
| Orden de compra Innovarsport                                         | ordenCompraInnovasport | (text)     |
| Orden de compra Proveedor                                            | ordenCompraProveedor   | (text)     |
| Temporada                                                            | temporada              | (text)     |
| Marca                                                                | marca                  | (text)     |
| Contract ID - Perteneciente al contrato, para BD (No se manda a SAP) | contractId             | (text)     |
| Detail of the Order                                                  | detail                 | (Object[]) |

### Body - orderBook Detail

| Description                             | Key                                | Value  |
| --------------------------------------- | :--------------------------------- | ------ |
| Mes Flujo Proveedor                     | mesFlujoProveedor                  | (text) |
| rrd                                     | rrd                                | (text) |
| Mes Confirmacion                        | mesConfirmacion                    | (text) |
| Fecha Esperada Cedis                    | fechaEsperadaCedis                 | (text) |
| Estilo Proveedor                        | estiloProveedor                    | (text) |
| Descripcion del Proveedor               | descripcionProveedor               | (text) |
| Numero Material                         | numeroMaterial                     | (text) |
| Descripcion Material                    | descripcionMaterial                | (text) |
| Genero Proveedor                        | generoProveedor                    | (text) |
| Division Proveedor                      | divisionProveedor                  | (text) |
| Categoria Proveedor                     | categoriaProveedor                 | (text) |
| Genero Innovasport                      | generoInnovasport                  | (text) |
| Division Innovasport                    | divisionInnovasport                | (text) |
| Categoria Innovasport                   | categoriaInnovasport               | (text) |
| Color Proveedor                         | colorProveedor                     | (text) |
| Color Proveedor Español                 | colorProveedorEsp                  | (text) |
| Color Innovasport                       | colorInnovasport                   | (text) |
| Iniciativa                              | iniciativa                         | (text) |
| Fecha Lanzamiento                       | fechaLanzamiento                   | (text) |
| ean Upc                                 | eanUpc                             | (text) |
| coCuNew                                 | coCuNew                            | (text) |
| Tamaño MX                               | mxSize                             | (text) |
| Tamaño USA                              | usSize                             | (text) |
| Unidad Entrega                          | unidadEntrega                      | (text) |
| Cantidad Confirmada                     | cantidadConfirmada                 | (text) |
| Descuento Unitario                      | descuentoUnitario                  | (text) |
| Costo Unitario Innovasport sin IVA      | costoUnitarioInnovasportSinIva     | (text) |
| Precio Retail Unitario sin IVA          | precioRetailUnitarioSinIva         | (text) |
| Precio Retail Unitario Interior con IVA | PrecioRetailUnitarioInteriorConIva | (text) |
| Monto Total Costo sin IVA               | MontoTotalCostoSinIva              | (text) |
| Monto Total Retail sin IVA              | MontoTotalRetailSinIva             | (text) |

### Request Example

```json
{
  "orderBook": [
    {
      "soldToNumber": "6400000448",
      "soldToName": "INNOVA SPORT S.A. DE C.V.",
      "shipToNumber": "6400000449",
      "ShipToName": "0370_Cedis CdMX",
      "banner": "INNVICTUS",
      "tipoOrden": "ZBCD",
      "ordenCompraInnovasport": "5500000048",
      "ordenCompraProveedor": "6402444898",
      "temporada": "Q1",
      "marca": "NIKE",
      "contractId": "testing",
      "detail": [
        {
          "mesFlujoProveedor": "MARZO",
          "rrd": "ABRIL",
          "mesConfirmacion": "ABRIL",
          "fechaEsperadaCedis": "01.04.2024",
          "estiloProveedor": "DH0321-003",
          "descripcionProveedor": "NIKE AIR MAX INTRLK 75",
          "numeroMaterial": "7000084013",
          "descripcionMaterial": "NIKE AIR MAX INTRLK 75",
          "generoProveedor": "HOMBRE",
          "divisionProveedor": "CALZADO",
          "categoriaProveedor": "CASUAL",
          "generoInnovasport": "HOMBRE",
          "divisionInnovasport": "CALZADO",
          "categoriaInnovasport": "CASUAL",
          "colorProveedor": "BLACK",
          "colorProveedorEsp": "NEGRO",
          "colorInnovasport": "BLACK",
          "iniciativa": "PRUEBA",
          "fechaLanzamiento": "19.04.2024",
          "eanUpc": "195869217918",
          "coCuNew": "2",
          "mxSize": "31",
          "usSize": "31",
          "unidadEntrega": "1",
          "cantidadConfirmada": "1100",
          "descuentoUnitario": "53",
          "costoUnitarioInnovasportSinIva": "701.10",
          "precioRetailUnitarioSinIva": "701.10",
          "PrecioRetailUnitarioInteriorConIva": "813.28",
          "MontoTotalCostoSinIva": "771210.00",
          "MontoTotalRetailSinIva": "771210.00"
        },
        {
          "mesFlujoProveedor": "MARZO",
          "rrd": "ABRIL",
          "mesConfirmacion": "ABRIL",
          "fechaEsperadaCedis": "01.04.2024",
          "estiloProveedor": "DH0321-003",
          "descripcionProveedor": "NIKE AIR MAX INTRLK 75",
          "numeroMaterial": "7000084013",
          "descripcionMaterial": "NIKE AIR MAX INTRLK 75",
          "generoProveedor": "HOMBRE",
          "divisionProveedor": "CALZADO",
          "categoriaProveedor": "CASUAL",
          "generoInnovasport": "HOMBRE",
          "divisionInnovasport": "CALZADO",
          "categoriaInnovasport": "CASUAL",
          "colorProveedor": "BLUE",
          "colorProveedorEsp": "AZUL",
          "colorInnovasport": "BLUE",
          "iniciativa": "PRUEBA",
          "fechaLanzamiento": "19.04.2024",
          "eanUpc": "195869217918",
          "coCuNew": "2",
          "mxSize": "31",
          "usSize": "31",
          "unidadEntrega": "1",
          "cantidadConfirmada": "1100",
          "descuentoUnitario": "53",
          "costoUnitarioInnovasportSinIva": "701.10",
          "precioRetailUnitarioSinIva": "701.10",
          "PrecioRetailUnitarioInteriorConIva": "813.28",
          "MontoTotalCostoSinIva": "771210.00",
          "MontoTotalRetailSinIva": "771210.00"
        }
      ]
    }
  ]
}
```

### Response

Si ifConfirmation es true (subido a CPI)

```json
{
  "error": false,
  "data": "{\"message\":[{\"returnType\":\"S\",\"returnId\":\"SAP\",\"returnNumber\":\"200\",\"returnMessage\":\"Orderbook creado exitosamente.\"}]}"
}
```

Si ifConfirmation es false (subido a Firebase)

```json
{
  "error": false,
  "msg": "FirestoreCollectionIDHere"
}
```
