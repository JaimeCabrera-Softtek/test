import _ = require("lodash");
import { catalog } from "../../../interfaces/CargaCatalogo";
import { getComplexRules } from "../../../z_helpers/firestoreServices";
import { getJSON } from "../../../z_helpers/storageServices";
import { saveResults, updateItemStatus } from "../../services";
import { Worker } from "worker_threads";
import { ComplexRules } from "@fridaplatform-stk/motor-reglas";

/**
 * Este método aplica las reglas complejas a un grupo de productos almancenado en un .json en storage.
 * Este json contiene los productos de un catálogo subido en Innova_IBN por un proveedor.
 *
 * El proceso que aplica las reglas complejas se encuentra en la libreria node @fridaplatform-stk/motor-reglas.
 * El mapa de reglas que se aplica se obtiene de firestore.
 *
 * Después de aplicar las reglas, escribe en una carpeta (roothPath) un json que contiene los productos que no pasaron las reglas,
 * también escribe su ruta en el documento del catálogo (catalogs/catalogID), en el campo paths.error_rules2
 *
 * Se retorna un arreglo de productos que sí pasaron las reglas.
 * @param catalog: objeto tipo catalog (documento de firestore)
 * @param isError false: se está realizando el proceso de validación por primera vez (trigger onCreate)
 * true: se está realizando el proceso para reevaluar las transformaciones del catálogo (función HTTP)
 * en este caso, se salta las validaciones de las reglas complejas.
 * @return arreglo de productos que sí pasaron las reglas.
 */
export const applyComplexRulesWorker = async (
  catalog: catalog,
  isError: boolean
) => {
  console.log("aplicando reglas complejas...");

  const allProdsPath = isError
    ? catalog.paths.error_transformations!
    : catalog.paths.all_products;

  // obtener arreglo de objetos a evaluar
  const json = await getJSON(`${allProdsPath}`);

  // * APLICAR REGLAS COMPLEJAS
  // obtener mapa de reglas complejas
  const complexRules: ComplexRules = await getComplexRules();

  // * SI EL PROCESO SE ESTÁ REALIZANDO CON UN CATÁLOGO NUEVO (trigger onCreate) SE EJECUTA LA VALIDACIÓN DE REGLAS COMPLEJAS
  if (!isError) {
    // ? get products batches
    /** Agrupación del catálogo por estilo, para que todos los UPC de un estilo se procesen en el mismo batch */
    const porEstilo: { [estilo: string]: any[] } = _.groupBy(json, "Estilo");
    console.log("Total de estilos:", _.keys(porEstilo).length);
    /** Batch temporar que se va a ir armando, va a tener poco más de 2000 UPC */
    let tempBatch: any[] = [];
    /** Arreglo de batches que se van a procesar, tipo [['a', 'b'], ['c', 'd']] */
    let batches: any[] = [];
    // const batches = _.chunk(_.cloneDeep(json), 2000); // [['a', 'b'], ['c', 'd']]

    // procesar cada estilo (arreglo de UPC)
    for (const estiloBatch of _.values(porEstilo)) {
      // agregar el estilo actual al batch temporal
      tempBatch = tempBatch.concat(estiloBatch);

      // si el batch temporal tiene más de 2000 upc...
      if (tempBatch.length > 2000) {
        // agregar el batch temporal al arreglo de batches
        batches.push(tempBatch);
        // limpiar el batch temporal
        tempBatch = [];
      }
    }

    // agregar el último batch que no llegó a los 2000 items
    if (tempBatch.length > 0) {
      batches.push(tempBatch);
      tempBatch = [];
    }

    console.log(`${batches.length} batches por procesar`);

    const promises = _.values(batches).map(async (x: any, y: any) => {
      return workerHelper({
        rules: complexRules,
        json: x,
      }); // esto recibe el método de transformaciones
    });

    const results: any = await Promise.all(promises);

    // GUARDAR ERRORES
    const finalResults = getFinalResults(results);

    // ! GUARDARLO AUNQUE SEA ARREGLO VACIO
    await saveReglasDosResults(finalResults.errorObjects, catalog);

    console.log("reglas complejas terminadas");

    // regresar objetos sin errores
    return finalResults.okObjects;
  } else {
    // * SI EL PROCESO SE ESTÁ REALIZANDO CON LA FUNCIÓN onCall SE ASUME QUE SE VAN A RE-EVALUAR OBJETOS QUE YA PASARON LA VALIDACIÓN DE REGLAS COMPLEJAS Y SOLO SE VAN A VOLVER A TRANSFORMAR
    // retorna los objetos del json de errores de transformaciones que ya existia para volver a aplicar transformaciones
    return json.products;
  }
};

const workerHelper = async (data: { rules: ComplexRules; json: any[] }) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      "././lib/CargaCatalogo/2_ReglasPasoDos/02_ValidacionReglas2/index.js",
      {
        workerData: data,
      }
    );

    worker.once("message", (data: any) => {
      resolve(data);
    });

    worker.once("error", (err: any) => {
      reject((err as Error).message);
    });
  });
};

/**
 * Aqui se están condensando los resultados de las tareas del worker
 * @param res arreglo de resultados del worker
 * @returns misma estructura entrante, pero con los resultados condensados
 */
const getFinalResults = (res: any[]) => {
  let finalResults: any = {
    errorObjects: [],
    okObjects: [],
  };

  res.forEach((r: any) => {
    finalResults["errorObjects"] = [
      ...finalResults["errorObjects"],
      ...r.errorObjects,
    ];

    finalResults["okObjects"] = [...finalResults["okObjects"], ...r.okObjects];
  });

  return finalResults;
};

/**
 * Guardar los objetos con errores en las reglas complejas.
 * @param errorObjects arreglo de productos con errores en las reglas complejas
 * @param catalog catalogo que estamos trabajando
 */
const saveReglasDosResults = async (errorObjects: any[], catalog: catalog) => {
  const rootPath = catalog.paths.root;
  const catalogID = catalog.doc_id;

  // * GUARDAR LOS OBJETOS CON ERRORES EN LAS REGLAS COMPLEJAS
  // guardar status en el documento
  await updateItemStatus(
    catalogID,
    "total_error_provider",
    errorObjects.length
  );

  // guarda arreglo de objetos en storage
  await saveResults(
    errorObjects,
    `${rootPath}/error_rules2_provider.json`,
    catalogID,
    "error_rules2"
  );
};
