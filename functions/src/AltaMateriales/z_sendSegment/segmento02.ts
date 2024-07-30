import axios from "axios";
import { Reference } from "firebase-admin/database";

import { CloudRes, res_ok } from "../../interfaces/CloudRes";
import { AltaMaterial_ProductInit } from "../01_batch_creation/interfaces";
import { cpiQueued, getTokenCpiMateriales } from "./helpers/cpi_hepers";
import { saveCPI_queue_response } from "./helpers/fb_materiales_helpers";
import { body02 } from "./helpers/segment_body_helpers/2";

/**
 * Enviar el segmento 2 a SAP
 * @param prodRef Referencia al nodo del producto en /AltaMateriales
 */
export const segmento02 = async (prodRef: Reference): Promise<CloudRes> => {
    const product_data = (await prodRef.once('value')).val() as AltaMaterial_ProductInit;
    const token = await getTokenCpiMateriales();
    console.log('token', token);
    const segmentNum = 2;

    const _temp = await body02(product_data, 'create');

    if (process.env.CPI_SEGMENT_ENV === 'PROD') {
        console.log("Enviando a CPI JobID", product_data.push_id, "Segmento 2");

        //#region envío
        try {
            const url: string = process.env.ALTAMATERIALES_CPI_R56_SEGMENT02 ?? '';
            // console.log('CPI Segment 02', 'req.url', url);

            const res = await axios.post(
                url,
                _temp,
                {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                }
            )

            console.log('CPI Segment 02', 'req.body', JSON.stringify(_temp));
            console.log('CPI Segment 02', 'res.data', JSON.stringify(res.data));


            //! *** EL SEGMENTO 2 ES DIFERENTE PORQUE NO ENCOLA IDOCS
            //A partir de res.data saber si fue encolado
            const wasQueued = cpiQueued(res.data);

            await saveCPI_queue_response(
                prodRef,
                segmentNum.toString(),
                wasQueued ? 'success' : 'failed',
                wasQueued,
                wasQueued ? 'Respuesta no indica errores' : 'Respuesta indica errores',
                res.data
            );

            //escribir el status como si CPI lo hubiera mandado por segment_status
            const ref_status2 = prodRef
                .child('status')
                .child(segmentNum.toString())
                .child('cpi')
                .child('status_report')
                .child('0');
            await ref_status2.set({
                articulo: product_data.consecutivo.toString(),
                codigoInterno: prodRef.key,
                messageJerarquias: res.data.message
            });

            console.log("JobID", product_data.push_id, "Segmento 2 enviado a CPI")

            return res_ok;
        } catch (e) {
            console.log("Error enviando JobID", product_data.push_id, "Segmento 2")
            throw e;
        }
    } else {
        console.log('evitando el envío a CPI por la bandera process.env.CPI_SEGMENT_ENV');
        return res_ok;
    }
}