import { db_analytics } from "../firebase";

export interface AnalyticsLog {
  error: boolean
  [key: string]: any
}

/**
 * Helper para loggear errores o success de las APIs
 * @param req_body body del request original
 * @param timestamp_arrival timestamp del inicio del procesamiento de la petición
 * @param api para ubicar el nodo donde se escribirá el log
 * @param obj data que queremos loggear
 */
export const analytics = async (
  req_body: any,
  timestamp_arrival: number,
  api: string,
  obj: AnalyticsLog,
  process: string,
  type: 'blob_trigger' | 'middleware' | 'api' | 'firestore_trigger' | 'job'
) => {
  if (api && api !== "") {
    try {
      const now = new Date().getTime();
      const time = now - timestamp_arrival;

      //? Definir la ubicación donde vamos a loggear
      const dt = new Date().toISOString();
      const day = dt.split("T")[0];
      const dayRef = db_analytics.ref("API_Analytics").child(api).child(day);
      //* console.log('logged item', JSON.stringify(obj))

      const toLog = {
        _Date: dt,
        error: obj.error,
        req: req_body,
        res: obj,
        time_millis: time
      }
      // console.log("dayRef.push", JSON.stringify(toLog));
      const safe_object = cleanObj(api, toLog);

      await dayRef.push(safe_object);

      /**
       * A la vez que se loggeó el item, hacemos un nodo de resumen para aligerar la carga cuando queramos un dashboard
       */
      const summaryRef = db_analytics.ref("API_Analytics_Summary").child(api).child(day);
      await summaryRef.transaction(
        (snap) => {
          if (snap != undefined && snap != null) {
            //Tienda existe, obtener el siguiente ID
            if (obj.error) {
              snap.errorCount++;
            } else {
              snap.successCount++;
            }
            snap.totalTime += time;
          } else {
            //Nodo no existe, iniciarlo
            snap = {
              errorCount: obj.error ? 1 : 0,
              successCount: obj.error ? 0 : 1,
              totalTime: time
            };
          }
          return snap;
        },
        (error, committed, snap) => {
          if (error) {
            console.log("Error en transaccion API_Analytics_Summary", error);
          }
        },
        true
      );

      /**
       * Alimentar a un diccionario de clasificación de la function, para saber si es de Firebase, Pyhton o C#
       */
      await db_analytics.ref("API_Analytics_Classification").child(removeChars(api)).set({
        location: 'firebase_nodejs',
        process, type
      });
    } catch (exception) {
      console.log('Error loggeando analytics', JSON.stringify(exception))
    }
  }
};


/**
 * Limpiar un string de chars no permitidos en keys de firebase realtime DB
 * @param s string a limpiar para que sea compatible como key para firebase
 * @returns string 'seguro' para usar en firebase
 */
const removeChars = (s: string) => {
  return s.replace(/[\/#.$\[\]]/gi, "_")
}

/**
* Limpiar un objeto recursivamente para poderlo escribir en firebase realtime DB
* @param obj objeto a limpiar
* @returns objeto limpio
*/
const cleanObj = (api: string, obj: any) => {
  let newObj: any = {};
  for (let k in obj) {
    if (k !== "") {
      if (
        typeof obj[k] == "string" ||
        typeof obj[k] == "boolean" ||
        typeof obj[k] == "number"
      ) {
        //Limpiar la key de chars inválidos, pasar el valor directo
        newObj[removeChars(k)] = obj[k]
      } else if (obj[k] === undefined) {
        //El valor era undefined
        newObj[removeChars(k)] = 'undefined'
      } else {
        //Limpiar la key de chars inválidos, llamada recursiva para limpiar el valor
        newObj[removeChars(k)] = cleanObj(api, obj[k])
      }
    } else {
      console.log(api, 'analytics obj has empty key', JSON.stringify(obj));
    }
  }

  return newObj;
}