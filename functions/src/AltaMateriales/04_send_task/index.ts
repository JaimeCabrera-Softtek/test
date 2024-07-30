import * as functions from "firebase-functions";

import {
  CallbackFunction,
  VerifyIntegrationRequest,
} from "../../z_helpers/IntegrationsWrapper";
import { sendSegment } from "../z_sendSegment";
import { db_materiales } from "../../firebase";
import { ALTA_MATERIALES, THROTTLE_BUFFER } from "../../z_helpers/constants";
import { CloudRes } from "../../interfaces/CloudRes";

import * as schema from "./send_task_schema.json";
import { User } from "../../interfaces/user";

/**
 * Esta función la podemos usar para mandar a CPI un segmento específico de un job específico
 */
export const sendTask = functions
  .runWith({
    maxInstances: 30000,
    timeoutSeconds: 540,
    memory: "1GB",
  })
  .https.onCall(async (data, context) => {
    const result = await VerifyIntegrationRequest(
      data,
      context,
      "AltaMateriales-04_send_task",
      ["service", "tester", "compras", "mdm"],
      schema,
      doWork,
      "AltaMateriales"
    );
    return result;
  });

const doWork: CallbackFunction = async (
  body: any,
  context: functions.https.CallableContext,
  user?: User
): Promise<CloudRes> => {
  const { jobID, segment } = body;
  const prodRef = db_materiales.ref(ALTA_MATERIALES).child(jobID);

  if (typeof jobID === "string" && jobID !== "") {
    try {
      let res: CloudRes = {
        data: body,
        error: false,
        msg: "",
      };
      const jobRef = db_materiales.ref(ALTA_MATERIALES).child(jobID);
      const jobNodo: any = (await jobRef.get()).val();

      // * CHECAR SI EL SEGMENTO QUE SE ESTÁ INTENTANDO ENVIAR, NO TIENE STATUS SUCCESS
      if (
        jobNodo.status[segment] &&
        jobNodo.status[segment].status !== "failed" &&
        jobNodo.status[segment].status !== "pending"
      ) {
        console.log(
          "JobID",
          jobID,
          "intentó enviar el segmento",
          segment,
          "pero ya tenía status",
          jobNodo.status[segment].status,
          "envío ignorado."
        );

        res.msg = `Se intentó enviar el segmento ${segment} pero ya tenía status ${jobNodo.status[segment].status}, envío ignorado.`;
      } else {
        res = await sendSegment(prodRef, segment);
      }

      // borrar tarea del buffer
      const bufferRef = db_materiales.ref(THROTTLE_BUFFER).child(jobID);
      const nodo = (await bufferRef.get()).val();

      if (nodo && nodo.segment === segment) {
        await bufferRef
          .set(null)
          .then(() => {
            console.log(
              "JobID",
              jobID,
              "Nodo en el buffer borrado para el segmento",
              segment
            );
          })
          .catch((e) => {
            console.log(
              "JobID",
              jobID,
              "ERROR AL BORRAR EL NODO EN EL BUFFER PARA EL SEGMENTO",
              segment,
              (e as Error).message
            );
          });
      }

      return res;
    } catch (error) {
      throw new Error(
        `Error eviando segmento ${segment} a CPI. ${(error as Error).message}`,
        { cause: (error as Error).cause }
      );
    }
  } else {
    return {
      error: true,
      msg: "Bad Request",
      data: null,
    };
  }
};
