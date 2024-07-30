import * as functions from "firebase-functions";
import { CallbackFunction, VerifyIntegrationRequest, } from "../../../../z_helpers/IntegrationsWrapper";
import { User } from "../../../../interfaces/user";
import { db, firestore, storage } from "../../../../firebase";
import { Cajas } from "../../../../interfaces/ASN";
import { asnStringDateToDate } from "../../../../z_helpers/Dates";

export const registerAppointment = functions.https.onCall(async (data, context) => {
    const result = await VerifyIntegrationRequest(
        data,
        context,
        "Integraciones-Suppliers-registerAppointment",
        ["service", "tester", "proveedor"],
        undefined,
        executableFunction,
        "ASN",
        "api"
    );
    return result;
});

const executableFunction: CallbackFunction = async (body: any, context: functions.https.CallableContext, user?: User) => {
    if (
        body.ASNList &&
        body.providerID &&
        body.AppointedTime &&
        body.CEDIS &&
        body.Duration_Minutes &&
        body.ProviderName
    ) {
        try {
            // Hacer un query para obtener los documentos que pertenezcan a quien esta llamando la función
            const docs = await firestore
                .collection("asn")
                .where("asn", "in", body.ASNList)
                .where("provider_id", "==", body.providerID)
                .get();
            // Si no hay documentos no se hace nada
            if (!docs.empty) {
                const asnRef = firestore.collection("asn");
                // Inicializar un batch para escribir todos de una sola vez
                const localBatch = firestore.batch();
                // Iniciar objeto para los detalles de ASN
                let Detalles_ASN = {} as any;
                // lista de posibles errores asn
                let erroresASN = [];

                // Map de los tipos de pedido actuales
                const mapaTipoPedido: any = {
                    "ZBCD": "OC Cross Docking",
                    "ZBFI": "OC E-commerce",
                    "ZBFT": "OC Almacenamiento",
                    "ZPDT": "OC Directo a tienda",
                }

                // Iterar sobre los documentos encontrados y setear esatus a con cita
                for (let d of docs.docs) {
                    const asnDocRef = asnRef.doc(d.id);
                    // Verificar si tiene el campo de fin validez
                    if (d.data().finValidez) {
                        const fechaFinValidez = asnStringDateToDate(d.data().finValidez);
                        // Si el asn ya venció se agrega a la lista de errores y saltar
                        if (fechaFinValidez < new Date(body.AppointedTime)) {
                            erroresASN.push(d.data().asn);
                            continue;
                        }
                    }
                    // Si no han vencido o no tiene campo fin validez se hace update de cada asn individual recibido
                    localBatch.update(asnDocRef, {
                        status: "Con Cita",
                        fechaCita: new Date(body.AppointedTime),
                    });
                    const asnDocData = d.data();

                    // Obtener la cantidad de bultos del asn
                    const calcularCantidad = await getCantidadBultos(
                        body.providerID,
                        d.id
                    );
                    // Obtener las llaves de entrega entrante
                    const clavesEE = Object.keys(asnDocData.ee).join(", ");

                    // Setear el mapa de asn con el detalle para la tabla
                    Detalles_ASN[asnDocData.asn] = {
                        Pedido: asnDocData.no_orden,
                        Tipo_Pedido: mapaTipoPedido[asnDocData.claseDocumento ?? ''] ?? 'N/A',
                        ASN: asnDocData.asn,
                        Entrega_Entrante: clavesEE,
                        Bultos_Enviados: calcularCantidad,
                    };
                }

                // Si hubo errores se termina la ejecución y devuelve cuales tuvieron error
                if (erroresASN.length > 0) {
                    return {
                        data: null,
                        error: true,
                        msg: `Por favor verifique que los siguientes asn no esten
                        vencidos ${erroresASN.toString()}`
                    }
                }

                // CONTINUA LA EJECUCIÓN SI NO HUBO ERRORES

                // Generar folio de cita
                const folio_cita = await nextAppointmentID();
                // Si ya trae un id de documento se hace un update
                if (body.ID) {
                    let appointmentDoc = await firestore.doc(
                        `asnAppointments/${body.ID}`
                    );
                    localBatch.set(appointmentDoc, {
                        Detalles_ASN: Detalles_ASN,
                        ASN: body.ASNList,
                        ProviderID: body.providerID,
                        AppointedTime: new Date(body.AppointedTime),
                        CEDIS: body.CEDIS,
                        Duration_Minutes: body.Duration_Minutes,
                        SAP_ProviderID: body.providerID,
                        ShipmentNumber: body.ShipmentNumber ?? "",
                        Folio_Cita: folio_cita,
                        ProviderName: body.ProviderName,
                    });
                } else {
                    // Si no tiene un id se crea un nuevo documento
                    const docRef = await firestore.collection("asnAppointments").add({
                        Detalles_ASN: Detalles_ASN,
                        ASN: body.ASNList,
                        ProviderID: body.providerID,
                        AppointedTime: new Date(body.AppointedTime),
                        CEDIS: body.CEDIS,
                        Duration_Minutes: body.Duration_Minutes,
                        SAP_ProviderID: body.providerID,
                        ShipmentNumber: body.ShipmentNumber ?? "",
                        Folio_Cita: folio_cita,
                        ID: "",
                        ProviderName: body.ProviderName,
                    });
                    docRef.update({
                        ID: docRef.id,
                    });
                }

                // Hacer el commit del batch
                await localBatch.commit();
                return {
                    data: null,
                    error: false,
                    msg: "ASN actualizados correctamente",
                };
            } else {
                // No se encontraron asn que coincidan con los que se enviaron y con el sap provider ID indicado
                return {
                    data: null,
                    error: true,
                    msg: "No se encontraron ASN",
                };
            }
        } catch (e: any) {
            console.log("Error en cambiar estatus con citas: ", e);
            return {
                data: e.msg,
                error: true,
                msg: "Error en cambiar estatus de ASN para citas",
            };
        }
    } else {
        return {
            data: null,
            error: true,
            msg: "Bad Request",
        };
    }
};

/**
 * Obtener la cantidad de bultos del ASN
 * @param providerID id de SAP del usuario
 * @param asnDocID ID de referencia al documento de firestore
 * @returns Cantidad de bultos si se encuentra el documento en storage default 0
 */
const getCantidadBultos = async (
    providerID: string,
    asnDocID: string
): Promise<number> => {
    try {
        // Referencia al archivo en storage
        const asnStorageRef = storage
            .bucket()
            .file(`asn/${providerID}/asn_${asnDocID}.json`);
        const contenido = await asnStorageRef.download();
        // parsear el json para poder usarlo
        const parsedContent = JSON.parse(contenido.toString()) as Cajas;

        // ? Probablemente se pueda usar, se deja como provisional
        // const total = sumBy(flatMap(parsedContent, 'contenido'), item => {
        //     const no_piezas = parseInt(item.no_piezas, 10);
        //     const no_piezas_unidad = parseInt(item.no_piezas_unidad, 10);
        //     return no_piezas * no_piezas_unidad;
        // });

        return Object.keys(parsedContent).length;
    } catch (e) {
        console.log("Error: ", e);
        return 0;
    }
};

/**
 * Obtener el siguiente ID consecutivo para ASN
 * @return el ID siguiente
 */
const nextAppointmentID = async () => {
    const tres = await db.ref("ASN_Count/Appointments").transaction(
        (snap) => {
            if (snap != undefined && snap != null) {
                snap++;
            } else {
                snap = 1;
            }
            return snap;
        },
        (error, committed, snap) => {
            if (error) {
                console.log("Error en transaccion", error);
            }
        },
        true
    );

    if (tres.committed) {
        console.log(JSON.stringify(tres.snapshot.val()));
        return tres.snapshot.val();
    } else {
        throw `No se pudo obtener el consecutivo`;
    }
};