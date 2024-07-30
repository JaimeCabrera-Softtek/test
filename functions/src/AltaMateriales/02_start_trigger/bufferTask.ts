import { db_materiales } from "../../firebase";
import { CloudRes } from "../../interfaces/CloudRes";
import {
  ALTA_MATERIALES,
  THROTTLE_BUFFER,
  THROTTLE_FEATURE_FLAG,
} from "../../z_helpers/constants";
import { sendSegment } from "../z_sendSegment";

/**
 * Mandar un IDOC ya sea directo a CPI/SAP o meter al buffer de envío a CloudTasks
 * Dependiendo del FeatureFlag de db_materiales/CloudTasksThrottle
 * @param jobID El Job de AltaMateriales
 * @param segmento El segmento que pediríamos que se mande
 */
export const bufferTask = async (
  jobID: string,
  segmento: 1 | 2 | 3 | 4 | 5 | 6
) => {
  let res: CloudRes = {
    error: false,
    msg: "queued",
    data: null,
  };

  try {
    // * CHECAR SI EL SEGMENTO QUE SE ESTÁ INTENTANDO ENCOLAR, NO TIENE YA STATUS SUCCESS
    const jobRef = db_materiales.ref(ALTA_MATERIALES).child(jobID);
    const jobNodo: any = (await jobRef.get()).val();

    if (
      jobNodo.status[segmento] &&
      jobNodo.status[segmento].status !== "failed" &&
      jobNodo.status[segmento].status !== "pending"
    ) {
      console.log(
        "JobID",
        jobID,
        "intentó encolar el segmento",
        segmento,
        "pero ya tenía status",
        jobNodo.status[segmento].status,
        "envío ignorado."
      );

      res.msg = `Se intentó encolar el segmento ${segmento} pero ya tenía status ${jobNodo.status[segmento].status}.`;
    } else {
      const throttle = (
        await db_materiales.ref(THROTTLE_FEATURE_FLAG).once("value")
      ).val();

      //   ! EL SEGMENTO 2 ESTÁ DANDO PROBLEMAS, ESTE LO ENVIAMOS DIRECTO A LA BAPI SIN ENCOLARLO
      if (throttle && segmento !== 2) {
        /**
         * Aplicar throttle... funciona metiendo items a un buffer que luego con
         * 02_timer_start se mandan encolar a CloudTasks
         */
        const item = {
          jobID: jobID,
          segment: segmento,
          createdAt: new Date().getTime(),
        };

        await db_materiales.ref(THROTTLE_BUFFER).child(jobID).set(item);

        console.log(
          "JobID",
          jobID,
          "encolado en buffer para el segmento",
          segmento
        );
      } else {
        //No aplicar throttle
        const ref = db_materiales.ref(ALTA_MATERIALES).child(jobID);
        await sendSegment(ref, segmento);

        if (segmento === 2) {
          console.log("JobID", jobID, "segmento 2 enviado sin buffer");
        }
      }
    }
  } catch (error) {
    console.log(
      "Error al encolar en el buffer al JobID",
      jobID,
      "para el segmento",
      segmento
    );
    throw error;
  }

  return res;
};
