import {
  CatalogSheet,
  Transformation,
  TransformationProcess,
} from "@fridaplatform-stk/motor-reglas";
import _ = require("lodash");
import { workerData, parentPort } from "worker_threads";
import { KBSTransformator } from "./kbsTransformation";
import { getEstiloEnSAP } from "../../services";
import {
  Jerarquia_Solicitada,
  catalog,
} from "../../../interfaces/CargaCatalogo";
import {
  jerarquiasSolicitadas,
  removeNodosJerarquia,
  saveJerarquiasSolicitadas,
} from "./jerarquiasSolicitadass";

/**
 * Subproceso para transformar productos. Se llama por cada batch enviado desde el hilo principal.
 * @param okRulesObjects batch de productos a procesar
 * @param mergedTransformations mapa de transformaciones combinado (principal y proveedor)
 * @param rulesArray reglas del catálogo
 * @param kbsTransf configuración de las Transformaciones para KBS
 * @param checkUnitalla indica si está activa la regla UNITALLA, que dice, que si el estilo tiene solo una talla, debe ser UNITALLA
 * @param tallasRules universo de tallas permitidas
 * @param concordanciaEnabled bandera para saber si se van a aplicar las reglas de tallas
 */
const doTransformations = async (
  okRulesObjects: any[],
  mergedTransformations: Transformation[],
  rulesArray: CatalogSheet,
  kbsTransf: Transformation[],
  checkUnitalla: boolean,
  tallasRules: any,
  concordanciaEnabled: boolean,
  catalog: catalog,
  generos: any,
  divisiones: any,
  deportes: any,
  marcas: any,
  familias_auto: any,
  siluetas: any
) => {
  console.log("Items en el batch transformacion", okRulesObjects.length);
  let jerarquias: string[] = [];
  let errorTallas: any = [];

  // * APLICAR TRANSFORMACIONES
  try {
    let okProducts: any[] = [];

    // * REALIZAR TRANSFORMACIONES
    // aplicar transformaciones desde @fridaplatform-stk/motor-reglas
    let transformationResult = TransformationProcess(
      mergedTransformations,
      rulesArray,
      okRulesObjects,
      "UPC"
    );

    okProducts = transformationResult.okObjects;
    okProducts = doSpecificTransformatios(okProducts);

    // APLICAR LAS TRANSFORMACIONES DE KBS
    let kbsResults = await KBSTransformator(
      kbsTransf,
      rulesArray,
      okProducts,
      false
    );

    kbsResults = await KBSTransformator(
      kbsTransf,
      rulesArray,
      kbsResults.updData,
      true
    );

    okProducts = kbsResults.updData;

    // * REGLAS DE TALLAS

    // reglas de talla (no incluidas en la libreria) DEBEN APLICARSE A PRODUCTOS TRANSFORMADOS

    const tallasValidation = await tallasValidator(
      okProducts,
      checkUnitalla,
      tallasRules,
      concordanciaEnabled
    );
    okProducts = tallasValidation.ok;

    // guardar errores como errores de proveedor
    if (tallasValidation.errores.length > 0) {
      errorTallas = tallasValidation.errores;
    }

    transformationResult = { ...transformationResult, okObjects: okProducts };

    // ? DETECCION DE JERARQUIAS POR ESTILO
    // * PARA JERARQUIAS SOLICITADAS
    let jerarquias_existentes: string[] = [];
    let jerarquias_solicitadas: string[] = [];
    let nodos_JerarquiasSolicitadas: { [upc: string]: Jerarquia_Solicitada } =
      {};

    const groupedByEstilo = _.groupBy(okProducts, "Estilo");

    for (const products of _.values(groupedByEstilo)) {
      // detecta si la jerarquia que seria del producto existe en SAP
      const jerarquiaResults = await jerarquiasSolicitadas(
        products,
        catalog,
        jerarquias_existentes,
        jerarquias_solicitadas,
        generos,
        divisiones,
        deportes,
        marcas,
        familias_auto,
        siluetas
      );

      // Si Jerarquia existe....
      if (jerarquiaResults.exists) {
        // la agrego al arreglo de jerarquias existentes, para evitar volver a consultar BD si otro producto tiene la misma jerarquia
        if (!jerarquias_existentes.includes(jerarquiaResults.jerarquia)) {
          jerarquias_existentes.push(jerarquiaResults.jerarquia);
        }
      } else {
        // si la jerarquia no existe...
        // la agrego al arreglo de jerarquias solicitadas, para evitar volver a consultar BD si otro producto tiene la misma jerarquia
        if (!jerarquias_solicitadas.includes(jerarquiaResults.jerarquia)) {
          jerarquias_solicitadas.push(jerarquiaResults.jerarquia);
        }

        // ademas que voy almacenando el nodo que se va a guardar en el nodo JerarquiaSolicitadas
        nodos_JerarquiasSolicitadas = {
          ...nodos_JerarquiasSolicitadas,
          ...jerarquiaResults.data,
        };
      }
    }

    // * GUARDAR EL NODO DE JERARQUIAS SOLICITADAS
    if (!_.isEmpty(nodos_JerarquiasSolicitadas)) {
      const j_solicitadas = Object.values(nodos_JerarquiasSolicitadas).map(
        (j) => j.Jerarquia_Solicitada
      );

      jerarquias = Array.from(new Set(j_solicitadas));

      await saveJerarquiasSolicitadas(nodos_JerarquiasSolicitadas);

      console.log(
        "Jerarquias solicitadas guardadas",
        _.values(nodos_JerarquiasSolicitadas).length
      );
    }

    if (jerarquias_existentes.length > 0) {
      await removeNodosJerarquia(jerarquias_existentes);
    }

    parentPort?.postMessage({
      transformationResult,
      errorTallas,
      kbsResults: kbsResults.missing,
      jerarquias,
    });
  } catch (error) {
    throw new Error((error as Error).message);
  }
};

/**
 * Ejecuta la validación de tallas que no se aplican desde la libreria de reglas.
 * @param objects productos a los que se les van a aplicar las reglas
 * @param checkUnitalla indica si está activa la regla UNITALLA, que dice, que si el estilo tiene solo una talla, debe ser UNITALLA
 * @param tallasRules universo de tallas permitidas
 * @returns arreglo de productos con errores & arreglo de productos sin errores
 */
const tallasValidator = async (
  objects: any[],
  checkUnitalla: boolean,
  tallasRules: any,
  concordanciaEnabled: boolean
) => {
  /** Productos que no cumplen con la validación de tallas */
  let errores: any[] = [];
  /** Productos que cumplen con la validación de tallas */
  let ok: any[] = [];

  /** Universo de arreglos de tallas aceptadas */
  const tallasComb = _.values(tallasRules);

  /** Agrupación de productos por estilo */
  const groupedByEstilo = _.groupBy(objects, "Estilo");

  // recorrer cada estilo
  for (const [estilo, prds] of _.entries(groupedByEstilo)) {
    // * TRAER EL ESTILO DE LOS MATERIALES DADOS DE ALTA, PORQUE LA CONCORDANCIA DE TALLAS DEBE SER EN LO QUE VIENE EN EL CATÁLOGO Y EN LO DADO DE ALTA EN SAP
    const materialesEnSAP: any[] = await getEstiloEnSAP(estilo);
    const mergedProducts: any[] = [...materialesEnSAP, ...prds];

    /** Arreglo de tallas del estilo */
    const tallas = mergedProducts.map((p) => p.Talla);

    // si hay más de una talla, se aplica la regla de concordancia de tallas, no combinar alfanumericas con numericas, etc
    if (tallas.length > 1) {
      let cumple = true;

      // Si existe la regla de UNITALLA, hay dos o más tallas por estilo e incluye UNITALLA
      if (checkUnitalla && tallas.includes("UNITALLA")) {
        // si solo hay dos items
        if (tallas.length === 2) {
          // existe la probabilidad que sea el mismo UPC, si es diferente UPC, es que hay dos productos, imposible que sea UNITALLA ambos debido a la regla UNITALLA configurada
          if (mergedProducts[0].UPC !== mergedProducts[1].UPC) {
            // no cumple porque hay dos productos con diferente UPC
            cumple = false;
          }
        } else {
          // no cumple porque no se puede tener más de un producto en un estilo que sea UNITALLA
          cumple = false;
        }
      } else {
        if (concordanciaEnabled) {
          // aplicar reglas de concordancia...
          cumple = checkTallas(tallasComb, tallas);
        } else {
          cumple = true;
        }
      }

      if (cumple) {
        // el estilo cumple la regla de concordancia de tallas, agregar los productos al arreglo de ok products
        ok = [...ok, ...prds];
      } else {
        // el estilo NO cumple la regla de concordancia de tallas, agregar los productos al arreglo de errores
        const es = prds.map((p) => ({
          ...p,
          _errors_: [
            `Estilo ${estilo} no tiene concordancia en las tallas. Se encontraron las tallas ${tallas.join(
              ", "
            )} para el estilo.`,
          ],
        }));
        errores = [...errores, ...es];
      }
    } else {
      // * Si está activa la regla "UNITALLA" Y EL ARTICULO NO ES UN ACCESORIO
      if (checkUnitalla && prds[0]["División"] !== "ACCESORIOS") {
        // si el estilo solo tiene una talla, debe ser UNITALLA
        if (prds[0].Talla !== "UNITALLA") {
          // el estilo NO cumple la regla UNITALLA, agregar el producto al arreglo de errores
          const es = prds.map((p) => ({
            ...p,
            _errors_: [
              `Estilos (TEXTIL/CALZADO) con una sola talla debe ser UNITALLA.`,
            ],
          }));
          errores = [...errores, ...es];
        } else {
          // el producto tiene una sola talla UNITALLA, agregarlo al producto de productos correctos
          ok = [...ok, ...prds];
        }
      } else {
        ok = [...ok, ...prds];
      }
    }
  }

  return { errores, ok };
};

/**
 * Teniendo un arreglo de arreglos de tallas base: [["CH", "M", "G"], ["21", "21.5", "26"]]
 *
 * Verificar si un arreglo dado es válido.
 *
 * Para que sea válido el arreglo dado, todos sus elementos deben exisitir en el mismo arreglo base.
 *
 * ["CH", "G"] -> correcto
 * ["CH", "25"] -> incorrecto
 * @param combinaciones universo de arreglos permitidos
 * @param tallas arreglo de tallas a verificar
 * @returns true | false si cumple o no la regla, respectivamente
 */
const checkTallas = (combinaciones: string[][], tallas: string[]) => {
  let cumple = false;

  // recorrer las posibles combinaciones
  for (const comb of combinaciones) {
    // console.log(JSON.stringify(comb));
    // si la combinación contiene el primer elemento de las tallas ...
    if (comb.includes(tallas[0])) {
      let ok = 0;
      // ... todas las tallas deben estar en la combinación
      for (const talla of tallas) {
        // checando que la combinación incluya todas las tallas
        if (comb.includes(talla)) {
          ok++;
        } else {
          break;
        }
      }

      // si todas las tallas vienen en la combinación
      if (ok === tallas.length) {
        cumple = true;
        break;
      }
    }
  }

  return cumple;
};

/**
 * Este método quita el color y la talla de la descripción corta y larga de los productos
 * @param okObjects productos a los que se les va a aplicar esta transformación
 * @returns productos con las descripciones sustituidas
 */
const doSpecificTransformatios = (okObjects: any[]) => {
  const sustituidos: any[] = [];

  for (const obj of okObjects) {
    // * GET VALORES QUE NO QUEREMOS
    const color = obj["Color"] as string,
      color_mayus = color.toUpperCase(),
      color_minus = color.toLowerCase(),
      color_camel = `${color_mayus.charAt(0)}${color_minus.substring(1)}`,
      talla = `${obj["Talla"]}`,
      tallaRegex = new RegExp("\\s" + talla, "g");

    /** Estos valores no deben estar en el campo */
    const values = [color, color_camel, color_mayus, color_minus, tallaRegex];

    /** Estos campos son a los que se les va a hacer la sustitución */
    const fields = [
      "Descripción larga del producto",
      "Descripción corta del producto",
    ];

    // por cada campo que se va a sustituir
    fields.forEach((field) => {
      // recorrer cada valor que no queremos
      values.forEach((v) => {
        // sustuir el valor encontrado por cadena vacia
        obj[field] = obj[field].replaceAll(v, "");
      });
    });

    sustituidos.push(obj);
  }

  return sustituidos;
};

// Inicializar worker
doTransformations(
  workerData.objects,
  workerData.mergedTransformations,
  workerData.rulesArray,
  workerData.kbsTransformations,
  workerData.checkUnitalla,
  workerData.tallasRules,
  workerData.enabled,
  workerData.catalog,
  workerData.generos,
  workerData.divisiones,
  workerData.deportes,
  workerData.marcas,
  workerData.familias_auto,
  workerData.siluetas
);
