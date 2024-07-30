# Save Results

Después de aplicar las transformaciones, se condensan los resultados del worker de Transformaciones en esta carpeta y se almacenan en firestore en el path que les corresponde.

Así pues, suceden varias cosas:

1. Los productos que sí se pudieron transformar, se almacenan en realtime en los diversos nodos de Productos.
2. Los productos que no se pudieron transformar, se almacenan en un .json en storage.
3. De los poductos que se pudieron transformar, se detectan y se almacenan los productos con [Cambios](./../Readme.md/#detección-de-cambios).
4. De los poductos que se pudieron transformar, se detectan y se almacenan los productos con [UPC Reutilizados](./../Readme.md/#upc-reutilizados).
5. Se envian los correos de aviso a mdm (catálogos sin transformar) y compras (catálogos listos para selección).
6. Se edita el documento en catalogs actualizando totales y conteo de Siluetas, Deportes, Banners propuestos, etc.
