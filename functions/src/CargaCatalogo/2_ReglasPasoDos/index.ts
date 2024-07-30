import { catalog } from "../../interfaces/CargaCatalogo";
import { applyComplexRulesWorker } from "./02_ValidacionReglas2/worker";
import { doTransformationsWorker } from "./03_Transformaciones/worker";
import { saveProcessResults } from "./04_SaveResults";
import { updateStatus } from "../services";

/**
 * Desencadena el proceso de Reglas2 en un arreglo de objetos almacenados en un json de storage. Aplica:
 *
 * - Validación de reglas complejas (de agrupación y condicionales).
 * - Transformaciones en los objetos.
 
 * @param isError indica si se está realizando el proceso con el json de errores que tiene los productos dentro del campo products.
 * @param catalog objeto tipo catalog (documento de firestore)
 */
export const cargaCatalogProcess = async (
  isError: boolean,
  catalog: catalog
) => {
  // * Actualizar status del catalog
  await updateStatus(catalog.doc_id, "procesando");

  // * REGLAS COMPLEJAS MULTI HILO
  // aplicar reglas complejas (agrupación y condicionales)
  const okRulesObjects: any[] = await applyComplexRulesWorker(catalog, isError);

  // * TRANSFORMACIONES MULTI HILO
  const transfResults: any[] = await doTransformationsWorker(
    okRulesObjects,
    catalog
  );

  // * GUARDAR RESULTADOS
  await saveProcessResults(transfResults, catalog, isError);
};
