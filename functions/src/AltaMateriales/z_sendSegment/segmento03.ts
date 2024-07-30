import axios from "axios";
import { Reference } from "firebase-admin/database";

import { CloudRes, res_ok } from "../../interfaces/CloudRes";
import { saveCPI_queue_response } from "./helpers/fb_materiales_helpers";
import { cpiQueued, getTokenCpiMateriales } from "./helpers/cpi_hepers";
import { AltaMaterial_ProductInit } from "../01_batch_creation/interfaces";
import { body03 } from "./helpers/segment_body_helpers/3";

/**
 * Enviar el segmento 3 a SAP
 * @param prodRef Referencia al nodo del producto en /AltaMateriales
 */
export const segmento03 = async (prodRef: Reference): Promise<CloudRes> => {
    const product_data = (await prodRef.once('value')).val() as AltaMaterial_ProductInit;
    const token = await getTokenCpiMateriales();
    console.log('token', token);
    const segmentNum = 3;

    const _temp = await body03(product_data, 'create');

    if (process.env.CPI_SEGMENT_ENV === 'PROD') {
        console.log("Enviando a CPI JobID", product_data.push_id, "Segmento 3");

        //#region envío
        try {
            const url: string = process.env.ALTAMATERIALES_CPI_R53_SEGMENT03 ?? '';
            // console.log('CPI Segment 03', 'req.url', url);

            const res = await axios.post(
                url,
                _temp,
                {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                }
            )

            console.log('CPI Segment 03', 'req.body', JSON.stringify(_temp));
            console.log('CPI Segment 03', 'res.data', JSON.stringify(res.data));

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

            console.log("JobID", product_data.push_id, "Segmento 3 enviado a CPI")

            return res_ok;
        } catch (e) {
            console.log("Error enviando JobID", product_data.push_id, "Segmento 3")
            throw e;
        }
    } else {
        console.log('evitando el envío a CPI por la bandera process.env.CPI_SEGMENT_ENV');
        return res_ok;
    }
}