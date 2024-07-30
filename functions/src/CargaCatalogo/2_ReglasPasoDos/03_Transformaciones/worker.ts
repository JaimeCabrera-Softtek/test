import _ = require("lodash");
import { catalog } from "../../../interfaces/CargaCatalogo";
import { Worker } from "worker_threads";
import {
  gerProviderByIDSAP,
  getOneRuleItem,
  getSimpleRulesMap,
  getTallasRules,
  getTransformationMap,
} from "../../../z_helpers/firestoreServices";
import { Transformation } from "@fridaplatform-stk/motor-reglas";
import { getHelperCatalog } from "./jerarquiasSolicitadass";

/**
 * Este método transforma un arreglo de productos de acuerdo al mapa de transformaciones, obtenido de firestore.
 * Se considera que los productos a transformar ya han pasado la validación de reglas complejas.
 * El proceso de transformaciones está alojado en el paquete node js @fridaplatform-stk/motor-reglas.
 *
 * Después de aplicar las transformaciones, escribe en una carpeta (roothPath) un json para los productos que
 * NO pudieron transformar, y en el doc del catálogo se agrega la ruta en el campo paths.error_transformations_mdm
 *
 * Los productos que sí se pudieron transformar, se almacenan en realtime.
 *
 * También modifica el campo status del documento del catálogo.
 * Si hay productos que no se hayan podido transformar, el status es "revision"
 * Si todos los productos se pudieron transformar, el status es "aprobado"
 *
 * @param objects arreglo de objetos que se van a transformar, ya han pasado la validación de reglas complejas.
 * @param catalog objeto tipo catalog (documento de firestore)
 *
 */
export const doTransformationsWorker = async (
  objects: any[],
  catalog: catalog
) => {
  console.log("transformando...");

  // * OBTENER MAPA DE TRANSFORMACIONES
  // obtener el mapa de transformaciones GENERAL de firestore
  const subMap = "DETALLES";
  const transArray = await getTransformationMap("0000000_general", subMap);

  // obtener el provider id del usuario
  const provider: any = await gerProviderByIDSAP(catalog.provider_id);
  const providerID = provider.doc_id;
  const transProvider = await getTransformationMap(providerID, subMap);

  // obtener las reglas simples (1) de firestore, se necesitan para ver si un campo puede ser undefined
  const rulesArray = await getSimpleRulesMap();

  // se necesitan los dos mapas para que se puedan realizar las transformaciones
  if (!transArray || transArray.length === 0) {
    throw new Error("Transformations map not found");
  } else if (!rulesArray || rulesArray.sheetsRules.length === 0) {
    throw new Error("Rules map not found");
  } else {
    const kbsTransformations = await getTransformationMap(
      "0000000_general",
      "KBS"
    );

    const mergedTransformations = mergeTransformationMaps(
      transArray,
      transProvider
    );

    /** ¿Está activa la regla UNITALLA? */
    const checkUnitalla: boolean = await getOneRuleItem(
      "TallasUnitallaEnabled"
    );

    // obtener mapa de reglas complejas
    const tallasRules: { [k: string]: string[] } = await getTallasRules();

    // bandera que indica si se aplican o no, hasta que no estén completos los universos de tallas deberia estar apagada (dev)
    const enabled: boolean = await getOneRuleItem("TallasRulesEnabled");

    // * PARA JERARQUIAS SOLICITADAS
    const generos = await getHelperCatalog("Generos");
    const divisiones = await getHelperCatalog("Division");
    const deportes = await getHelperCatalog("Deportes");
    const marcas = await getHelperCatalog("Marcas");
    const familias_auto = await getHelperCatalog("Familia_Automatica");
    const siluetas = await getHelperCatalog("Silueta");

    // * INICIA PROCESO DE TRANSFORMACION
    // ? get products batches
    /** Agrupación del catálogo por estilo, para que todos los UPC de un estilo se procesen en el mismo batch */
    const porEstilo: { [estilo: string]: any[] } = _.groupBy(objects, "Estilo");
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
        objects: x,
        mergedTransformations,
        rulesArray,
        kbsTransformations,
        checkUnitalla,
        tallasRules,
        enabled,
        catalog,
        generos,
        divisiones,
        deportes,
        marcas,
        familias_auto,
        siluetas,
      }); // esto recibe el método de transformaciones
    });

    const results: any[] = await Promise.all(promises);

    return results;
  }
};

const workerHelper = async (data: any) => {
  //? change Any to struct later on
  return new Promise((resolve, reject) => {
    // console.log("starting new worker");
    const worker = new Worker(
      "././lib/CargaCatalogo/2_ReglasPasoDos/03_Transformaciones/index.js",
      {
        workerData: data,
      }
    );

    worker.once("message", (data: any) => {
      // console.log(`worker[${worker.threadId}] done`);
      resolve(data);
    });

    worker.once("error", (err: any) => {
      // console.log("rejected", JSON.stringify(err));
      reject((err as Error).message);
    });
  });
};

/**
 * Combina dos mapas de transformacion
 * @param baseMap Mapa de transformación general
 * @param providerMap Mapa de transformacion por proveedor
 * @return Mapa de transformación combinado
 */
const mergeTransformationMaps = (
  baseMap: Transformation[],
  providerMap: Transformation[]
) => {
  // * MERGE DE AMBOS MAPAS DE TRANSFORMACIONES (GENERAL Y POR PROVEEDOR)
  const mergedTrans: Transformation[] = [...baseMap];
  for (const trans of providerMap) {
    // encontrar si el field de la transformación ya está en el mapa base
    const index = mergedTrans.findIndex((t) => t.field === trans.field);
    if (index >= 0) {
      // si está el field, recorrer los items de transformación
      for (const transItem of trans.transformations) {
        // representa la condición de este item
        const conditions = JSON.stringify(transItem.conditions ?? {});
        // ¿esta condición ya está en el mapa base?
        const itemIndex = mergedTrans[index].transformations.findIndex(
          (t) => JSON.stringify(t.conditions ?? {}) === conditions
        );

        // esta condición sí está
        if (itemIndex >= 0) {
          // se hace merge del mapa base y mapa proveedor
          // ! EL MAPA DE PROVEEDOR TENDRÁ PREFERENCIA
          const merge = {
            ...mergedTrans[index].transformations[itemIndex].map,
            ...transItem.map,
          };

          // se guarda el merge en el mapa base
          mergedTrans[index].transformations[itemIndex].map = merge;
        } else {
          // esta condición no está, agregarla a las transformaciones del field
          mergedTrans[index].transformations.push(transItem);
        }
      }
    } else {
      // no está, agregar esta transformación al merge
      mergedTrans.push(trans);
    }
  }

  return mergedTrans;
};
