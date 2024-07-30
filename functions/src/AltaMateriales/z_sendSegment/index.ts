
import {Reference} from "firebase-admin/database";

import { CloudRes } from "../../interfaces/CloudRes";
import { segmento01 } from "./segmento01";
import { segmento02 } from "./segmento02";
import { segmento03 } from "./segmento03";
import { segmento04 } from "./segmento04";
import { segmento05 } from "./segmento05";
import { segmento06 } from "./segmento06";
import { MATERIAL_SEGMENTS } from "../01_batch_creation/interfaces";

/**
 * Router para la lógica del segmento que corresponda
 * @param prodRef Referencia al nodo del producto en /AltaMateriales
 * @param catalog ID del catálogo
 * @param product UPC del producto
 * @param segment Número de segmento que queremos enviar
 * @return CloudRes
 */
export const sendSegment = async (prodRef: Reference, segment: number): Promise<CloudRes> => {
    //No puede ser un segmento fuera de los que tenemos
    if (segment <= MATERIAL_SEGMENTS.length) {
        const logic: any = {
            1: segmento01,
            2: segmento02,
            3: segmento03,
            4: segmento04,
            5: segmento05,
            6: segmento06,
        }

        // const queue_res = await logic[segment](prodRef)
        await logic[segment](prodRef)
    }

  return {
    error: false,
    msg: "Segmento enviado con éxito.",
    data: null,
  };
};
