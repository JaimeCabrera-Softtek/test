### Crear ASN

Esta function crea un documento en firestore para el encabezado de un ASN y un arhivo tipo json en storage para guardar los detalles del ASN.

### El body es el siguiente

```json
{
  "data": {
    "encabezado": {
      "tipo_encabezado": "HD", 
      "tipo_operacion": "A",
      "blanco": "0000",
      "fecha_factura": "20231013",
      "fecha_embarque": "20231013",
      "fecha_entrega": "20231026",
      "hora_entrega": "1000",
      "no_provedor": "1000454",
      "rfc": "SME-220527-3B9",
      "no_orden": "4501090247",
      "factura": "A1719",
      "importe_factura": "00009110742",
      "id_categoria": "1130",
      "no_cedis": "00066"
    },
    "contenedores": {
      "4501090247A1719000001": { // Cada contenedor tiene que tener su identificador
        "tipo_encabezado": "CN",
        "no_tienda": "00126",
        "tipo_contenedor": "0",
        "no_caja": "4501090247A1719000001",
        "contenido": [ 
          {
            "tipo_encabezado": "DT",
            "codigo_barra": "192290265280",
            "tipo_codigo": "EAN",
            "blanco": "",
            "estilo_modelo": "1577051464",
            "talla": "L",
            "color": "AZUL",
            "no_piezas": "4",
            "unidad": "PZA",
            "no_piezas_unidad": "1",
            "costo_unitario": "55819"
          }
        ]
      },
			"4501090247A1719000002": {
        "tipo_encabezado": "CN",
        "no_tienda": "00126",
        "tipo_contenedor": "0",
        "no_caja": "4501090247A1719000002",
				"contenido": [ 
        ]
      }
    }
  }
}
```

### Response exitoso

```json
{
	"error": false, 
	"msg": "ASN creado exitosamente",
	"data": //Encabezado que se mando en el body
}
```

### Response de error

```json
{
	"error": true,
	"msg": "Error al guardar datos", // Si no se manda token regresa "NO SE ENCONTRO AUTORIZACION"
	"data": // Informacion del error, si no se encontro autorizacion este campo estara vacio.
}
```
### Proceso de la funcion

La funcion genera un documento en firestore y guarda el id automatico que se le asigna. Utiliza esta id para generar el path de donde se va a guardar el archivo json en storage <code>const filePath = `asn/${providerId}/asn_${docRef.id}.json`</code>. Despues de esto calcula el total de productos que hay en el ASN y lo guarda en la variable total.
Despues de hacer eso le agrega los campos doc_id, quantity y asn_path al encabezado y guarda el encabezado a firestore.
Los detalles los guarda en storage sin hacer cambios.