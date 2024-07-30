import * as functions from "firebase-functions";
//* Se puede tomar como referencia el Template_schema.json
import * as schema from "./ProveedorCreate_schema.json";
import { CallbackFunction, VerifyIntegrationRequest } from "../../../../../z_helpers/IntegrationsWrapper";
import { CloudRes } from "../../../../../interfaces/CloudRes";
import axios from "axios";
import { getTokenCpiMateriales } from "../../../../../AltaMateriales/z_sendSegment/helpers/cpi_hepers";
import { firestore } from "../../../../../firebase";


export const createProveedorS4 = functions
    .runWith({ memory: "8GB", timeoutSeconds: 540 })
    .https.onCall(
        async (data, context) => {
            console.log("data", data)
            const result = await VerifyIntegrationRequest(
                data, context,
                "Integraciones-S4-Proveedores-Create",
                [
                    "service",
                    "tester",
                    "cpp",
                    "insumos",
                ],
                schema,
                doWork,
                "CrearProveedor"
            );
            return result;
        }
    );

const doWork: CallbackFunction = async (
    body: any,
    context: functions.https.CallableContext
): Promise<CloudRes> => {
    try {
        let b: any = {
            Proveedor: body.Proveedor,
        }
        console.log("body", b, "idDOC", body.idProveedorFS);
        const url: string = process.env.ALTAPROVEEDOR ?? '';
        console.log('URL alta proveedor', url);
        console.log("body", b);

        const token = await getTokenCpiMateriales();

        const resp = await axios.post(
            url,
            b, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        console.log("resp data", resp.data)

        /**
         * Response:
         * {
            "message": {
                    "returnType": "S",
                    "returnId": "SAP",
                    "returnNumber": "200",
                    "returnMessage": "BP creado 0010000225"
                }
            }
         */
        // Obtener el nuevo id

        let sapID = resp.data.message.returnMessage.split(" ")[2].substring(2) ?? ""

        console.log("sapID", sapID)
        let idSoc = b.Proveedor[0]?.Sociedad?.sociedad ?? "1001";

        const res: CloudRes = {
            error: false,
            msg: "OK",
            data: { url: url, resp: resp.data, body: body, sapID: sapID },
        };

        /**
         * Cuando se tenga la respuesta y el sap ID se creó correctamente
         * buscar el proveedor
         */
        if (resp.data.message.returnMessage.includes("creado")) {
            const providerDoc = (await firestore
                .collection('proveedores')
                .doc(body.idProveedorFS ?? '').get()).data();


            // Si existe entonces agregar la prop
            if (providerDoc) {
                console.log("sí existe el proveedor")
                let temp = providerDoc;
                temp.idSAP = resp.data.returnId;
                await firestore
                    .collection("proveedores")
                    .doc(body.idProveedorFS)
                    .update({
                        idSAP: sapID,
                        IDSociedad: idSoc
                    })

                // Recorrer la organization y agregar el SAP_idProvider y el IDSociedad 
                // Y cambiar la prop del user isActive de 'pending' a 'active'
                // interface del user
                /**
                 * {
                     uid: string;
                     display_name: string;
                     email: string;
                    }
                 */
                for (const user of providerDoc.organization) {
                    console.log("cambio en org user", user.uid);
                    let us = (await firestore.collection("users").doc(user.uid).get()).data();
                    if (us) {
                        // agregar sap id y cambiar isActive
                        await firestore
                            .collection("users")
                            .doc(user.uid)
                            .update({
                                SAP_idProvider: sapID,
                                isProvider: 'active',
                                IDSociedad: idSoc
                            })
                    }
                }
            }
        }


        return res;
    } catch (error) {
        const e = error as Error;
        console.log("error", e);
        const obj: CloudRes = {
            error: true,
            msg: e.message,
            data: null,
        };
        throw obj;
    }
};
