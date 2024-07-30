## handleMonitor_MDM

## Descripción

Esta función se llama desde react en el apartado de Monitor de cambios, vista para MDM, donde solo se pueden aceptar aquellos campos **que no sean precios**, mismos que se detectaron en la subida del catálogo (ver [Detección de cambios](./../../CargaCatalogo/2_ReglasPasoDos/Readme.md/#detección-de-cambios)).

Los cambios que aprueba el MDM no se envian a SAP, se quedan guardados en realtime en los nodos de Productos (Catálogos, Historial y Productos por providerID y brandID).

Esta función recibe un mapa (campo items), el mapa es una relacion <code>{["generico-sociedad"]-["campos", "con", "cambios"]}</code>, que representa, por generico y sociedad (1001 o 2001) y cambios que se van a manejar, obtiene del nodo /Materiales (db_materiales) los UPC afectados, y hace los updates pertinentes en los nodos Productos (db_default), basandose en el nodo Cambios (db_default) para actualizar los valores nuevos (campo after).

Después, actualiza el nodo Cambios de realtime (db_default) con los logs correspondientes (ver [registrarLogs](../RegistrarLogs/Readme.md)).

## Endpoint

/DeteccionCambios-handleMonitor_MDM

## Request Body

```json
{
  "data": {
    "items": {
      "358355-1001": ["Silueta"]
    }
  }
}
```

## Response

```json
{
  "data": {
    "items": ["358355-1001"]
  },
  "error": false,
  "msg": "Cambios realizados con éxito."
}
```
