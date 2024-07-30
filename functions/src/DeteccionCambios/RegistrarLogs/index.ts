import * as functions from "firebase-functions";
import * as schema from "./CambiarStatus_schema.json";
import {
  CallbackFunction,
  VerifyIntegrationRequest,
} from "../../z_helpers/IntegrationsWrapper";
import { CloudRes } from "../../interfaces/CloudRes";
import _ = require("lodash");
import { User } from "../../interfaces/user";
import { getCambio, saveChangesREST } from "../../z_helpers/realtimeServices";
import { Changes, change } from "../../interfaces/CargaCatalogo";

/**
 * Esta función recibe dos params:
 * - items: es una relacion generico-campos con cambios, que representa, por generico, que cambios se van a aceptar o rechazar
 * - approved: true para aprobar cambios, false para rechazarlos
 *
 * En base a los params, escribe en el nodo Cambios/generico/cambios/log -> la aprobación/rechazo del cambio
 */
export const registrarLogs = functions
  .runWith({ memory: "8GB", timeoutSeconds: 540 })
  .https.onCall(async (data, context) => {
    const result = await VerifyIntegrationRequest(
      data,
      context,
      "DeteccionCambios-cambiarStatus",
      ["compras", "mdm", "tester"],
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
    const data = await changeCambiosStatus(body.items, body.approved, user);

    return {
      error: false,
      msg: "Cambios guardados con éxito.",
      data: { items: _.keys(data) },
    };
  } catch (error) {
    return {
      error: true,
      msg: "Error inesperado",
      data: null,
    };
  }
};

/** Actualiza el campo log de los cambios en realtime de acuerdo a la bandera recibida */
export const changeCambiosStatus = async (
  map: { [g: string]: string[] },
  approved: boolean,
  user?: User
) => {
  let updater: Changes = {};

  // por cada material generico que se vaya a actualizar...
  for (const [customID, fields] of _.entries(map)) {
    const actualCambio: change = await getCambio(customID);
    updater[customID] = { ...actualCambio };

    // cada campo que se vaya a actualizar...
    for (const field of fields) {
      updater[customID]["cambios"][field]["log"] = {
        approved: approved, // * AQUI SE DEFINE SI SE ACEPTÓ O RECHAZO EL CAMBIO
        date: new Date().toISOString(), // fecha
        user: user?.uid ?? "no uid", // quien
      };

      // actualizar precios helper para react
      if (approved) {
        if (field === "Precio_compra") {
          updater[customID]["precios"]!["compra"] =
            updater[customID]["cambios"][field]["after"];
        }
        if (field === "Precio_venta") {
          updater[customID]["precios"]!["venta"] =
            updater[customID]["cambios"][field]["after"];
        }
      }
    }

    // actualizar bandera que indica si todos los campos ya se han revisado
    const changedCount = _.values(updater[customID].cambios).filter(
      (c) => c.log
    ).length;

    if (changedCount === _.keys(updater[customID].cambios).length) {
      updater[customID].allChangesCheck = true;
    }
  }

  // ACTUALIZAR LOS REGISTROS EN REALTIME
  await saveChangesREST(updater);

  return updater;
};
