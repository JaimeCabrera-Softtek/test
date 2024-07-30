# R91 Réplica de precios de venta

Los ajustes de precios a los productos se hacen directamente en SAP. Es por ello que se le replican a IBN por medio de esta interfaz.

Los precios son recibidos de uno por uno y se guardan en firebase realtime DB, en el shard de materiales, en el nodo `PreciosVentaSAP`.

Estos precios se usarán para cálculos y lógica que se aplica en la interfaz [R55](../../../AltaMateriales/z_sendSegment/helpers/segment_body_helpers/5.ts) para envío de precios de venta durante flujo de alta de materiales cuando el proveedor sube un catálogo donde le cambia precios a los productos.

## Request

POST `/Integraciones-S4-R91_replicaPrecios`

### Body
```json
{
	"data": {
		"Precios": [
			{
				"organizacionVentas": "1001",
				"canalDistribucion": "10",
				"claseCondicion": "VKP0",
				"numeroMaterial": "000000000007000017",
				"listadePrecios": "xxx",
				"E1KONH": [
					{
						"inicioValidez": "20240109",
						"finValidez": "99991231",
						"E1KONP": [
							{
								"claseCondicion": "VKP0",
								"precioVenta": "100.00"
							},
							{
								"claseCondicion": "VKP1",
								"precioVenta": "121.00"
							}
						]
					}
				]
			},
			{
				"organizacionVentas": "1001",
				"canalDistribucion": "10",
				"claseCondicion": "VKP0",
				"numeroMaterial": "000000000007000016",
				"listadePrecios": "xxx",
				"E1KONH": [
					{
						"inicioValidez": "20240109",
						"finValidez": "99991231",
						"E1KONP": [
							{
								"claseCondicion": "VKP0",
								"precioVenta": "100.00"
							},
							{
								"claseCondicion": "VKP1",
								"precioVenta": "121.00"
							}
						]
					}
				]
			},
			{
				"organizacionVentas": "1002",
				"canalDistribucion": "10",
				"claseCondicion": "VKP0",
				"numeroMaterial": "000000000007000016",
				"listadePrecios": "xxx",
				"E1KONH": [
					{
						"inicioValidez": "20240109",
						"finValidez": "99991231",
						"E1KONP": [
							{
								"claseCondicion": "VKP0",
								"precioVenta": "100.00"
							},
							{
								"claseCondicion": "VKP1",
								"precioVenta": "121.00"
							}
						]
					}
				]
			}
		]
	}
}
``

### Response
```json
{
	"result": {
		"message": [
			{
				"returnType": "S",
				"returnId": "IBN",
				"returnNumber": "200",
				"returnMessage": "Los precios del material 000000000007000017 han sido guardados"
			},
			{
				"returnType": "S",
				"returnId": "IBN",
				"returnNumber": "200",
				"returnMessage": "Los precios del material 000000000007000016 han sido guardados"
			}
		]
	}
}
```