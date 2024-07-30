import * as functions from "firebase-functions";

import { VerifyIntegrationRequest, CallbackFunction } from "../../z_helpers/IntegrationsWrapper";
import { CloudRes } from "../../interfaces/CloudRes";


//* Se puede tomar como referencia el Template_schema.json
import * as schema from "./Template_schema.json";
import { User } from "../../interfaces/user";

/**
 * Plantilla para el desarrollo de una integración con sistemas externos
 *
 * El endpoint debe de ser onRequest, y utilizar el wrapper 'VerifyIntegrationRequest'
 * que se encarga de aplicar ciertas reglas y verificaciones básicas sobre el request como
 * el api key, así como del manejo de errores y log a analytics.
 *
 * Para loggear analytics solo tendríamos que hacer un throw
 */
export const template = functions
  .runWith({
    maxInstances: 10000
  })
  .https
  .onCall(async (data, context) => {
    const result = await VerifyIntegrationRequest(data, context, "template", ["service", "tester"], schema, mockStuff, 'Template');
    return result;
  });

/**
 * Ejemplo de una función que aplica cierta lógica core en este endpoint
 * @param body Body del request original
 * @param name Nombre de la función para los logs
 * @return CloudRes estándar
 */
const mockStuff: CallbackFunction = async (
  body: any,
  context: functions.https.CallableContext,
  user?: User
): Promise<CloudRes> => {
  const res: CloudRes = {
    error: false,
    msg: "OK",
    data: {
      result: body.a + body.b,
      user: user
    }
  };
  return res;
};
