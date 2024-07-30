import * as functions from "firebase-functions";
import * as schema from "./HandleMonitor_MDM_schema.json";
import {
  CallbackFunction,
  VerifyIntegrationRequest,
} from "../../z_helpers/IntegrationsWrapper";
import { CloudRes } from "../../interfaces/CloudRes";
import { changeCambiosStatus } from "../RegistrarLogs";
import { User } from "../../interfaces/user";
import { appConfig, change } from "../../interfaces/CargaCatalogo";
import {
  getCambio,
  getMaterialByGenerico,
} from "../../z_helpers/realtimeServices";
import _ = require("lodash");
import { db } from "../../firebase";
import { getAppConfig, getCatalog } from "../../z_helpers/firestoreServices";
import {
  updateItemStatus,
  updateUpdateDate,
} from "../../CargaCatalogo/services";

export const handleMonitor_MDM = functions
  .runWith({ memory: "8GB", timeoutSeconds: 540 })
  .https.onCall(async (data, context) => {
    const result = await VerifyIntegrationRequest(
      data,
      context,
      "DeteccionCambios-handleMonitor_MDM",
      ["mdm", "tester"],
      schema,
      doWork,
      "CambiosCatalogo"
    );
    return result;
  });

const doWork: CallbackFunction = async (
  body: any,
  context: functions.https.CallableContext,
  user?: User
): Promise<CloudRes> => {
  try {
    // * OBTENER LA ESTRUCTURA PARA batch_creation
    await handleMap(body.items);
    console.log("productos actualizados");

    //*  SI TODO SALE BIEN, REGISTRAR LOGS EN REALTIME
    await changeCambiosStatus(body.items, true, user);
    console.log("cambio logs en realtime");

    return {
      error: false,
      msg: "Cambios realizados con éxito.",
      data: { items: _.keys(body.items) },
    };
  } catch (error) {
    return {
      error: true,
      msg: (error as Error).message,
      data: null,
    };
  }
};

const handleMap = async (map: { [g: string]: string[] }) => {
  const appConf: appConfig = await getAppConfig();
  for (const [customID, fields] of _.entries(map)) {
    const generico = customID.split("-")[0];
    // traer el objeto cambios de realtime
    const cambios: change = await getCambio(customID);

    // traer el mapa de materiales con este generico
    const materialesSAP = await getMaterialByGenerico(generico);

    // obtener el item Material que se le va a enviar a batch creation
    await updateProducts(
      _.keys(materialesSAP),
      fields,
      cambios,
      appConf.fieldsToCheckChanges
    );

    // ** ACTUALIZAR STATUS Y OTROS CAMPOS DEL CATÁLOGO
    const catalog = await getCatalog(cambios.cabecera.catalogID);
    if (catalog) {
      const totalOldOk = catalog.item_status.total_ok ?? 0;
      await updateUpdateDate(cambios.cabecera.catalogID);
      await updateItemStatus(
        cambios.cabecera.catalogID,
        "total_ok",
        totalOldOk + _.keys(materialesSAP).length
      );
    }
  }
};

const updateProducts = async (
  variantes: string[],
  changedFields: string[],
  changes: change,
  equivalencias: { [sap: string]: string }
) => {
  // * CONSTRUIR OBJETO UPDATER
  const updatedData: any = { catalog: changes.cabecera.catalogID };

  for (const changedField of changedFields) {
    if (!changedField.includes("precio") && changes.cambios[changedField]) {
      updatedData[equivalencias[changedField]] =
        changes.cambios[changedField].after;
    }
  }

  // por cada variante
  for (const upc of variantes) {
    // * ACTUALIZA INFO DEL PRODUCTO
    const productosRef = db.ref(
      `Productos/${changes.cabecera.providerID}/${changes.cabecera.brandID}`
    );
    const allRef = productosRef.child("Productos").child(upc);
    const lastV = (await allRef.once("value")).val();

    // * ACTUALIZA INFO DEL PRODUCTO EN /Products
    const date = new Date().toISOString().split(".")[0];
    const historialRef = productosRef.child(`Historial/${upc}/${date}`);
    const catalogsRef = productosRef.child(
      `Catalogos/${updatedData.catalog}/${upc}`
    );

    await allRef.set({ ...lastV, ...updatedData });
    await historialRef.set({ ...lastV, ...updatedData });
    await catalogsRef.set({ ...lastV, ...updatedData });
  }
};
