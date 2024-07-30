import * as functions from 'firebase-functions';

import { CallbackFunction, VerifyIntegrationRequest } from '../../z_helpers/IntegrationsWrapper';
import { sendSegment } from '../z_sendSegment';
import { db_materiales } from '../../firebase';
import { ALTA_MATERIALES } from '../../z_helpers/constants';
import { CloudRes } from '../../interfaces/CloudRes';

import * as schema from "./send_manually_schema.json";
import { User } from '../../interfaces/user';

/**
 * Esta función la podemos usar para mandar a CPI un segmento específico de un job específico
 * 
 * 2024-enero-16: 
 *      En esta fecha la usaremos para mandar los siguientes segmentos,
 *      ya que aún no queda la integración con CPI para el retorno de estatus
 */
export const sendManually = functions.https.onCall(async (data, context) => {
    const result = await VerifyIntegrationRequest(
        data, context,
        'AltaMateriales-04_send_manually',
        [
            'service',
            'tester',
            'compras',
            'mdm'
        ],
        schema,
        doWork,
        'AltaMateriales'
    );
    return result;
})

const doWork: CallbackFunction = async (
    body: any,
    context: functions.https.CallableContext,
    user?: User
): Promise<CloudRes> => {
    const { jobID, segment } = body;
    const prodRef = db_materiales.ref(ALTA_MATERIALES).child(jobID);

    if (typeof jobID === 'string' && jobID !== "") {
        const res: CloudRes = await sendSegment(prodRef, segment);

        return {
            error: false,
            msg: res.msg,
            data: res.data
        }
    } else {
        return {
            error: true,
            msg: 'Bad Request',
            data: null
        }
    }
}