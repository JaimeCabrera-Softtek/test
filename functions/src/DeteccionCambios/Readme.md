# DeteccionCambios

Esta subcarpeta incluye funciones para el proceso de aceptar/rechazar cambios en la carga del catálogo (Monitor de cambios), una vez que se ejecutó la [Detección de cambios](./../CargaCatalogo/2_ReglasPasoDos/Readme.md/#detección-de-cambios) y hay registros en el nodo Cambios (db_default).

Son utilizadas por el rol compras y mdm.

- [handleMonitor](./HandleMonitor/Readme.md) (compras)
- [handleMonitor_MDM](./HandleMonitorMDM/Readme.md) (MDM)
- [registrarLogs](./RegistrarLogs/Readme.md)
