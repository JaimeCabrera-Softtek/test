import * as functions from "firebase-functions";
import { cargaCatalogProcess } from ".";
import { getCatalog } from "../../z_helpers/firestoreServices";
import { CloudRes } from "../../interfaces/CloudRes";
import {
  CallbackFunction,
  VerifyIntegrationRequest,
} from "../../z_helpers/IntegrationsWrapper";
import { User } from "../../interfaces/user";
import * as schema from "./reglasPasoDos_HTTP_schema.json";
const name = "reglasPasoDos_HTTP";

/**
 * Esta función debe ser llamada cuando el MDM quiera reevaluar el output de errores ejecuta el proceso de
 * Carga de Catálogo - Validación de reglas 2.
 */
export const reglasPasoDos_HTTP = functions
  .runWith({ memory: "8GB", timeoutSeconds: 540 })
  .https.onCall(async (data, context) => {
    const result = await VerifyIntegrationRequest(
      data,
      context,
      name,
      ["service", "tester", "mdm"],
      schema,
      doWork,
      "CargaCatalogo"
    );
    return result;
  });

const doWork: CallbackFunction = async (
  body: any,
  context: functions.https.CallableContext,
  user?: User
): Promise<CloudRes> => {
  let result: CloudRes = {
    error: false,
    msg: "Se reprocesaron las reglas complejas y las transformaciones correctamente.",
    data: null,
  };

  try {
    const catalogID = body.catalog;
    result.data = { catalogID };

    const isError = body.isError ?? false;
    const catalogData = await getCatalog(catalogID);

    if (catalogData) {
      if (catalogID === catalogData.doc_id) {
        // REALIZAR PROCESO
        await cargaCatalogProcess(isError, catalogData);
      } else {
        throw new Error(
          `El catalog_id (${catalogData.doc_id}) no coincide con el ID del documento (${catalogID})`
        );
      }
    } else {
      throw new Error(`Catalog ${catalogID} not found`);
    }
  } catch (error) {
    result = {
      error: true,
      msg: (error as Error).message,
      data: (error as Error).name,
    };
  }

  return result;
};
