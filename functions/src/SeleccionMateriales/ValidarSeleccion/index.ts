import * as functions from "firebase-functions";
import {
  CallbackFunction,
  VerifyIntegrationRequest,
} from "../../z_helpers/IntegrationsWrapper";
import { CloudRes } from "../../interfaces/CloudRes";
import * as schema from "./validarSeleccion_schema.json";
import { validarSeleccionWork } from "./validarSeleccion";
import { User } from "../../interfaces/user";

const name = "validarSeleccion"; //TODO: poner el nombre completo SeleccionMateriales-validarSeleccion

export const validarSeleccion = functions
  .runWith({ memory: "8GB", timeoutSeconds: 540 })
  .https.onCall(async (data, context) => {
    const result = await VerifyIntegrationRequest(
      data,
      context,
      name,
      ["tester", "compras"],
      schema,
      doWork,
      "SeleccionMateriales"
    );
    return result;
  });

const doWork: CallbackFunction = async (
  body: any,
  context: functions.https.CallableContext,
  user?: User
): Promise<CloudRes> => {
  let res: CloudRes = {
    error: false,
    msg: "",
    data: null,
  };

  try {
    // * EJECUTAR TRABAJO
    const r = await validarSeleccionWork(body.selection, user!);
    res = {
      ...res,
      msg: "Validación de selección realizada correctamente.",
      data: r,
    };
  } catch (error) {
    console.log(`data${JSON.stringify(body)}`);

    res = {
      error: true,
      msg: `Ocurrió un error al validar la selección: ${
        (error as Error).message
      }`,
      data: error,
    };
  }

  return res;
};
