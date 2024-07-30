import { Reference } from "firebase-admin/database"
import { AltaMaterial_Status_Segment } from "../../01_batch_creation/interfaces";
import { db_materiales } from "../../../firebase";

/**
 * Guarda la información que respondió CPI cuando le enviamos el segmento
 * @param prodRef Referencia al nodo del job
 * @param segmentNum Número de segmento
 * @param status Cómo vamos a dejar el valor de status después de actualizar
 * @param success Cómo vamos a dejar el valor de success después de actualizar
 * @param msg Qué mensaje le vamos a poner
 * @param data la respuesta que nos dio CPI
 * @returns Promise
 */
export const saveCPI_queue_response = async (
    prodRef: Reference,
    segmentNum: string,
    status: 'pending' | 'queued' | 'processing' | 'success' | 'failed',
    success: boolean,
    msg: string,
    data: any
) => {
    /**
     * tiene la estructura de la interfaz AltaMaterial_Status_Segment
     * */
    const nodo = prodRef.child('status').child(segmentNum);
    const newVal: AltaMaterial_Status_Segment ={
        date: new Date().toISOString(),
        status,
        success,
        msg,
        cpi: {
            queue_resp: {
                raw: data
            }
        }
    }
    return nodo.set(newVal)
}

export async function getFeatureFlagMateriales(name: string): Promise<boolean> {
    const query = await db_materiales.ref('FeatureFlagsMateriales').child(name).once('value');
    return query.val();
}