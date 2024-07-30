import * as functions from 'firebase-functions';
import { ALTA_MATERIALES } from '../../z_helpers/constants';
import { AltaMaterial_ProductInit } from '../01_batch_creation/interfaces';
import { analytics } from '../../z_helpers/analytics';
import { CloudRes } from '../../interfaces/CloudRes';
import { bufferTask } from './bufferTask';

export const startTrigger = functions
    .runWith({
        // minInstances: 10,
        maxInstances: 1000000,
        timeoutSeconds: 540,
        memory: "8GB"
    })
    .database
    .instance(process.env.DATABASE_MATERIALES_NAME!)
    .ref(`${ALTA_MATERIALES}/{jobId}`)
    .onCreate(async (snapshot, context) => {
        const arrival = new Date(context.timestamp).getTime();
        const val = snapshot.val() as AltaMaterial_ProductInit;
        try {
            console.log('inicio', context.params.jobId);
            console.log(context.params.jobId, val.type);

            // const runID = context.params.jobId;
            // const ref = db_materiales.ref(ALTA_MATERIALES).child(runID);

            let res: CloudRes;
            if (val.type === 'nuevo_completo') {
                //Empezar el flujo del 1-6
                // res = await segmento01(ref);
                res = await bufferTask(context.params.jobId, 1)
            } else if (val.type === "extension_de_banner") {
                // empezar el flujo en el segmento 3
                res = await bufferTask(context.params.jobId, 3);
            } else if (val.type === "cambio_precios" || val.type === "cambio_precio_compra") {
                // res = await segmento04(ref)
                res = await bufferTask(context.params.jobId, 4)
            } else if (val.type === "cambio_precio_venta") {
                // res = await segmento05(ref);
                res = await bufferTask(context.params.jobId, 5)
            } else {
                //! val.type no indica un tipo de job válido
                const obj: CloudRes = {
                    error: true,
                    msg: 'Error: tipo de job inválido',
                    data: {
                        jobID: context.params.jobId,
                        jobType: val.type,
                    }
                }

                await analytics(val, arrival, 'AltaMateriales-startTrigger', obj, 'AltaMateriales', 'firestore_trigger');
                return obj.msg;
            }

            //#region Respuesta exitosa
            const obj: CloudRes = {
                error: false,
                msg: res.msg,
                data: {
                    jobID: context.params.jobId,
                    jobType: val.type,
                }
            }
            await analytics(val, arrival, 'AltaMateriales-startTrigger', obj, 'AltaMateriales', 'firestore_trigger');
            return res;
            //#endregion Respuesta exitosa
        } catch (err) {
            const obj: CloudRes = {
                error: true,
                msg: `Ocurrió un error al iniciar el alta de materiales ${(err as Error).message}`,
                data: {
                    jobID: context.params.jobId,
                    jobType: val.type,
                }
            }

            await analytics(val, arrival, 'AltaMateriales-startTrigger', obj, 'AltaMateriales', 'firestore_trigger');

            return 'Error'
        }
    })