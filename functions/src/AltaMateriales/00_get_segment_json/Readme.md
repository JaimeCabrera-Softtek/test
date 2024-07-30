# AltaMateriales-getSegmentJSON

API auxiliar, no productiva... nadie debe de usarla en producción.

Lo que hace esta API es: dado un job de `AltaMateriales` y un número de segmento, construir y devolvernos el body que se le mandó (o mandaría) a CPI.

POST `/AltaMateriales-getSegmentJSON`

### Body
```json
{
	"job": "-NpRRcO53T7JYTw-8OxG",
	"segment": 3
}
```

### Response
```json
{
	"registroInfo": [
		{
			"codigoInterno": "-NpRRcO53T7JYTw-8OxG",
			"funcion": "",
			"material": "000000000000000125",
			"proveedor": "0010000006",
			"materialProveedor": "Shorts8888",
			"proveedorRegular": "X",
			"E1EINEM": [
				{
					"organizacionCompras": "1001",
					"grupoCompras": "TXT",
					"precioNeto": "215.08",
					"precioEfectivo": "215.08",
					"grupoCondicionesProveedor": "",
					"indicadorImpuestos": "",
					"claveControlConfirmacion": "Z004",
					"controlFechaPrecio": "2"
				},
				{
					"organizacionCompras": "1002",
					"grupoCompras": "TXT",
					"precioNeto": "215.08",
					"precioEfectivo": "215.08",
					"grupoCondicionesProveedor": "",
					"indicadorImpuestos": "",
					"claveControlConfirmacion": "Z004",
					"controlFechaPrecio": "2"
				}
			]
		}
	]
}
```