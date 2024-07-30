# Documentación de Función para Gestión del Catálogo de Grupos de Artículos

## Descripción General
Esta función está diseñada para manejar eficientemente el catálogo de Grupo de Artículos. Su propósito principal es recibir, procesar y almacenar la información pertinente en la Realtime Database, asegurando así una gestión eficaz y actualizada de los datos del catálogo.

## Entrada de Datos
La función recibe datos a través de un request en formato JSON, estructurado según un schema predefinido para garantizar la integridad y el formato correcto de los datos suministrados.

### Estructura del información guardada en la base de datos
La información se almacena en la base de datos de la siguiente manera: 

```json
{
  "GruposArticulos": {
    "CACC05762": {
      "descripcion": "ANUNCIOS LUMINOSOS",
      "detalles": {
        "centro": "0000000001",
        "fechaActivacion": "20240117",
        "fechaModificacion": "00000000",
        "numero2": "00",
        "enlaceGrupos": "CACC05"
      }
    },
    "CACC05": {
      "descripcion": "CONSTRUCCION",
      "detalles": {
        "centro": "0000000001",
        "fechaActivacion": "20240117",
        "fechaModificacion": "00000000",
        "numero2": "01",
        "enlaceGrupos": "CAC"
      },
      "subGrupos": ["CACC05762", "CACC05763"]
    }, ...
  }
}
```
### Importancia de la estructura usada para almacenar la información
Esta estructura permite manejar los enlaces entre grupos, asegurando que el grupo padre este presente y añade el articulo a la lista de subgrupos del padre.