# AltaMateriales timerSegmentStatus

Esta función consulta periódicamente el nodo de realtime database (materiales) `SegmentStatusBuffer`

Los elementos existentes son los estados de la ejecución de los idocs que SAP nos reporta por medio de [segmentStatus](./../03_segment_status/Readme.md), en el proceso de lectura, son filtrados para seleccionar aquellos que deban de ser procesados por primera vez o que necesitan reintento.

Los estados que sean procesados correctamente, se eliminarán del buffer.

> IMPORTANTE: El hecho de escribir ese status en realtime DB, detona la ejecución de [AltaMateriales-nextSegment](../04_next_segment/Readme.md) lo cual envía el siguiente segmento a SAP según corresponda por su tipo de job. De nuevo, esperaremos que SAP reporte el status de ese segmento por medio de [segmentStatus](./../03_segment_status/Readme.md), antes de enviar el siguiente.

Los estados o nodos que no se hayan podido procesar, se quedarán en el buffer para el próximo reintento (10 mins después).
