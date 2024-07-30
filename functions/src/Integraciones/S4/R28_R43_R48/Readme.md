## R28_R43_R48

### Endpoint

/Integraciones-S4-R28_R43_R48

---

El proceso de esta cloud function es el siguiente:

### Registro de Contrato / Orden de Compra / Devolución

#### Cuando se envía un nuevo idoc para cualquiera de los casos (contrato, órden de compra y devolución), esta cloud function se encarga de:

- Separar las cabeceras y guardarlas en un documento nuevo en firestore dependiendo del tipo del documento (/contracts, /orders, /returns)
- Los detalles de productos, se guardan en un json de detalles donde contiene por completo el documento en storage (/contracts, /orders, /returns)
  -Arma y envia el request al endpoint que genera el xml de este documento para proveedor nike

#### Cuando se envía una actualización

Solo en ordenes de compra y contratos, se guardan las nuevas cabeceras, los detalles no se sobreescriben

### Headers

#### x-ibn-token

El token de usuario que se genera con /api/token

### Request Body

```json
{
  "data": {
    "Pedido": {
      "moneda": "MXN",
      "condicionPago": "NT90",
      "claseDocumento": "ZDPD",
      "numeroDocumento": "6000000007",
      "organizacionCompras": "1001",
      "grupoCompras": "TXT",
      "sociedad": "1001",
      "fechaDocumento": "20240617",
      "inicioValidez": "20240614",
      "finValidez": "20240630",
      "nombreProveedor": "NIKE DE MEXICO S. DE R.L. DE C.V.",
      "canal": "01",
      "proveedor": "1000099",
      "referencia": "14062024",
      "centroEntrega": "0370",
      "nombre": "CEDIS Edo Mx",
      "direccion": "CUAUTITLAN-MELCHOR OCA SN, LCC",
      "ciudad": "CUAUTITLAN",
      "cp": "54800",
      "pais": "MX",
      "estado": "MEX",
      "incoterms": "FOB",
      "lugarIncoterms": "Franco a Bordo",
      "margen": "50",
      "E1EDP01": [
        {
          "posicion": "00020",
          "accion": "001",
          "tipoPosicion": "0",
          "cantidad": "3.000",
          "unidadMedida": "PI",
          "costoUnitario": "497.37",
          "precioNeto": "1492.11",
          "grupoArticulos": "MTXCAS012",
          "centro": "0370",
          "almacen": "1002",
          "materialProveedor": "FB8276-386",
          "numeroMaterial": "000000000281222002",
          "descripcion": "NIKE CASUAL SPORTSWEAR ESSENTIALS",
          "eanUpc": "196607968758",
          "anoTemporada": "2024",
          "temporada": "Q3",
          "color": "VERDE",
          "talla": "CH",
          "precioVenta": "1049.00",
          "marca": "NIKE",
          "fechaEntregaEstimada": "20240701"
        },
        {
          "posicion": "00030",
          "accion": "001",
          "tipoPosicion": "0",
          "cantidad": "2.000",
          "unidadMedida": "PI",
          "costoUnitario": "638.68",
          "precioNeto": "1277.36",
          "grupoArticulos": "MTXCAS012",
          "centro": "0370",
          "almacen": "1002",
          "materialProveedor": "FD4286-104",
          "numeroMaterial": "000000000287611003",
          "descripcion": "TOP MANGA CORTA",
          "eanUpc": "196968364886",
          "anoTemporada": "2024",
          "temporada": "Q3",
          "color": "BLANCO",
          "talla": "EXG",
          "precioVenta": "1349.00",
          "marca": "NIKE",
          "fechaEntregaEstimada": "20240701"
        },
        {
          "posicion": "00040",
          "accion": "001",
          "tipoPosicion": "0",
          "cantidad": "1.000",
          "unidadMedida": "PI",
          "costoUnitario": "520.32",
          "precioNeto": "520.32",
          "grupoArticulos": "MTXCAS012",
          "centro": "0370",
          "almacen": "1002",
          "materialProveedor": "FV8002-363",
          "numeroMaterial": "000000000293686005",
          "descripcion": "W NSW TEE AIR BF.",
          "eanUpc": "196975826520",
          "anoTemporada": "2024",
          "temporada": "Q3",
          "color": "VERDE",
          "talla": "EXG",
          "precioVenta": "1099.00",
          "marca": "NIKE",
          "fechaEntregaEstimada": "20240701"
        }
      ]
    }
  }
}
```

### Response

```json
{
  "error": false,
  "message": [
    {
      "returnType": "S",
      "returnId": "IBN",
      "returnNumber": "200",
      "returnMessage": "Devolucion guardado correctamente con numeroDocumento 6000000007"
    }
  ]
}
```
