import axios from "axios";
import { Reference } from "firebase-admin/database";

import { CloudRes, res_ok } from "../../interfaces/CloudRes";
import { saveCPI_queue_response } from "./helpers/fb_materiales_helpers";
import { cpiQueued, getTokenCpiMateriales } from "./helpers/cpi_hepers";
import { AltaMaterial_ProductInit } from "../01_batch_creation/interfaces";
import { body06 } from "./helpers/segment_body_helpers/6";

/**
 * Enviar el segmento 6 a SAP
 * @param prodRef Referencia al nodo del producto en /AltaMateriales
 */
export const segmento06 = async (prodRef: Reference): Promise<CloudRes> => {
    const product_data = (await prodRef.once('value')).val() as AltaMaterial_ProductInit;
    const token = await getTokenCpiMateriales();
    const segmentNum = 6;


    //TODO: armar json body para envío del primer segmento
    const _temp = await body06(product_data, 'create');

    if (process.env.CPI_SEGMENT_ENV === 'PROD') {
        console.log("Enviando a CPI JobID", product_data.push_id, "Segmento 6");

        //#region envío
        try {
            const url: string = process.env.ALTAMATERIALES_CPI_R57_SEGMENT06 ?? '';

            const res = await axios.post(
                url,
                _temp,
                {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                }
            )

            console.log('CPI Segment 06', 'req.body', JSON.stringify(_temp));
            console.log('CPI Segment 06', 'res.data', JSON.stringify(res.data));

            //A partir de res.data saber si fue encolado
            const wasQueued = cpiQueued(res.data);

            await saveCPI_queue_response(
                prodRef,
                segmentNum.toString(),
                wasQueued ? 'queued' : 'failed',
                false,
                wasQueued ? 'IDOC encolado' : 'Falló la creación del IDOC',
                res.data
            );

            console.log("JobID", product_data.push_id, "Segmento 6 enviado a CPI")

            return res_ok;
        } catch (e) {
            console.log("Error enviando JobID", product_data.push_id, "Segmento 6")
            throw e;
        }
    } else {
        console.log('evitando el envío a CPI por la bandera process.env.CPI_SEGMENT_ENV');
        return res_ok;
    }
}