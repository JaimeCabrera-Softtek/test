import * as functions from "firebase-functions";
import { cargaCatalogProcess } from ".";
import { analytics } from "../../z_helpers/analytics";
import { CloudRes } from "../../interfaces/CloudRes";
import { catalog } from "../../interfaces/CargaCatalogo";

/**
 * Esta función se ejecuta cuando se crea un nuevo documento en la colección catalogs y ejecuta el proceso de
 * Carga de Catálogo - Validación de reglas 2.
 */
export const reglasPasoDos_onCreate = functions
  .runWith({ memory: "8GB", timeoutSeconds: 540 })
  .firestore.document("catalogs/{catalogID}")
  .onCreate(async (snapshot, context) => {
    let result: CloudRes = {
      error: false,
      msg: "Reglas complejas y transformaciones aplicadas correctamente.",
      data: { catalogID: context.params.catalogID },
    };

    const timestamp_arrival = new Date(context.timestamp).getTime();

    try {
      const catalogID = context.params.catalogID;
      const catalogData = snapshot.data() as catalog;

      if (catalogData.doc_id === catalogID) {
        await cargaCatalogProcess(false, catalogData);

        await analytics(
          { catalogID: context.params.catalogID },
          timestamp_arrival,
          "reglasPasoDos_onCreate",
          result,
          "CargaCatalogo",
          "firestore_trigger"
        );
      } else {
        throw new Error(
          `El catalog_id (${catalogData.doc_id}) no coincide con el ID del documento (${catalogID})`
        );
      }
    } catch (error) {
      result = {
        error: true,
        msg: (error as Error).message,
        data: error,
      };

      // guardar en analytics el error
      await analytics(
        { catalogID: context.params.catalogID },
        timestamp_arrival,
        "reglasPasoDos_onCreate",
        result,
        "CargaCatalogo",
        "firestore_trigger"
      );
    }
  });
