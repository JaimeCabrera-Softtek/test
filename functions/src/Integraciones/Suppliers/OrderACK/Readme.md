## OrderACK

### Endpoint

/Integraciones-Suppliers-contractACK

---

El proceso de esta cloud function es el siguiente:

### Acknowledge de Orden de compra

El usuario proveedor mediante el portal de IBN, manda un request para hacer el acknowledge en SAP de una órden de compra
Este json, se envía al endpoint de CPI para hacer el order ack.

Cuando responde correctamente, cambia el estatus del contrato en IBN (firestore y storage) a "Confirmado"

### Headers

### Request Body

```json
{
  "data": {
    "data": {
      "RecibeOrderAck": [
        {
          "detail": [
            {
              "eanUpc": "886737667743",
              "numeroMaterial": "000000000361177001",
              "cantidadConfirmada": "400.00",
              "fechaConfirmacion": "20240701"
            }
          ],
          "ordenCompraInnova": "4500000918",
          "ordenVentaProveedor": "291",
          "fechaConfirmacion": "20240701",
          "fechaMensaje": "20240712"
        }
      ],
      "order_id": "YT6YCUwj3chWSLGCNgBS"
    }
  }
}
```

### Response

```json
{
  "result": {
    "error": false,
    "msg": "ACK recibido y actualizado",
    "data": null
  }
}
```
