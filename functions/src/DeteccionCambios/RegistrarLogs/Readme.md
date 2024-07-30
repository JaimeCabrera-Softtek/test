## registrarLogs

## Descripción

Esta función se llama desde react en el apartado de Monitor de cambios, vista para MDM o compras, básicamente actualiza el nodo Cambios de realtime (db_default) con los logs del rechazo de los cambios. El poceso también se reutiliza para escribir los logs de la aceptación de los cambios en las funciones [HandleMonitor](./../HandleMonitor/Readme.md) y [HandleMonitorMDM](./../HandleMonitorMDM/Readme.md).

Esta función recibe dos params:

- items: el mapa es una relacion <code>{["generico-sociedad"]-["campos", "con", "cambios"]}</code>, que representa, por generico y sociedad (1001 o 2001) y que cambios se van a aceptar o rechazar.
- approved: true para aprobar cambios, false para rechazarlos.

En base a los params, escribe en el nodo Cambios/generico/cambios/log -> la aprobación o el rechazo del cambio, obteniendo la estructura:

```json
{
  "7000003-2001": {
    // ... other info
    "cambios": {
      "Precio_compra": {
        "after": "333",
        "before": "257.38",
        "log": {
          "approved": true,
          "date": "2024-02-06T23:21:30.000Z",
          "user": "gUP34xNE7wVISIpva4ApDqGi4wx1"
        }
      },
      "Precio_venta": {
        "after": "777",
        "before": "649.0",
        "log": {
          "approved": true,
          "date": "2024-02-06T23:21:30.000Z",
          "user": "gUP34xNE7wVISIpva4ApDqGi4wx1"
        }
      }
    }
  }
}
```

También revisa si todos los campos en /cambios tienen log (si un campo tiene log, quiere decir que ya ha sido aprobado/rechazado), por lo que si todos tienen, asigna la bandera <code>allChangesCheck</code> como <code>true</code>.

## Endpoint

/DeteccionCambios-registrarLogs

## Request Body

```json
{
  "data": {
    "approved": false,
    "items": {
      "7000052-1001": ["Silueta"]
    }
  }
}
```

## Response

```json
{
  "data": {
    "items": ["7000052-1001"]
  },
  "error": false,
  "msg": "Cambios guardados con éxito."
}
```
