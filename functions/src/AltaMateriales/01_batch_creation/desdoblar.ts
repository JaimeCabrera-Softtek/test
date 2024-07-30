import * as _ from "lodash";

import {
  AltaMaterial_Request_Item,
  AltaMaterial_ProductInit,
  generateMaterialInitialStatus,
  ConsecutivoJob,
  CambioPrecios_Init,
  generateCambioPreciosInitialStatus,
  Job,
  Batch_Types,
  generateExtensionBannerInitialStatus,
} from "./interfaces";
import {
  getConsecutivoJobs,
  getConsecutivo_Generico,
  getConsecutivos_Variantes,
  getMaterialesByCustomID,
} from "../../z_helpers/altamat_consecutivo";
import { getEstiloEnSAP } from "../../CargaCatalogo/services";

/**
 * Procesamiento del request enviado por la app (iPad/otra) para generar la estructura inicial donde registraremos el status de su envío a SAP por banner/segmento
 */
export const desdoblarParaFirebase = async (
  items: AltaMaterial_Request_Item[],
  user_uid: string,
  type?: Batch_Types,
  batch_id?: string
): Promise<Job[]> => {
  let arr: Job[] = [];

  const date = new Date().toISOString();
  try {
    for (const e of items) {
      // e = genérico (playera roja)
      let _g: any = _.cloneDeep(e);

      if (type && type === "cambio_precios") {
        const jobType = _g.subtype;
        delete _g.subtype;

        let cambio_precios: CambioPrecios_Init = {
          uid: user_uid,
          date,
          consecutivo: _g.NumMatGenerico, // asigno el mismo numero de material generico que ya existia en el nodo materiales/SAP
          art: _g,
          status: generateCambioPreciosInitialStatus(date, jobType),
          type: jobType,
        };

        arr.push(cambio_precios);
      } else {
        /**
         * * TIPOS nuevo_completo, extension_de_banner
         * En este bloque se definen los jobs para el tipo "nuevo_completo" y "extensión_de_banner".
         * La estructura es la misma para ambos casos, excepto que "extension_de_banner" no lleva el segmento 2 (jerarquia ventas).
         * Los segmentos se definen en status.
         * El tipo de job se define por el campo "type" en cada item (e).
         */

        /** Indica si es el job para el segundo banner (OUTLET o INNOVASPORT (INNERGY)) */
        const segundoBanner = type ? type === "extension_de_banner" : false;
        const { art, id_consecutivo_generico } = await getConsecutivos(_g);
        const { statusInicial, tipo } = await getStatusInicial(
          e,
          date,
          segundoBanner
        );

        let generico: AltaMaterial_ProductInit = {
          uid: user_uid,
          date,
          consecutivo: id_consecutivo_generico,
          art: art,
          banners: e.Unidades ?? [],
          status: statusInicial,
          type: tipo,
          canal_distribucion: getCanalDistribucion(e.Unidades[0]), // SOLO DEBERÍA HABER UN BANNER
          batch_id: batch_id ?? "undefined",
        };

        arr.push(generico);
      }
    }

    return arr;
  } catch (err) {
    throw new Error(`Hubo un error en desdoblar: ${(err as Error).message}`, {
      cause: (err as Error).cause,
    });
  }
  // items son los productos que nos mandaron dar de alta
};

/**
 * Obtiene el ID del material que va a enviar el job a SAP.
 * Obtiene el objeto "art" del job, modificando las variantes y agregando los consecutivos que le corresponden a cada una.
 */
const getConsecutivos = async (_g: any) => {
  console.log("getConsecutivos");
  const cleanEstilo = _g.Estilo.toString()
    .replaceAll(".", "")
    .replaceAll("#", "")
    .replaceAll("$", "")
    .replaceAll("[", "")
    .replaceAll("]", "");
  const identificador_personalizado = `${_g.MarcaId}+${cleanEstilo}`;
  console.log("cleanEstilo");
  /** Mapa de materiales por identificador personalizado (variantes de un mismo estilo) */
  const foundMateriales: any[] | undefined = await getMaterialesByCustomID(
    identificador_personalizado
  );
  console.log("getMaterialesByCustomID");
  /** Nodo de AltaMaterialesConsecutivosJobs de acuerdo a su identificador personalizado */
  const foundJob: ConsecutivoJob | undefined = await getConsecutivoJobs(
    identificador_personalizado
  );
  +console.log("getConsecutivoJobs");
  /** Identificador para el genérico */
  const id_consecutivo_generico = await getConsecutivo_Generico(
    foundMateriales,
    foundJob,
    identificador_personalizado
  );
  console.log("getConsecutivo_Generico");
  /**
   * Objeto "art", representa al Material que se dará de alta.
   * El resultado es el mismo art compartido, pero con los consecutivos asignados a las variantes. */
  const art = await getConsecutivos_Variantes(
    id_consecutivo_generico,
    _g,
    foundMateriales,
    foundJob,
    identificador_personalizado
  );
  console.log("getConsecutivos_Variantes");
  return { art, id_consecutivo_generico };
};

/**
 * Genera el objeto "status" inicial para cada job dependiendo el tipo de job indicado en el item.
 */
const getStatusInicial = async (
  e: any,
  date: string,
  extensionForzada: boolean
) => {
  // * IDENTIFICAR EL TIPO DE JOB
  let tipo: Batch_Types = "nuevo_completo"; // extension_de_banner o nuevo_completo

  if (extensionForzada) {
    tipo = "extension_de_banner";
  } else {
    const byEstilo = await getEstiloEnSAP(e.Estilo);
    if (byEstilo.length > 0) {
      tipo = "extension_de_banner";
    }
  }

  let statusInicial: any = {};

  switch (tipo) {
    case "extension_de_banner":
      statusInicial = generateExtensionBannerInitialStatus(date);
      break;

    case "nuevo_completo":
      statusInicial = generateMaterialInitialStatus(date);
      break;
  }

  return { statusInicial, tipo };
};

/**
 * Obtiene el canal de distribución dependiendo el banner que se vaya a dar de alta.
 */
const getCanalDistribucion = (banner: string) => {
  let canal_distribucion: string[] = ["10"];
  if (banner === "INNERGY") {
    canal_distribucion = ["50", "60", "70"];
  }

  return canal_distribucion;
};
