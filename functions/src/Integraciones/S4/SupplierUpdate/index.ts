import * as functions from "firebase-functions";

import {CloudRes} from "../../../interfaces/CloudRes";
import {firestore} from "../../../firebase";
import {CallbackFunction, VerifyIntegrationRequest} from "../../../z_helpers/IntegrationsWrapper";
import { User } from "../../../interfaces/user";

/**
 * Endpoint para recibir updates en los proveedores
 * S4 nos manda los proveedores agregados/editados para replicar en IBN
 * {
 *  brands: {
 *      <id>: {data},
 *      <id>: {data},
 *      <id>: {data},
 *      <id>: {data},
 *  }
 * }
 */
export const supplierUpdate = functions.https.onCall(async (data, context) => {
  const result = await VerifyIntegrationRequest(
    data, context,
    "Integraciones-S4-brandUpdate",
    ["service"],
    undefined,
    doWork,
    'RegistroProveedores'
  );
  return result;
});

const doWork: CallbackFunction = async (
  body: any,
  context: functions.https.CallableContext,
  user?: User
): Promise<CloudRes> => {
  try {
    const {suppliers} = body;
    const collectionName = "proveedor_test"; // aquí debe de ser la colección de usuarios
    const batch = firestore.batch();
    for (const id of Object.keys(suppliers)) {
      // TODO: Buscar al usuario filtrando por el ID de proveedor que nos da SAP
      const s_ref = firestore.collection(collectionName).doc(id);
      /**
             * TODO: Seguramente lo que se recibe tenemos que transformarlo
             */
      const supplier_data = suppliers[id];
      batch.set(s_ref, supplier_data);
    }
    await batch.commit();

    const obj: CloudRes = {
      error: false,
      msg: "OK",
      data: {
        updatedSuppliers: Object.keys(supplierUpdate),
      },
    };

    return obj;
  } catch (error) {
    const e = error as Error;
    const obj: CloudRes = {
      error: true,
      msg: e.message,
      data: null,
    };

    throw obj;
  }
};
