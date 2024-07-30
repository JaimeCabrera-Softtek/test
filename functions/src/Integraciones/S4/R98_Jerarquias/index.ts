import * as functions from "firebase-functions";
import * as _ from 'lodash';

import {
  CallbackFunction,
  VerifyIntegrationRequest,
} from "../../../z_helpers/IntegrationsWrapper";
import { db, db_materiales } from "../../../firebase";
import { HELPER_CATALOGS, JERARQUIAS_EXISTENTES, JERARQUIAS_SOLICITADAS } from "../../../z_helpers/constants";

import * as schema from './r98_jerarquias_schema.json';
import { R98Extraction, R98Node, R98Request, R98RequestItem } from "./interfaces";
import { Jerarquia_Solicitada } from "../../../interfaces/CargaCatalogo";
import { saveFirebaseBrands } from "./saveBrands";

export const R98_replicaJerarquias = functions
  .runWith({
    timeoutSeconds: 180,
    memory: "4GB",
  })
  .https.onCall(async (data, context) => {
    const res = await VerifyIntegrationRequest(
      data,
      context,
      "Integraciones-S4-R98_replicaJerarquias",
      ["service"],
      schema,
      doWork,
      "Replicas"
    );

    return res;
  });

function removeAccentsAndSpecialChars(input: string): string {
  //Remover los acentos
  const accentsMap: any = {
    Á: "A",
    É: "E",
    Í: "I",
    Ó: "O",
    Ú: "U",
    Ü: "U",
    á: "a",
    é: "e",
    í: "i",
    ó: "o",
    ú: "u",
    ü: "u",
    à: "a",
    è: "e",
    ì: "i",
    ò: "o",
    ù: "u",
    ñ: "n",
    Ñ: "N",
    // Añadir más mapeos si es necesario
  };
  let result = input
    .split("")
    .map((char) => accentsMap[char] || char)
    .join("");

  //Remover caracteres especiales
  result = result.replace(/[^a-zA-Z0-9 ]/g, "");

  return result;
}

/**
 * 
 * @param data Información de la R98
 */
const getInfoFromJerarquias = async (data: { [store: string]: R98RequestItem }) => {
  /**
   * Extraer la información que necesitamos de la R98 para actualizar otros HelperCatalogs
   * @param node Elemento de jerarquía recibido de la R98
   * @returns información que nos sirve para actualizar firebase
   */
  const nodeInfo = (node: R98Node): R98Extraction => {
    const nivelDict: { [key: string]: 'Deportes' | 'Marcas' | 'Familia' | 'Silueta' } = {
      "04": "Deportes",
      "05": "Marcas",
      "06": "Familia",
      "07": "Silueta",
    }
    const sapKey = node.nodo.replace(node.nodoPadre, '');
    const desc = node.descripcion;

    return {
      catName: nivelDict[node.nivelNodo],
      ibn_value: desc,
      sap_value: sapKey,
      parent: node.nodoPadre
    }
  }


  for (let storeKey in data) {
    //@ts-ignore
    let store = data[storeKey]; // Access each store object like 'Innovasport'
    console.log(`Iterating through store: ${storeKey}`);

    /**
     * Multi-path set de firebase
    */
    let updates: any = {};

    const jerarquias_solicitadas = ((await db.ref(JERARQUIAS_SOLICITADAS).once('value')).val() ?? {}) as {[key: string]: Jerarquia_Solicitada}
    const jerarquias_issues = _.groupBy(Object.values(jerarquias_solicitadas), 'Jerarquia_Solicitada')
    let jerarquias_resueltas: any = {}

    if (store.E1WAH02 && Array.isArray(store.E1WAH02)) {
      console.log(`Iterating E1WAH02 array in ${storeKey}:`);
      const marcas: { [name: string]: string } = {};
      const nodes: R98Node[] = store.E1WAH02;
      for (let nodo of nodes) {
        const info = nodeInfo(nodo);
        //Ignorar niveles de jerarquía que no tenemos en nivelDict
        if (info.catName !== undefined) {
          const key = info.catName;
          const cleanValue = removeAccentsAndSpecialChars(info.ibn_value)

          if(!updates[key]){
            updates[key] = {}
          }

          updates[key][cleanValue] = info.sap_value;

          if (key === "Marcas") {
            marcas[info.ibn_value] = info.sap_value;
          }

          if (key === 'Silueta') {
            //Poblar HelperCatalog de FamiliaAutomatica
            const famCode = info.parent.slice(-2)

            if (!updates["Familia_Automatica"]) {
              updates["Familia_Automatica"] = {};
            }

            updates["Familia_Automatica"][cleanValue] = famCode

             if (!updates[JERARQUIAS_EXISTENTES]) {
               updates[JERARQUIAS_EXISTENTES] = {};
             }
             
            updates[JERARQUIAS_EXISTENTES][nodo.nodo] = true;

            //#region Solucionar lo de las JerarquiasSolicitadas
            if (jerarquias_issues[nodo.nodo] !== undefined) {
              //?Hay que resolver issues
              for(let upc_issue_jerarquia of jerarquias_issues[nodo.nodo]){
                jerarquias_resueltas[upc_issue_jerarquia.UPC] = null
              }
            }
            //#endregion Solucionar lo de las JerarquiasSolicitadas
          }
        }
      }

      // await db_materiales.ref(HELPER_CATALOGS).update(updates);
      await db_materiales.ref(HELPER_CATALOGS).child("Deportes").set(updates["Deportes"]);
      await db_materiales.ref(HELPER_CATALOGS).child("Marcas").set(updates["Marcas"]);
      await db_materiales.ref(HELPER_CATALOGS).child("Familia").set(updates["Familia"]);
      await db_materiales.ref(HELPER_CATALOGS).child("Silueta").set(updates["Silueta"]);
      await db_materiales.ref(HELPER_CATALOGS).child("Familia_Automatica").set(updates["Familia_Automatica"]);
      await db_materiales.ref(HELPER_CATALOGS).child(JERARQUIAS_EXISTENTES).set(updates[JERARQUIAS_EXISTENTES]);

      await db.ref(JERARQUIAS_SOLICITADAS).update(jerarquias_resueltas);
      await saveFirebaseBrands(marcas);
    }
  }
}

const doWork: CallbackFunction = async (
  body: any,
  context: functions.https.CallableContext
): Promise<any> => {
  try {

    const bases = (body as R98Request).Jerarquias;

    let data: { [store: string]: R98RequestItem } = {};
    for (let b of bases) {
      data[b.texto] = b;
    }
    await db_materiales.ref(HELPER_CATALOGS).child("R98_Jerarquias").set(data);

    //Get info from Jerarquias
    await getInfoFromJerarquias(data);

    return {
      error: false,
      message: [
        {
          returnType: "S",
          returnId: "IBN",
          returnNumber: "200",
          returnMessage: "Mensaje procesado correctamente",
        },
      ],
    };
  } catch (err) {
    console.log((err as Error).message);
    return {
      error: true,
      message: [
        {
          returnType: "E",
          returnId: "IBN",
          returnNumber: "500",
          returnMessage: (err as Error).message,
        },
      ],
    };
  }
};
