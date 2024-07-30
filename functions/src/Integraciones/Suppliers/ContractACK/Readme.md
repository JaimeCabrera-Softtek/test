## ContractACK

### Endpoint

/Integraciones-Suppliers-contractACK

---

El proceso de esta cloud function es el siguiente:

### Acknowledge de Contrato

El usuario proveedor mediante el portal de IBN, manda un request para hacer el acknowledge en SAP de un contrato
Este json, se envía al endpoint de CPI para hacer el contract ack.

Cuando responde correctamente, cambia el estatus del contrato en IBN (firestore y storage) a "Aceptado"

### Headers

### Request Body

```json
{
  "data": {
    "data": {
      "confirmaContrato": [
        {
          "detail": [
            {
              "numeroEan": "4063697439955",
              "numeroMaterial": "000000000362583006",
              "cantidadConfirmada": "1000.00",
              "fechaConfirmaPosicion": "20240703"
            },
            {
              "numeroEan": "4063697439962",
              "numeroMaterial": "000000000362583007",
              "cantidadConfirmada": "1000.00",
              "fechaConfirmaPosicion": "20240703"
            },
            {
              "numeroEan": "4063697448001",
              "numeroMaterial": "000000000362584001",
              "cantidadConfirmada": "1000.00",
              "fechaConfirmaPosicion": "20240703"
            },
            {
              "numeroEan": "4063697448018",
              "numeroMaterial": "000000000362584002",
              "cantidadConfirmada": "1000.00",
              "fechaConfirmaPosicion": "20240703"
            },
            {
              "numeroEan": "4063697448025",
              "numeroMaterial": "000000000362584003",
              "cantidadConfirmada": "1000.00",
              "fechaConfirmaPosicion": "20240703"
            },
            {
              "numeroEan": "4063697448032",
              "numeroMaterial": "000000000362584004",
              "cantidadConfirmada": "1000.00",
              "fechaConfirmaPosicion": "20240703"
            },
            {
              "numeroEan": "4063697448049",
              "numeroMaterial": "000000000362584005",
              "cantidadConfirmada": "1000.00",
              "fechaConfirmaPosicion": "20240703"
            }
          ],
          "ordenCompra": "5500020631",
          "ordenVenta": "291",
          "fechaConfirmacion": "20240703",
          "fechaMensaje": "20240712"
        }
      ],
      "contract_id": "sowgklJYkFWZBVDvFEPe",
      "proveedor": "1000099",
      "numeroDocumento": "5500020631"
    }
  }
}
```

### Response

```json
{
  "error": false,
  "msg": "ACK recibido y actualizado",
  "data": null
}
```
