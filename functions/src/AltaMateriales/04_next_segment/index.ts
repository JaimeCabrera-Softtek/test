import * as functions from 'firebase-functions';
import * as _ from 'lodash'

import { ALTA_MATERIALES, MATERIALES_BATCH_STATUS } from '../../z_helpers/constants';
import { db_materiales } from '../../firebase';
// import { sendSegment } from '../z_sendSegment';
import { saveCambioPrecios, saveExtensionBanner, saveNuevoCompleto, updateBatchStatus_NuevoCompleto } from './saveInfo';
import { analytics } from '../../z_helpers/analytics';
import { AltaMaterial_ProductInit, Job, JobStatus } from '../01_batch_creation/interfaces';
import { desdoblarParaFirebase } from '../01_batch_creation/desdoblar';
import { inicializarFirebase } from '../01_batch_creation/inicializarFirebase';
import { materialPictureUpload } from '../../z_helpers/material_picture';
import { bufferTask } from '../02_start_trigger/bufferTask';
import { CloudRes } from '../../interfaces/CloudRes';

export const nextSegment = functions
    .runWith({
        maxInstances: 1000000
    })
    .database
    .instance(process.env.DATABASE_MATERIALES_NAME!)
    .ref(`${ALTA_MATERIALES}/{jobId}/status/{segment}/status`)
    .onUpdate(async (change, context) => {
        const arrival = new Date(context.timestamp).getTime();
        try {
            let msg = "";
            
            /**
             * Referencia al Job
             */
            const jobRef = db_materiales.ref(ALTA_MATERIALES).child(context.params.jobId);
            /**
             * Objeto del job
             */
            const job: Job = (await jobRef.once('value')).val();
            /**
             * Status del segmento
             */
            const val = change.after.val() as JobStatus;
            /**
             * Tipo del job
             */
            const tipo_operacion = (await jobRef.child('type').once('value')).val();
            console.log(`Cambio en ${context.params.jobId} segmento ${context.params.segment}`, 'status', val);


            if (val === 'success') {
                //Exito!
                if (tipo_operacion === "nuevo_completo") {
                    //Mandar el siguiente
                    const actual = parseInt(context.params.segment);
                    const siguiente = actual + 1;

                    if (siguiente <= 6) {
                        msg = `Job ${context.params.jobId} enviará segmento ${siguiente}`;
                        // await sendSegment(jobRef, siguiente);
                        await bufferTask(context.params.jobId, siguiente as any)
                    } else {
                        msg = `Job ${context.params.jobId} terminó sus segmentos`;
                        // Guarda el material completo en nodo Materiales
                        await saveNuevoCompleto(context.params.jobId);

                        // ? CUANDO HAYA GUARDADO EL REGISTRO EN Materiales, EXTENDER AL SEGUNDO BANNER
                        try {
                            // ? SI EL BANNER DEL ARTICULO ES INNERGY (SOCIEDAD 2001) SE DEBE EXTENDER AL BANNER INNOVASPORT
                            if (job.art.Unidades.includes("INNERGY")) {
                                // TODO PENDIENTE CONFIRMAR SI ESTO SÍ SE HARÁ
                                // await extenderSegundoBanner(job, "INNOVASPORT");
                            } else {
                                // ? SI EL BANNER NO ES INNERGY (SOCIEDAD 1001) SE TIENE QUE EXTENDER AL BANNER OUTLET
                                if (!job.art.Unidades.includes("OUTLET")) {
                                    await extenderSegundoBanner(job, "OUTLET");
                                }
                            }
                        } catch (error) {
                            console.log("Error al extender al segundo banner");
                        }

                        //Actualizamos a success el status de este job en el batch que le toca
                        await updateBatchStatus_NuevoCompleto(job as AltaMaterial_ProductInit, 'success');

                        const fotoURL = job.art["Fotografia"]
                        const tieneFoto = fotoURL !== null && fotoURL !== ''
                        if (tieneFoto) {
                            try {
                                await materialPictureUpload(job.consecutivo.toString(), fotoURL)
                            } catch (e) {
                                console.log('error subiendo la imagen del producto JobID:', job.push_id, fotoURL)
                            }
                        }
                    }
                } else if (tipo_operacion === "cambio_precios" || tipo_operacion === "cambio_precio_venta" || tipo_operacion === "cambio_precio_compra") {
                    let maxSegment = 5;

                    if (tipo_operacion === "cambio_precio_compra") {
                        maxSegment = 4
                    }

                    //Mandar el siguiente
                    const actual = parseInt(context.params.segment);
                    const siguiente = actual + 1;

                    if (siguiente <= maxSegment) {
                        msg = `Job ${context.params.jobId} enviará segmento ${siguiente}`;
                        // await sendSegment(jobRef, siguiente);
                        await bufferTask(context.params.jobId, siguiente as any)
                    } else {
                        msg = `Job ${context.params.jobId} terminó sus segmentos`;
                        await saveCambioPrecios(context.params.jobId)
                    }
                } else if (tipo_operacion === "extension_de_banner") {
                    //Mandar el siguiente, empieza en el 3
                    const actual = parseInt(context.params.segment);
                    let siguiente = actual + 1;

                    if (siguiente <= 6) {
                        msg = `Job ${context.params.jobId} enviará segmento ${siguiente}`;
                        await bufferTask(context.params.jobId, siguiente as any);
                    } else {
                        msg = `Job ${context.params.jobId} terminó sus segmentos`;
                        // Guarda el material completo en nodo Materiales
                        await saveExtensionBanner(context.params.jobId);
                        //Actualizamos a success el status de este job en el batch que le toca
                        await updateBatchStatus_NuevoCompleto(job as AltaMaterial_ProductInit, 'success');
                    }
                }
            } else {
                if (tipo_operacion === 'nuevo_completo' || tipo_operacion === "extension_de_banner") {
                    if (['pending', 'queued', 'processing'].includes(val)) {
                        await updateBatchStatus_NuevoCompleto(job as AltaMaterial_ProductInit, 'processing')
                    } else {
                        // 'failed'
                        await updateBatchStatus_NuevoCompleto(job as AltaMaterial_ProductInit, val)
                    }
                }

                msg = `Job ${context.params.jobId} tiene status ${val} en el segmento ${context.params.segment}. No se enviará nada.`;
            }

            const data = {
                jobID: context.params.jobId,
                segment: context.params.segment,
                jobType: tipo_operacion,
            };

            const obj: CloudRes = {
                error: false,
                msg,
                data,
            };

            console.log(msg)

            await analytics(data, arrival, 'AltaMateriales-nextSegment', obj, 'AltaMateriales', 'firestore_trigger');

            return 'OK'
        } catch (err) {
            //ERROR
            const data = {
              jobID: context.params.jobId,
              segment: context.params.segment,
            };

            const obj: CloudRes = {
              error: true,
              msg: `Ocurrió un error al enviar el siguiente segmento. ${
                (err as Error).message
              }`,
              data,
            };

            await analytics(data, arrival, 'AltaMateriales-nextSegment', obj, 'AltaMateriales', 'firestore_trigger');

            return 'Error'
        }
    })

/**
 * Cuando se de de alta un articulo a SAP, independientemente del banner seleccionado, debe enviarse también
 * al banner OUTLET (sociedad 1001) o al banner INNOVA (sociedad 2001). 
 * Por indicaciones de SAP (Marco Quiñones) la extensión debe enviarse en un job separado cuando 
 * haya terminado exitosamente el segmento de CREACIÓN de cada artículo.
 * Aquí se levantan ese envio de extensión automática, simulando la selección que se hace en web.
 * @param job job que acaba de actualizar el status del segmento 1 a "success".
 * @param banner banner al que se hará la extensión automatica (disparará los 5 segmentos correspondientes a una extensión)
 */
const extenderSegundoBanner = async (job: Job, banner: "OUTLET" | "INNOVASPORT") => {
    // ? SIMULACIÓN DE SELECCIÓN
    // duplicar el articulo del segmento original
    const item: any = _.cloneDeep(job.art);
    // sustituir el banner al que se envia
    item.Unidades = [banner];

    // ? SIMULACIÓN DE batch_creation
    const materiales_firebase = await desdoblarParaFirebase(
        [item],
        job.uid,
        "extension_de_banner",
        job.batch_id
    );

    const newBatch = await inicializarFirebase(materiales_firebase);
    const newPushID = _.keys(newBatch.data)[0];

    console.log("Extendido al segundo banner ", banner, newPushID)

    // ? ACTUALIZACION del batch en nodo MATERIALES_BATCH_STATUS
    await db_materiales
        .ref(MATERIALES_BATCH_STATUS)
        .child(job.uid)
        .child(job.batch_id!)
        .child("jobs")
        .child(newPushID)
        .set({
            Estilo: job.art.Estilo,
            status: "pending",
        });
}