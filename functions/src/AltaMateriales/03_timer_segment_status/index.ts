import { onSchedule } from "firebase-functions/v2/scheduler";
import { db_materiales } from "../../firebase";
import { analytics } from "../../z_helpers/analytics";
import * as _ from "lodash";
import { CloudRes } from "../../interfaces/CloudRes";
import {
  SEGMENT_STATUS_BUFFER,
  SEGMENT_STATUS_PAGESIZE,
} from "../../z_helpers/constants";
import { processStatusUpdate } from "../03_segment_status";
import { SegmentStatusBuffer, SegmentStatusBufferItem } from "./interfaces";

/**
 * Función que cada minuto va a tomar elementos del buffer para guardar el status de la ejecución de los idocs
 */
export const timerSegmentStatus = onSchedule(
  {
    schedule: "every minute",
    timeoutSeconds: 540,
    memory: "8GiB",
    concurrency: 1,
  },
  async (event) => {
    console.log("Empezando ejecución", event.scheduleTime);
    const start = new Date().getTime();
    try {
      // Get Buffer
      const bufferRef = db_materiales.ref(SEGMENT_STATUS_BUFFER);
      const data = (await getItems(bufferRef)) as SegmentStatusBuffer;
      const hasItems = data !== null;

      if (hasItems) {
        /**
         * Los elementos que tomamos del buffer
         */
        const items = Object.values(data);

        // Actualizar la última vez que se actualizó/formó el status
        const updates: SegmentStatusBuffer = {};
        for (let i = 0; i < items.length; i++) {
          const item = items[i] as SegmentStatusBufferItem;
          updates[item.IDOCID] = {
            ...item,
            lastUpdate: new Date().getTime(), // FECHA DE LA ULTIMA VEZ QUE SE FORMÓ EL STATUS
          };
        }
        await bufferRef.update(updates);

        const promises = [];
        for (let n of items) {
          promises.push(processStatusUpdate(n));
        }

        //Esperar a que terminen de procesarse
        const res = await Promise.allSettled(promises);

        const arr = await Promise.all(
          res.map(async (x) => {
            if (x.status === "fulfilled") {
              // ? Eliminar el nodo en el buffer
              const bufferRef = db_materiales
                .ref(SEGMENT_STATUS_BUFFER)
                .child(x.value.idoc);
              await bufferRef.set(null);

              return x.value.msg;
            } else {
              // no se elimina el nodo, se queda esperando el reintento (10 mins después)
              console.log("Error guardando ->", JSON.stringify(x.reason));
              return x.reason
                ? (x.reason as Error).message
                : "Error actualizando status";
            }
          })
        );

        console.log(arr);

        const successful_count = res.filter(
          (x) => x.status === "fulfilled"
        ).length;

        const end = new Date().getTime();
        const msg = `Se guardaron ${successful_count} estados. ${
          res.length - successful_count
        } no se pudieron actualizar. ${end - start} ms`;
        console.log(msg);

        if (res.length > 0) {
          const obj: CloudRes = {
            error: false,
            msg,
            data: arr,
          };
          await analytics(
            { date: new Date(start).toISOString() },
            start,
            "AltaMateriales-timerSegmentStatus",
            obj,
            "AltaMateriales",
            "job"
          );
        }
      } else {
        const msg = "No hay elementos desbloqueados en el buffer";
        console.log(msg);
      }
    } catch (e) {
      const msg = (e as Error).message;
      console.log(msg);

      const obj: CloudRes = {
        error: true,
        msg,
        data: null,
      };
      await analytics(
        { date: new Date(start).toISOString() },
        start,
        "AltaMateriales-timerSegmentStatus",
        obj,
        "AltaMateriales",
        "job"
      );
    }
  }
);

/** Función que obtiene los items a procesar. Aquellos que se acaben de formar o lleven 10 minutos bloqueados, que se procesaron por ultima vez hace 10 mins (lastUpdate) */
const getItems = async (bufferRef: any) => {
  const pageSize = (
    await db_materiales.ref(SEGMENT_STATUS_PAGESIZE).once("value")
  ).val();
  const tenMinutesAgo = new Date().getTime() - 10 * 60 * 1000; // Tiempo actual menos 10 minutos
  let lastCreatedAt = null;
  let items: SegmentStatusBuffer = {};
  let finished = false;

  // Con el ciclo aseguramos que no se quede bloqueada la cola mientras se procesan los jobs. Se ejecuta hasta que encuentre items desbloqueados o se haya acabado el nodo.
  while (_.values(items).length === 0 && !finished) {
    let query: any;
    if (lastCreatedAt) {
      // Si ya tenemos un timestamp para continuar la búsqueda, lo usamos
      query = bufferRef
        .orderByChild("createdAt")
        .startAfter(lastCreatedAt)
        .limitToFirst(pageSize);
    } else {
      // Si no, hacemos la primera consulta sin restricciones
      query = bufferRef.orderByChild("createdAt").limitToFirst(pageSize);
    }

    // get data
    const snapshot = await query.once("value");
    const tempItems: SegmentStatusBuffer = {};

    snapshot.forEach((sp: any) => {
      const item = sp.val() as SegmentStatusBufferItem;

      // SI VA MÁS DE 10 MINUTOS QUE SE PROCESÓ EL ITEM POR ULTIMA VEZ, VOLVER A SELECCIONARLO PARA SER PROCESADO
      if ((item.lastUpdate ?? 0) <= tenMinutesAgo) {
        tempItems[item.IDOCID] = item;
      }
    });

    if (_.values(tempItems).length > 0) {
      items = tempItems;
    } else {
      // Si no encontramos items, ajustamos lastCreatedAt para la siguiente consulta
      const lastItem = snapshot.val() && _.values(snapshot.val()).pop();
      if (lastItem) {
        lastCreatedAt = lastItem.createdAt;
      } else {
        // Si no hay más items en la base de datos, terminamos la búsqueda
        finished = true;
      }
    }
  }

  return items;
};
