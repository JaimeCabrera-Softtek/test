import * as functions from "firebase-functions";
import Ajv from "ajv";

import { CloudRes, unauthorized } from "../interfaces/CloudRes";
import { analytics } from "./analytics";
import { SchemaValidator } from "./schemaValidator";
import { verifyToken } from "./verifyToken";
import { User } from "../interfaces/user";

export type CallbackFunction = (
  body: any,
  context: functions.https.CallableContext,
  user?: User
) => Promise<CloudRes>;

const ajv = new Ajv();
const schema_validator = new SchemaValidator(ajv);

/**
 * Wrapper auxiliar en la verificación de requests entrantes.
 * Se revisa el permiso del API Key contra el servicio en cuestión, schema del body del request, y se manejan los errores.
 * Además se hace el registro a analytics de los logs que se hayan generado.
 * @param body payload del request onCall
 * @param context contexto de la llamada onCall
 * @param name Nombre de esta funcion para los logs
 * @param roles roles de usuario que tienen acceso a este recurso
 * @param schema Objeto que declara el schema a usar
 * @param callback Función encargada de la lógica core
 * @param shortBody //TODO: @socorro
 * @returns CloudRes estándar
 */
export async function VerifyIntegrationRequest(
  body: any,
  context: functions.https.CallableContext,
  name: string,
  roles: string[],
  schema: object | undefined,
  callback: CallbackFunction,
  macroproceso: string,
  shortBody?: any
): Promise<CloudRes> {
  const timestamp_arrival = new Date().getTime();

  // Validate auth context
  const auth_res = await verifyToken(context, roles);
  if (auth_res.success) {
    try {
      if (schema) {
        //validar contra un schema
        let isValid = true;
        let validationOutput = "";
        try {
          schema_validator.validate(schema, body);
        } catch (schemaEx) {
          isValid = false;
          validationOutput = (schemaEx as Error).message;
        }

        if (isValid) {
          //Schema válido, forwardear a la función core
          console.log("token & schema válido... detonando callback");
          const resultado = await callback(body, context, auth_res.user);
          await analytics(
            shortBody ?? body,
            timestamp_arrival,
            name,
            resultado, macroproceso, 'api'
          );
          return resultado;
        } else {
          //había que verificar contra un schema y no se cumple
          // const br: CloudRes = {
          //   error: true,
          //   msg: "Bad Request",
          //   data: { validationOutput },
          // };
          throw new Error("Bad Request", {cause: validationOutput});
        }
      } else {
        //no aplicar validación de schema
        const resultado = await callback(body, context, auth_res.user);
        await analytics(shortBody ?? body, timestamp_arrival, name, resultado, macroproceso, 'api');
        return resultado;
      }
    } catch (error) {
      console.log("Error: ", (error as Error).message)
      // const e = error as CloudRes;
      const obj: CloudRes = {
        error: true,
        msg: (error as Error).message,
        data: (error as Error).cause,
      };
      await analytics(shortBody ?? body, timestamp_arrival, name, obj, macroproceso, 'api');
      console.log("Internal error", JSON.stringify(obj.msg));
      return obj;
    }
  } else {
    console.error("Invalid API key or auth token");
    return unauthorized;
  }
}
