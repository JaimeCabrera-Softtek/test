import * as functions from 'firebase-functions';
import * as _ from 'lodash';

import { CloudRes } from '../../interfaces/CloudRes';
import { db_materiales } from '../../firebase';
import { CallbackFunction, VerifyIntegrationRequest } from '../../z_helpers/IntegrationsWrapper';
import { AltaMaterial_Status_Segment, CPI_Queue_Message, SegmentStatusCallback_Any, SegmentStatusCallback_Notificacion } from '../01_batch_creation/interfaces';

import * as schema from "./segment_status_schema.json";
import { ALTA_MATERIALES, SEGMENT_STATUS_BUFFER } from '../../z_helpers/constants';
import { User } from '../../interfaces/user';
import { Reference } from 'firebase-admin/database';
import { SegmentStatusBuffer } from '../03_timer_segment_status/interfaces';

/**
 * ?HTTP Event Handler
 * SAP nos va a mandar detalle de cómo le fue procesando un segmento del proceso de alta de material
 *
 * {
 *  catalog: string,
 *  product: string,
 *  segment: number,
 *  status: {
 *      success: boolean,
 *      msg: string
 *  }
 * }
 */
export const segmentStatus = functions
    .runWith({ memory: "4GB", timeoutSeconds: 180 })
    .https.onCall(async (data, context) => {

    const result = await VerifyIntegrationRequest(
        data, context,
        'AltaMateriales-segmentStatus',
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

/**
 * Manejar el request que puede traer N status de productos diferentes
 * @param body Body original del request
 * @param context contexto de la llamada onCall
 * @returns CloudRes
 */
const doWork: CallbackFunction = async (
    body: any,
    context: functions.https.CallableContext,
    user?: User
): Promise<any> => {
    try {
        const { notificaciones } = body;

        /**
         * Recibimos muchas notificaciones de status a la vez (mismo request)
         * dividirlas para guardarlas en el buffer de entrada
         */
        let bufferMap: SegmentStatusBuffer = {};

        notificaciones.forEach(
          (notificacion: SegmentStatusCallback_Notificacion) => {
            bufferMap[notificacion.IDOCID] = {
              ...notificacion,
              createdAt: new Date().getTime(),
            };
          }
        );

        // ? GUARDAR ENTRADA DE NOTIFICACIONES EN EL BUFFER
        await db_materiales.ref(SEGMENT_STATUS_BUFFER).update(bufferMap);

        //Responder OK
        /**
         * Arreglo de mensajes que SAP espera de respuesta
         * Cuidado con este formato, porque así lo están esperando
         */
        const arr = notificaciones.map((x: SegmentStatusCallback_Notificacion) => {
            return {
                returnType: "S",
                returnId: "IBN",
                returnNumber: "200",
                returnMessage: `Actualización para ${x.codigoInterno}, idoc ${x.IDOCID} recibida.`
            }
        })

        const analyicsResult: any = {
            error: false,
            message: arr
        }
        return analyicsResult;
    } catch (err) {
        const obj: CloudRes = {
          error: true,
          msg: `Ocurrió un error al recibir las actualizaciones de status ${
            (err as Error).message
          }`,
          data: null,
        };
        console.log(err)

        throw obj;
    }
};

/**
 * Se encarga de Procesar una sola notificación de status
 * 
 * @param body Input de cómo nos reportan el status con el que terminó el procesamiento de un segmento
 */
export const processStatusUpdate = async (notificacion: SegmentStatusCallback_Notificacion) => {
    //** REGISTRAR EL ESTATUS DEL SEGMENTO ENVIADO ANTERIORMENTE
    const { codigoInterno: runID } = notificacion;
    const prodRef = db_materiales.ref(ALTA_MATERIALES).child(runID);
    let segment: number = decodeSegment_NameToNumber(notificacion);
    const ref_status_segment = prodRef.child('status').child(segment.toString());

    //Hay que sacar el dato de para qué idoc es este reporte de status
    const idocs = await getqueuerespidocs(ref_status_segment);

    //Solamente considerar las notificaciones de status de los idocs vigentes (el intento más reciente)
    if (idocs.includes(notificacion.IDOCID)) {
        const transaction_result = await ref_status_segment.transaction(
            (snap) => {
                if (snap) {
                    let val = snap as AltaMaterial_Status_Segment;
                    //Actualizar timestamp
                    val.date = new Date().toISOString();
                    //ya existe el array de notificaciones?
                    let notifs = _.cloneDeep(val.cpi!.status_report);
                    if (!notifs) { notifs = [] }
                    //Agregar el elemento al array
                    notifs.push(notificacion)
                    val.cpi!.status_report = notifs;
                    //Interpretar si es success del segmento
                    const status = getSuccessStatus(val);
                    if (status === 'incomplete') {
                        //Nada, sigue procesando
                    } else if (status === 'failed') {
                        val.status = 'failed';
                        val.msg = 'Error';
                    } else if (status === 'success') {
                        val.status = 'success';
                        val.msg = 'Éxito';
                    }
                    val.success = status === 'success';
                    snap = val;
                }
                return snap
            },
            (error, committed, newSnap) => {
                if (error) {
                    const err: CloudRes = {
                        error: true,
                        msg: 'transaction error, update segment status',
                        data: notificacion
                    }
                    console.log("Error actualizando status", notificacion.codigoInterno, "para el segmento", segment, "para el IDOC", notificacion.IDOCID, err)
                    throw err
                }
            },
            true
        )

        if (transaction_result.committed) {
            console.log("Status actualizado", notificacion.codigoInterno, "para el segmento", segment, "para el IDOC", notificacion.IDOCID)
            const value = transaction_result.snapshot.val() as AltaMaterial_Status_Segment;
            return {
              codigoInterno: runID,
              segmento: segment,
              status: value.status,
              idoc: notificacion.IDOCID,
              msg: `codigoInterno: ${runID}. Segmento ${segment}, idoc ${notificacion.IDOCID} queda en status ${value.status}.`,
            };
        } else {
            console.log("Error actualizando status", notificacion.codigoInterno, "para el segmento", segment, "para el IDOC", notificacion.IDOCID)
            return {
              codigoInterno: runID,
              segmento: segment,
              status: "",
              idoc: notificacion.IDOCID,
              msg: "Error guardando status",
            };
        }
    } else {
        //Rechazar, porque es un status viejo
        console.log("Rechazado, este reporte de status perdió vigencia", notificacion);
        return {
          codigoInterno: runID,
          segmento: segment,
          status: "",
          idoc: notificacion.IDOCID,
          msg: `codigoInterno: ${runID}. Segmento ${segment}, idoc ${notificacion.IDOCID}. Rechazado, este reporte de status perdió vigencia".`,
        };
    }
}

async function getqueuerespidocs(ref: Reference): Promise<string[]> {
    const data = (await ref.child('cpi').child('queue_resp').child('raw').child('message').once('value')).val();
    const arr = data.map((x: CPI_Queue_Message) => {
        const msg = x.returnMessage;
        const _splitted = msg.split(' ');
        return _splitted[_splitted.length - 1]
    })
    return arr;
}

/**
 * A partir de lo que manda CPI como reporte de status, se puede deducir de qué segmento estamos recibiendo el reporte
 * @param notificacion Lo que mandó CPI en su reporte de status
 * @returns número del segmento 1-6
 */
function decodeSegment_NameToNumber(notificacion: SegmentStatusCallback_Notificacion): number {
    if (notificacion.messageArticulo) {
        return 1;
    } else if (notificacion.messageJerarquias) {
        return 2;
    } else if (notificacion.messageInforecord) {
        return 3;
    } else if (notificacion.messagePreciosCompra) {
        return 4
    } else if (notificacion.messagePreciosVenta) {
        return 5;
    } else if (notificacion.messageCatalogacion) {
        return 6;
    }
    const err: CloudRes = {
        error: true,
        msg: 'No se puede interpretar la estructura',
        data: notificacion
    }
    throw err
}

/**
 * Interpretar las notificaciones de status para saber si tenemos success en un segmento
 * @param val valor (snapshot) del nodo de status de un segmento
 * @returns {boolean} true si fue success
 */
function getSuccessStatus(val: AltaMaterial_Status_Segment): 'success' | 'failed' | 'incomplete' {
    const { queue_resp: solicitudes, status_report: notifs } = val.cpi!;

    const reqCount = solicitudes.raw.message.length;
    const notifCount = notifs!.length;

    if (reqCount === notifCount) {
        /**
         * Ya tenemos todas las respuestas para las solicitudes que mandamos
         * Solo en este caso podemos determinar si fue success
         */
        const tiene_errores = hasErrors(notifs!);
        const isSuccess = !tiene_errores;
        return isSuccess ? 'success' : 'failed';
    } else {
        return 'incomplete'
    }
}

/**
 * Buscar si hay algún message con returnType "E"
 * @param notifs Notificaciones de estatus
 * @returns {boolean} true si encontramos errores
 */
function hasErrors(notifs: SegmentStatusCallback_Notificacion[]): boolean {
    const messages: SegmentStatusCallback_Any[] = notifs.map(x => {
        const _msg = [
            x.messageArticulo,
            x.messageJerarquias,
            x.messageInforecord,
            x.messagePreciosCompra,
            x.messagePreciosVenta,
            x.messageCatalogacion
        ].flat() as SegmentStatusCallback_Any[];
        return _msg.filter(y => y !== undefined)
    }).flat();

    const errors = messages.filter(x => x.returnType === 'E');
    return errors.length > 0;
}
