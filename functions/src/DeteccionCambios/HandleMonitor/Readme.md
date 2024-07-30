# handleMonitor

## Descripción

Esta función se llama desde el app web (react) en el apartado de **Monitor de cambios de precios**, con el rol de compras.

Esta función recibe un mapa (campo items), el mapa es una relacion <code>{["generico-sociedad"]-["campos", "con", "cambios"]}</code>, que representa, por generico y sociedad (1001 o 2001), que cambios de precios se van a enviar a SAP. En base al mapa se realizan los siguientes procesos:

1. Obtiene un arreglo de items con el formato aceptado por batch-creation (ver [AltaMateriales-batchCreation](./../../AltaMateriales/01_batch_creation/Readme.md)), tomando como base los registros en el nodo /Materiales (db_materiales), pero SUSTITUYENDO los valores que se van a cambiar, estos nuevos valores están en realtime en el nodo Cambios (db_default) y se registraron al momento de subir el catálogo (ver [Detección de cambios](./../../CargaCatalogo/2_ReglasPasoDos/Readme.md/#detección-de-cambios)).
   > Importante en este proceso, se asigna el campo y valor _subtype_, importante en el Alta de Materiales, ya que define que segmentos se van a enviar a SAP. Los valores que pueden tomar son: cambio_precios, cambio_precio_venta y cambio_precio_compra.
2. Envía a CPI los segmentos correspondientes de acuerdo al tipo de cambio:
   - Cambio de precios compra y venta: segmento 4 y 5
   - Cambio de precio compra: segmento 4
   - Cambio precio venta: segmento 5
3. Inicializar el nodo AltaMateriales (db_materiales) en realtime para el tracking de los segmentos correspondientes al tipo de cambio.
4. Actualiza el nodo Cambios de realtime (db_default) con los logs correspondientes (ver [registrarLogs](../RegistrarLogs/Readme.md)).

## Endpoint

/DeteccionCambios-handleMonitor

## Request Body

```json
{
  "data": {
    "items": {
      "350044-1001": ["Precio_venta", "Precio_compra"]
    }
  }
}
```

## Response

```json
{
  {
    "data": {
      "items": [
        {
          "Ano": "2024",
          "Banners": [
            "INNOVASPORT"
          ],
          "Catalog_ID": "CAMBIO_PRECIO2",
          "Catalogo": "Fl0AZAsX64QeNE4e0eAq",
          "Color": "NEGRO",
          "Deporte": "CASUAL",
          "Descripcion_corta": "U NK DF CLUB CAP",
          "Division": "ACCESORIOS",
          "Estilo": "FB5372-010",
          "Genero": "UNISEX",
          "Marca": "NIKE",
          "NumMatGenerico": 350044,
          "Precio_compra": "509.70",
          "Precio_venta": "1049.00",
          "Provider_name": "NIKE",
          "Sociedad": "1001",
          "Temporada": "Q3",
          "providerIDSAP": "1000099",
          "subtype": "cambio_precios",
          "variantes": {
            "00196606812342": {
              "consecutivo": 1,
              "tallaProveedor": "EXCH/CH",
              "upc": "00196606812342"
            },
            "00196606812359": {
              "consecutivo": 2,
              "tallaProveedor": "CH/M",
              "upc": "00196606812359"
            },
            "00196606812366": {
              "consecutivo": 3,
              "tallaProveedor": "M/G",
              "upc": "00196606812366"
            },
            "00196606812373": {
              "consecutivo": 4,
              "tallaProveedor": "G/EXG",
              "upc": "00196606812373"
            }
          }
        }
      ],
      "jobID": {
        "-O1OaNDDMMuZKvNkGvpI": {
          "art": {
            "Ano": "2024",
            "Banners": [
              "INNOVASPORT"
            ],
            "Catalog_ID": "CAMBIO_PRECIO2",
            "Catalogo": "Fl0AZAsX64QeNE4e0eAq",
            "Color": "NEGRO",
            "Deporte": "CASUAL",
            "Descripcion_corta": "U NK DF CLUB CAP",
            "Division": "ACCESORIOS",
            "Estilo": "FB5372-010",
            "Genero": "UNISEX",
            "Marca": "NIKE",
            "NumMatGenerico": 350044,
            "Precio_compra": "509.70",
            "Precio_venta": "1049.00",
            "Provider_name": "NIKE",
            "Sociedad": "1001",
            "Temporada": "Q3",
            "providerIDSAP": "1000099",
            "variantes": {
              "00196606812342": {
                "consecutivo": 1,
                "tallaProveedor": "EXCH/CH",
                "upc": "00196606812342"
              },
              "00196606812359": {
                "consecutivo": 2,
                "tallaProveedor": "CH/M",
                "upc": "00196606812359"
              },
              "00196606812366": {
                "consecutivo": 3,
                "tallaProveedor": "M/G",
                "upc": "00196606812366"
              },
              "00196606812373": {
                "consecutivo": 4,
                "tallaProveedor": "G/EXG",
                "upc": "00196606812373"
              }
            }
          },
          "consecutivo": 350044,
          "date": "2024-07-09T22:24:53.137Z",
          "push_id": "-O1OaNDDMMuZKvNkGvpI",
          "status": {
            "4": {
              "date": "2024-07-09T22:24:53.137Z",
              "msg": "",
              "status": "pending",
              "success": false
            },
            "5": {
              "date": "2024-07-09T22:24:53.137Z",
              "msg": "",
              "status": "pending",
              "success": false
            }
          },
          "type": "cambio_precios",
          "uid": "3w0b6Lza66M8RR1q9jejxbTWNo83"
        }
      }
    },
    "error": false,
    "msg": "Cambio de precios enviado a S4 con éxito"
  }
}
```
