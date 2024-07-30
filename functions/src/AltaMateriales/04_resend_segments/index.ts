import * as functions from "firebase-functions";

import {
  CallbackFunction,
  VerifyIntegrationRequest,
} from "../../z_helpers/IntegrationsWrapper";
import { db_materiales } from "../../firebase";
import { ALTA_MATERIALES } from "../../z_helpers/constants";
import { CloudRes } from "../../interfaces/CloudRes";

import * as schema from "./resend_segments_schema.json";
import { User } from "../../interfaces/user";
import {
  AltaMaterial_ProductInit,
  AltaMaterial_Status_Segment,
} from "../01_batch_creation/interfaces";
import { bufferTask } from "../02_start_trigger/bufferTask";

export const resendSegments = functions
  .runWith({ memory: "8GB", timeoutSeconds: 540 })
  .https.onCall(async (data, context) => {
    const result = await VerifyIntegrationRequest(
      data,
      context,
      "AltaMateriales-04_resend_segments",
      ["service", "tester", "mdm"],
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
  const { jobs, segment } = body;
  const data: any = {
    Enviados: [],
    NoEnviados: [],
  };

  // por cada job id que se mando a la function
  for (const jobID of jobs) {
    try {
      // obtener el job de base de datos
      const jobRef = db_materiales.ref(ALTA_MATERIALES).child(jobID);
      const job: AltaMaterial_ProductInit = (await jobRef.once("value")).val();

      // numero del segmento que falló
      let siguiente = segment ?? 0;

      // si no se indica el numero de segmento en el body, encontrar el ultimo segmento que falló de cada job
      if (siguiente === 0) {
        // iterar los status del job
        for (const [segmento, status] of Object.entries(job.status)) {
          const s = status as AltaMaterial_Status_Segment;

          // si el status del segmento es "failed"
          if (s.status === "failed") {
            // se guarda el número de segmento (el que se reenvía) y rompe el ciclo de revisión de status
            siguiente = Number(segmento);
            break;
          }
        }
      }

      // si se encontró un segmento con status "failed" en el job...
      if (siguiente > 0) {
        const updated: AltaMaterial_ProductInit = {
          ...job,
          status: {
            ...job.status,
            [siguiente]: {
              date: new Date().toISOString(),
              status: "pending",
              success: false,
              msg: "",
            },
          },
        };

        await jobRef.set(updated);

        // reenvía a SAP
        if (process.env.CPI_SEGMENT_ENV === "PROD") {
          await bufferTask(jobID, siguiente as any);
        }

        console.log("JOB", jobID, "ENVIADO AL BUFFER. SEGMENTO", siguiente);

        data["Enviados"].push(jobID);
      } else {
        // no encontró segmento con status "failed", no reenvía nada a SAP
        data["NoEnviados"].push(jobID);
      }
    } catch (error) {
      console.log(
        `JOB ${jobID} NO FORMADO EN BUFFER, ERROR ${(error as Error).message}`
      );
      data["NoEnviados"].push(jobID);
    }
  }

  return {
    error: false,
    msg: "Segmentos reenviados a S4",
    data,
  };
};
