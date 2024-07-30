import * as functions from 'firebase-functions'
import * as _ from 'lodash'

import { BatchMaterialStatus } from './interfaces'
import { MATERIALES_BATCH_STATUS } from '../../z_helpers/constants'
import { SendMailObj, sendMail } from '../../z_helpers/sendmail'
import { db_materiales } from '../../firebase'

/**
 * Trigger que monitorea el status de un batch de selección de materiales
 * 
 * Con el objetivo de mandar correo al usuario que hizo la selección con el aviso de que el procesamiento ha terminado
 */
export const StatusTrigger = functions
    .database
    .instance(process.env.DATABASE_MATERIALES_NAME!)
    .ref(`${MATERIALES_BATCH_STATUS}/{userID}/{batchID}/jobs`)
    .onUpdate(async (change, context) => {
        if (change.after.exists()) {
            const after = (await change.after.ref.parent!.once('value')).val() as BatchMaterialStatus
            const job_count = Object.keys(after.jobs).length
            //Revisar status
            const count_by_status = _.groupBy(after.jobs, 'status')
            const count = {
                pending: count_by_status['pending']?.length ?? 0,
                queued: count_by_status['queued']?.length ?? 0,
                processing: count_by_status['processing']?.length ?? 0,
                success: count_by_status['success']?.length ?? 0,
                failed: count_by_status['failed']?.length ?? 0,
            }

            //Actualizar el status del batch en RealtimeDB
            const baseRef = db_materiales.ref(MATERIALES_BATCH_STATUS)
                .child(context.params.userID)
                .child(context.params.batchID)
            baseRef.transaction(snap => {
                if (snap != undefined && snap != null) {
                    if (snap.lastUpdate <= Date.parse(context.timestamp)) {
                        snap = {
                            ...snap,
                            lastUpdate: new Date().getTime(),
                            status: count
                        }
                    } else {
                        //ignore
                    }
                }
                return snap;
            }, (error, committed, newSnapshot) => {
                if (error) {
                    console.log("Error en transaccion", error);
                }
            }, true)

            if (count.success === job_count) {
                //? TODOS TERMINARON CON SUCCESS
                //Enviar correo de todo listo
                await sendMailSuccess(after)
            } else if (count.success + count.failed === job_count) {
                //? TODOS TERMINARON, HAY ERRORES
                //Enviar correo de que hay errores
                await sendMailError(after)
            }
            else {
                //? SE SIGUEN PROCESANDO
                //nada?
            }
        }
    })

/**
 * Enviar el correo de que la selección de materiales ha sido exitosa
 * @param batchStatus Objeto del batch en realtime DB
 */
const sendMailSuccess = async (batchStatus: BatchMaterialStatus) => {
    if (batchStatus.user && batchStatus.user.email) {
        const obj: SendMailObj = {
            To: [batchStatus.user.email],
            Subject: 'Selección materiales: éxito',
            Body: '¡Su selección de materiales está lista!',
            isHTML: true,
            HTMLBody: `<body>
                <p>El procesamiento de su selección de materiales ha terminado exitosamente. Ya todo está disponible en SAP.</p>
            </body>`
        }
        await sendMail(obj)
    }
}

/**
 * Enviar el correo de que la selección de materiales ha tenido errores
 * @param batchStatus Objeto del batch en realtime DB
 */
const sendMailError = async (batchStatus: BatchMaterialStatus) => {
    if (batchStatus.user && batchStatus.user.email) {
        const obj: SendMailObj = {
            To: [batchStatus.user.email],
            Subject: 'Selección materiales: errores',
            Body: 'Su selección de materiales terminó con errores',
            isHTML: true,
            HTMLBody: `<body>
                <p>El procesamiento de su selección de materiales ha terminado, pero tiene errores.</p>
            </body>`
        }
        await sendMail(obj)
    }
}