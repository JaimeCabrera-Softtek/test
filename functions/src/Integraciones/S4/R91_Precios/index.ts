import * as functions from 'firebase-functions';
import * as _ from 'lodash';

import { CallbackFunction, VerifyIntegrationRequest } from '../../../z_helpers/IntegrationsWrapper';

import { db_materiales } from '../../../firebase';
import { PRECIOS_VENTA_SAP } from '../../../z_helpers/constants';

import * as schema from './r91_precios_schema.json';
import { User } from '../../../interfaces/user';

export const R91_replicaPrecios = functions.https.onCall(async (data, context) => {
    const res = await VerifyIntegrationRequest(
        data, context,
        'Integraciones-S4-R91_replicaPrecios',
        ['service'],
        schema,
        doWork,
        'Replicas'
    );
    return res;
})


const doWork: CallbackFunction = async (
    body: any,
    context: functions.https.CallableContext,
    user?: User
): Promise<any> => {
    const preciosRef = db_materiales.ref(PRECIOS_VENTA_SAP);
    const preciosIn = body.Precios;
    const preciosPorMaterial = _.groupBy(preciosIn, "numeroMaterial");

    let promises = [];
    for (let materialRaw in preciosPorMaterial) {
        const materialTrimmed = parseInt(materialRaw).toString();
        const precios = preciosPorMaterial[materialRaw];

        const _prom = new Promise((resolve, reject) => {
            preciosRef.child(materialTrimmed)
                .set(precios)
                .then(() => resolve(`Los precios del material ${materialRaw} han sido guardados`))
                .catch(e => {
                    console.log('Error', materialRaw, (e as Error).message);
                    reject(`Los precios del material ${materialRaw} no se pudieron guardar correctamente`)
                })
        })
        promises.push(_prom)
    }

    const res = await Promise.allSettled(promises)

    //Responder OK
    /**
     * Arreglo de mensajes que SAP espera de respuesta
     * Cuidado con este formato, porque así lo están esperando
     */
    const arr = res.map(x => {
        if (x.status === 'fulfilled') {
            return {
                returnType: "S",
                returnId: "IBN",
                returnNumber: "200",
                returnMessage: x.value
            }
        } else {
            return {
                returnType: "E",
                returnId: "IBN",
                returnNumber: "200",
                returnMessage: x.reason
            }
        }
    })

    const ok: any = {
        message: arr
    }
    return ok;
}