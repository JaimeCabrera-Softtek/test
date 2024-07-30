import * as functions from "firebase-functions";
import * as _ from "lodash";
import { CloudRes } from "../../interfaces/CloudRes";
import {
  CallbackFunction,
  VerifyIntegrationRequest,
} from "../../z_helpers/IntegrationsWrapper";
import * as schema from "./reglasPasoUno_HTTP_schema.json";
import { applySimpleRules } from "./01_ValidacionReglas1";
import { User } from "../../interfaces/user";

const name = "reglasPasoUno_HTTP";

/**
 * Esta función debe ser llamada cuando se quiera ejecutar el proceso de validación de un catálogo.
 * Recibe el json de cabecera, en arreglo, y el arreglo de productos.
 */
export const reglasPasoUno_HTTP = functions
  .runWith({ memory: "8GB", timeoutSeconds: 540 })
  .https.onCall(async (data, context) => {
    const result = await VerifyIntegrationRequest(
      data,
      context,
      name,
      ["service", "tester", "proveedor"],
      schema,
      doWork,
      "CargaCatalogo",
      data.cabecera ?? "Sin cabecera"
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
    const validationResult = await applySimpleRules(
      body.catalog,
      body.cabecera[0],
      user!
    );

    if (!validationResult.error) {
      // * NO HUBO ERRORES, AQUÍ YA SE GUARDÓ UN NUEVO DOCUMENTO Y SE EJECUTÓ LA FUNCIÓN reglasPasoDos_onCreate
      res = {
        error: false,
        msg: "Catálogo creado.",
        data: validationResult,
      };
    } else {
      // * HUBO ERRORES Y SE GUARDARON EN LA RUTA QUE REGRESÓ EL MÉTODO

      res = {
        error: false,
        msg: "Se encontraron errores en la validación de las reglas simples.",
        data: validationResult,
      };
    }
  } catch (error) {
    res = {
      error: true,
      msg: `Error al crear el catálogo ${(error as Error).message}`,
      data: null,
    };
  }

  return res;
};
