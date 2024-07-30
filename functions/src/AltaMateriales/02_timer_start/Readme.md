# AltaMateriales timerStart

Esta función consulta periódicamente el nodo de realtime database (materiales) `CloudTasksBuffer`

Los elementos existentes son filtrados para determinar seleccionar aquellos que deban de ser enviados por primera vez o que necesitan reintento a CPI por medio de nuestra GCP CloudTask. Es ésta la que se encarga de mandar la carga de forma controlada para evitar acaparar los recursos y terminar en errores, perdiendo IDOCs