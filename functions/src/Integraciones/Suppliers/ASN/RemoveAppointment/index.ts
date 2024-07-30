import * as functions from 'firebase-functions'
// import * as CitaRemoveSchema from './RemoveAppointment_schema.json';
import { CallbackFunction, VerifyIntegrationRequest } from '../../../../z_helpers/IntegrationsWrapper';
import { firestore } from '../../../../firebase';
import { CloudRes, res_ok } from '../../../../interfaces/CloudRes';
import { ASNAppointment } from '../../../../interfaces/ASN';
import { User } from '../../../../interfaces/user';

export const RemoveAppointment = functions.https.onCall(async (data, context) => {
    const res = await VerifyIntegrationRequest(
        data,
        context,
        'Integraciones-Suppliers-RemoveAppointment',
        ['service', 'tester', 'proveedor'],
        // TODO: Verificar por que no funciona schema 
        //CitaRemoveSchema
        undefined,
        executableFunction,
        'ASN',
        'api'
    );

    return res;
});

const executableFunction: CallbackFunction = async (body: any,
    context: functions.https.CallableContext,
    user?: User)
    : Promise<CloudRes> => {
    try {
        const { idCita } = body;
        // Referencias a documento cita asn
        const citaDocRef = firestore.doc(`asnAppointments/${idCita}`);
        const snap = await citaDocRef.get();
        // Verificar existencia de documento en fs
        if (snap.exists) {
            const cita = snap.data() as ASNAppointment;
            if (cita.SAP_ProviderID !== user?.SAP_idProvider) {
                return {
                    data: null,
                    error: true,
                    msg: 'El sap provider no coincide con el de la cita'
                }
            }

            // Inicializar batch
            const localBatch = firestore.batch();
            if (cita.ASN && cita.ASN.length > 0) {
                // Lista de posibles asn con errores
                const listaASNCita = cita.ASN;
                const asnErrores: number[] = [];
                // Iterar sobre los asn de la cita
                for (let asn of listaASNCita) {
                    // Hacer un query para el asn sobre el que esta iterando
                    const q = await firestore.collection('asn').where('asn', '==', asn).get();
                    // Verificar que haya coincidencias
                    if (q.docs.length > 0) {
                        // Tomar solo el primer resultado (debería haber solo uno)
                        const asnFs = q.docs[0].data();
                        const asnDocRef = firestore.doc(`asn/${asnFs.doc_id}`);
                        // Hacer update del status del asn a sin cita
                        localBatch.update(asnDocRef, {
                            status: "Sin Cita",
                            fechaCita: '',
                        });
                    } else {
                        // Si no existe el asn en el query se agrega a lista de errores
                        asnErrores.push(asn);
                        continue;
                    }
                }
                // Verificar que la lista de errores este vacía para continuar
                if (asnErrores.length > 0) {
                    return {
                        data: null,
                        error: true,
                        msg: `Los siguientes asn no existen: ${asnErrores.toString()}`
                    }
                }
            }

            // Borrar el doc de cita especificado
            localBatch.delete(citaDocRef, {
                exists: true,
            });
            // Hacer commit de los cambios para terminar el proceso
            await localBatch.commit();

        }
        // Si no existe devolver un error
        else {
            return {
                data: null,
                error: true,
                msg: 'No existe la cita especificada',
            }
        }
        // Ejecución exitosa
        return res_ok;
    } catch (e) {
        return {
            data: e,
            error: true,
            msg: 'Error al cancelar cita'
        }
    }
}