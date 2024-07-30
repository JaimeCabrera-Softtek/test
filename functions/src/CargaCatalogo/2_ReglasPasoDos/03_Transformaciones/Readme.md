# Transformaciones

Las transformaciones se aplican por medio de un Worker. Es decir, del arreglo inicial de productos, se obtienen batches de +-2000 articulos (cuidando que en el batch se incluyan todos los UPC del mismo Estilo), y se les aplica el mismo proceso a todos los batches en diferentes hilos, que se ejecutan a la vez. Esto ahorra tiempos de respuesta.

Importante tener en cuenta que considera que los productos a transformar ya han pasado la validación de reglas simples y complejas.

Al finalizar el worker, se tiene un arreglo de resultados por cada hilo, o batch procesado, dichos resultados se condensan en un solo objeto de resultados y se trabaja con ellos.

El proceso que aplica las transformaciones se encuentra en la libreria node @fridaplatform-stk/motor-reglas.

El mapa de transformaciones que se aplica se obtiene de firestore al inicializar el worker, y se comparte a las tareas por el workerData.

También se incluyen otros procesos de transformación que no se encuentran en el motor de reglas (como quitar color y talla de la descripción).

Además de las transformaciones, se aplican:

1. Las reglas de tallas (mismas que se debian aplicar una vez transformados los productos, y sus resultados pueden alterar los resultados de las [Reglas complejas](./../02_ValidacionReglas2/Readme.md)).
2. Detección de [Jerarquías solicitadas](./../Readme.md/#detección-de-jerarquias-faltantes).
3. Detección de [Cambios].
4. Detección de [UPC reutilizados](./../Readme.md/#upc-reutilizados).
