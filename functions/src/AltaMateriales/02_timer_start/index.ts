import { onSchedule } from "firebase-functions/v2/scheduler";

import { db_materiales } from "../../firebase";
import {
  THROTTLE_BUFFER,
  THROTTLE_BUFFER_PAGESIZE,
} from "../../z_helpers/constants";
import { queueTask } from "../04_send_task/queueTask";
import { analytics } from "../../z_helpers/analytics";
import * as _ from "lodash";
import { CloudRes } from "../../interfaces/CloudRes";

interface ThrottleBuffer {
  [key: string]: ThrottleBufferItem;
}

interface ThrottleBufferItem {
  jobID: string;
  segment: 1 | 2 | 3 | 4 | 5 | 6;
  createdAt: number;
  lastUpdate?: number;
}

/**
 * Función que cada minuto va a tomar elementos del buffer para enviarlos a las CloudTasks
 */
export const timerStart = onSchedule(
  {
    schedule: "every minute",
    timeoutSeconds: 540,
    memory: "4GiB",
    concurrency: 1,
  },
  async (event) => {
    console.log("Empezando ejecución", event.scheduleTime);
    const start = new Date().getTime();
    try {
      // Get Buffer
      const bufferRef = db_materiales.ref(THROTTLE_BUFFER);
      const data = (await getItems(bufferRef)) as ThrottleBuffer;
      const hasItems = data !== null;

      if (hasItems) {
        /**
         * Los elementos que tomamos del buffer
         */
        const items = Object.values(data);

        // Actualizar la última vez que se actualizó/formó la task
        const updates: ThrottleBuffer = {};
        for (let i = 0; i < items.length; i++) {
          const item = items[i] as ThrottleBufferItem;
          updates[item.jobID] = {
            ...item,
            lastUpdate: new Date().getTime(), // FECHA DE LA ULTIMA VEZ QUE SE FORMÓ LA TASK
          };

          console.log(
            `Se va a actualizar el job ${item.jobID}, segmento ${
              item.segment
            }, lastUpdate: ${
              item.lastUpdate ?? 0
            }, ahora: ${new Date().getTime()}`
          );
        }
        await bufferRef.update(updates);

        // enviar las task
        let promises = [];
        for (let i of items) {
          promises.push(queueTask(i.jobID, i.segment));
        }

        const results = await Promise.allSettled(promises);

        const successful_count = results.filter(
          (x) => x.status === "fulfilled"
        ).length;

        const end = new Date().getTime();
        const msg = `Encolamos ${successful_count} elementos ${end - start} ms`;
        console.log(msg);

        if (successful_count > 0) {
          const obj: CloudRes = {
            error: false,
            msg,
            data: null,
          };
          await analytics(
            { date: new Date(start).toISOString() },
            start,
            "AltaMateriales-timerStart",
            obj,
            "AltaMateriales",
            "job"
          );
        }
      } else {
        const msg = "No hay elementos desbloqueados en el buffer";
        console.log(msg);
        // const obj: CloudRes = {
        //   error: false,
        //   msg,
        //   data: null
        // };
        // await analytics(
        //   { date: new Date(start).toISOString() },
        //   start,
        //   "AltaMateriales-timerStart",
        //   obj,
        //   "AltaMateriales",
        //   "job"
        // );
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
        "AltaMateriales-timerStart",
        obj,
        "AltaMateriales",
        "job"
      );
    }
  }
);

/** Función que obtiene los items a procesar. Aquellos que se acaben de formar o lleven una hora bloqueados (lastUpdate) */
const getItems = async (bufferRef: any) => {
  const pageSize = (
    await db_materiales.ref(THROTTLE_BUFFER_PAGESIZE).once("value")
  ).val();
  const oneHourAgo = new Date().getTime() - 60 * 60 * 1000; // Tiempo actual menos 60 minutos
  let lastCreatedAt = null;
  let items: ThrottleBuffer = {};
  let finished = false;

  // Con el ciclo aseguramos que no se quede bloqueada la cola mientras se procesan las tasks. Se ejecuta hasta que encuentre tareas desbloqueadas o se haya acabado el nodo.
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
    const tempItems: ThrottleBuffer = {};

    snapshot.forEach((sp: any) => {
      const item = sp.val() as ThrottleBufferItem;

      // SI VA MÁS DE UNA HORA QUE SE FORMÓ EL ITEM POR ULTIMA VEZ, VOLVER A FORMARLO
      if ((item.lastUpdate ?? 0) <= oneHourAgo) {
        tempItems[item.jobID] = item;
        console.log(
          `Se va a formar el job ${item.jobID}, segmento ${
            item.segment
          }, lastUpdate: ${item.lastUpdate ?? 0}, oneHourAgo: ${oneHourAgo}`
        );
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
