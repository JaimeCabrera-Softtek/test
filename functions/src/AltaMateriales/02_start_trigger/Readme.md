# AltaMateriales-startTrigger

Esta función se dispara automáticamente cuando se crea un job. El job puede ser de cualquier tipo, la lógica a aplicar dependerá del tipo.

Hay dos opciones

1. Se manda directamente a SAP
2. Se manda de manera controlada, para no saturar los recursos de CPI/SAP

En el segundo caso, se utilizan recursos adicionales

- Buffer (Nodo CloudTasksBuffer en realtime database)
- [timer trigger](../02_timer_start/Readme.md)
- GCP CloudTasks

## nuevo_completo

Se mandan 6 segmentos a CPI para la creación de un material completamente nuevo desde su genérico y todas las tallas (variantes)

Empezamos obviamente con el segmento 1, lo cual encola un IDOC que se procesará asíncronamente y SAP nos reportará el status de su procesamiento por medio de [AltaMateriales-segmentStatus](../03_segment_status/Readme.md)

## extension_de_banner

Se mandan 4 segmentos, iniciando en el segmento 3, Registro Info.

## cambio_precios

Se mandan 2 o 1 segmentos, [dependiendo los precios](./../01_batch_creation/Readme.md#tipo-cambio_precios) que tendrán modificación.
