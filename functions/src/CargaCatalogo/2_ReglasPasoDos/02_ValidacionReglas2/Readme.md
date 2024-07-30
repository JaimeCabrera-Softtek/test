# Validación de reglas dos

La Validación de reglas complejas se aplica por medio de un Worker. Es decir, del arreglo inicial de productos, se obtienen batches de +-2000 articulos (cuidando que en el batch se incluyan todos los UPC del mismo Estilo), y se les aplica el mismo proceso a todos los batches en diferentes hilos, que se ejecutan a la vez. Esto ahorra tiempos de respuesta.

Al finalizar el worker, se tiene un arreglo de resultados por cada hilo, o batch procesado, dichos resultados se condensan en un solo objeto de resultados y se trabaja con ellos.

El proceso que aplica las reglas complejas se encuentra en la libreria node @fridaplatform-stk/motor-reglas.

El mapa de reglas que se aplica se obtiene de firestore al inicializar el worker, y se comparte a las tareas por el workerData.

Después de aplicar las reglas y condensar los resultados del worker, se escribe en una carpeta (roothPath) un json que contiene los productos que no pasaron las reglas, también escribe su ruta en el documento del catálogo (catalogs/catalogID), en el campo paths.error_rules2.

A los productos que pasaron las reglas, se les aplica el proceso de [Transformación](./../03_Transformaciones/Readme.md).
