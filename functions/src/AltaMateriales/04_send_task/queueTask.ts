import { CloudTasksClient } from '@google-cloud/tasks';
import { protos } from '@google-cloud/tasks';

import { db_materiales } from "../../firebase";
import { CloudRes } from "../../interfaces/CloudRes"
import { ALTA_MATERIALES, THROTTLE_FEATURE_FLAG } from '../../z_helpers/constants';
import { sendSegment } from '../z_sendSegment';
import { getToken } from '../../z_helpers/getToken';


// const INTENTOS = 10

/**
 * Mandar un IDOC ya sea directo a CPI/SAP o con throttle (CloudTasks)
 * Dependiendo del FeatureFlag de db_materiales/CloudTasksThrottle
 * @param jobID El Job de AltaMateriales
 * @param segmento El segmento que pediríamos que se mande
 */
export const queueTask = async (jobID: string, segmento: 1 | 2 | 3 | 4 | 5 | 6) => {
    const throttle = (await db_materiales.ref(THROTTLE_FEATURE_FLAG).once('value')).val();
    if (throttle) {
        // obtener una queue aleatoria
        try {
            const token = await getToken()
            //Aplicar throttle
            let task: protos.google.cloud.tasks.v2.ITask = {
                httpRequest: {
                    httpMethod: 'POST',
                    url: process.env.ALTAMATERIALES_SENDTASK ?? '',
                    headers: {
                        'content-type': 'application/json',
                        'x-ibn-token': token
                    },
                    body: Buffer.from(JSON.stringify({
                        data: {
                            jobID: jobID,
                            segment: segmento
                        }
                    })).toString('base64'),
                }
            }
            const client = new CloudTasksClient()
            // const parent = client.queuePath(process.env.PROJECT_ID ?? '', 'us-central1', randomQueue)
            const parent = client.queuePath(process.env.PROJECT_ID ?? '', 'us-central1', 'cpi-throttle-queue')
            task.name = `${parent}/tasks/${jobID}-${segmento}-${getTimestamp()}`
            const request = { parent, task }
            await client.createTask(request);
            // const response = await createTaskWithRetry(client, request, jobID, INTENTOS)
            // console.log("Encolamos en queue", randomQueue, "JobID", jobID, JSON.stringify(response))
        } catch (e) {
            const msg = `Error encolando job ${jobID}: ${(e as Error).message}`
            console.log(msg)
            throw new Error(msg)
        }
    } else {
        //No aplicar throttle
        const ref = db_materiales.ref(ALTA_MATERIALES).child(jobID);
        await sendSegment(ref, segmento);
        // console.log("JobID", jobID)
    }
    const res: CloudRes = {
        error: false,
        msg: 'queued',
        data: null
    }
    return res
}

const getTimestamp = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = (now.getDate()).toString().padStart(2, '0');
    const hours = (now.getHours()).toString().padStart(2, '0');
    const minutes = (Math.floor(now.getMinutes() / 5) * 5).toString().padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}`;
}