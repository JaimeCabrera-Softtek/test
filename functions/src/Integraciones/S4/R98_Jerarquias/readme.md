# Función de Sincronización de Jerarquías desde SAP

## Descripción
Esta función se encarga de obtener jerarquías desde SAP y actualizar los catálogos correspondientes en la Realtime Database de Firebase. El proceso se realiza en tiempo real, asegurando que los catálogos estén siempre actualizados con la información más reciente.

## Entrada
La función recibe un JSON request. Utilizando el esquema definido en este JSON, la función construye un mapa de tiendas (por ejemplo, Innovasport, Invictus, etc.), donde cada tienda contiene la información especificada en el request.

## Procesamiento
### Extracción de Jerarquías
Una vez recibido el request, la función extrae la información del nodo `E1WAH02`, el cual contiene detalles de las jerarquías a procesar.

### Actualización de Catálogos: `updateCatalog`
Con la información extraída, se procede a obtener y actualizar los catálogos de:
- División
- Deporte
- Marca
- Familia

Estos catálogos son actualizados en la Realtime Database, asegurando que la información refleje las últimas jerarquías obtenidas de SAP.

## Función Auxiliar: `removeAccentsAndSpecialChars`
Para facilitar las búsquedas y mantener un estándar en los catálogos, se implementa una función auxiliar que estandariza el texto. Esta estandarización incluye:
- Eliminación de acentos.
- Eliminación de caracteres especiales.
- Conversión de las claves a mayúsculas (`UPPER CASE`).

### Importancia
La estandarización es crucial ya que los datos provenientes de SAP carecen de un formato estandarizado, presentando a veces caracteres especiales o diferencias en el uso de mayúsculas y minúsculas. La clave en mayúsculas facilita las búsquedas en otros catálogos, mejorando la eficiencia y precisión del proceso de sincronización.

## Resumen
Esta función automatiza la actualización de catálogos en la Realtime Database a partir de jerarquías obtenidas de SAP, asegurando la consistencia y accesibilidad de los datos. La estandarización del texto es un paso crítico en el proceso, mejorando significativamente la integración y manejo de la información en los sistemas downstream.
