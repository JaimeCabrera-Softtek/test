import { db_materiales } from "../../firebase";
import { CloudRes } from "../../interfaces/CloudRes";
import { Job } from "./interfaces";

/**
 * Inicializar el nodo en RealtimeDB para tracking de status de los segmentos de los materiales
 * @param catalogo id del catalogo
 * @param materialDict diccionario de materiales, para inicializar su registro de status
 * @return CloudRes
 */
export const inicializarFirebase = async (materiales: Job[]): Promise<CloudRes> => {
  try {
    //#region Registrar los jobs nuevos
    const ref = db_materiales.ref('AltaMateriales');
    const promises = materiales.map(async (x) => {
      const newRef = await ref.push();
      const pushID = newRef.key;
      await newRef.set({ ...x, push_id: pushID })
      return newRef;
      // ref.push(x)
    })
    //!Sujetos al límite de conexiones simultáneas y de MB/s de Firebase
    const references = await Promise.all(promises);
    //#endregion Registrar los jobs nuevos

    const resData: { [pushID: string]: Job } = {};

    for (let i = 0; i < references.length; i++) {
      resData[references[i].key!] = {
        ...materiales[i],
        push_id: references[i].key!
      };
    }
    return {
      error: false,
      msg: "OK",
      data: resData,
    };
  } catch (err) {
    throw new Error(`Hubo un error en inicializar firebase: ${(err as Error).message}`, {
      cause: (err as Error).cause,
    });
  }
};
