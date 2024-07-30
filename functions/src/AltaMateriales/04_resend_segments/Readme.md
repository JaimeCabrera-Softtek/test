# AltaMateriales-resendSegments

API que nos permite reenviar varios segmentos a SAP.

Recibe un arreglo de job ids, identifica en cual segmento falló cada job, y lo reenvía a SAP.
Si recibe el campo "segment" en el body, se reenviará ese segmento a todos los jobs.

En caso de que un job enviado en el arreglo no tenga segmentos fallidos, lo ignora.
