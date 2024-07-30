import * as functions from "firebase-functions";

// import { validateRequest } from '../../z_helpers/requestValidator'
import { desdoblarParaFirebase } from './desdoblar';
import { inicializarFirebase } from './inicializarFirebase';
import { CallbackFunction, VerifyIntegrationRequest } from '../../z_helpers/IntegrationsWrapper';
import { CloudRes } from '../../interfaces/CloudRes';
import {
  AltaMaterial_ProductInit,
  AltaMaterial_Request,
  // AltaMaterial_ProductInit,
  // AltaMaterial_Request_Item
} from './interfaces';
import { User } from "../../interfaces/user";
import { db_materiales } from "../../firebase";
import { MATERIALES_BATCH_STATUS } from "../../z_helpers/constants";
import { BatchMaterialStatus, BatchMaterialStatus_Job } from "../../SeleccionMateriales/StatusTrigger/interfaces";

/**
 * Función que puede llamar un comprador desde la app del iPad para mandar dar de alta los materiales seleccionados
 *
 * Body preliminar
    {
      "batch_id": "el_docID_del_doc_seleccionMateriales",
      "items": [
          {
              "Estilo": "ESFM1500",
              "Marca": "Puma",
              "Proveedor": "3ZRs4E9Lktb3KXBaxxnn8FLBRMZ2",
              "MarcaId": "0DcW7t91VSFApKDXgtKT",
              "Catalogo": "AyASPDH3R3l3XTnsGC4K",
              "MarcaSAP": "079",
              "Temporada": "Q1",
              "Ano": "2024",
              "Genero": "MUJERES",
              "Descripcion_larga": "ESS 4 SWEAT SHORTS TR",
              "Descripcion_corta": "ESS 4 SWEAT SHO",
              "Deporte": "CASUAL",
              "Color": "GRIS",
              "Division": "TEXTIL",
              "Familia": "SHORT",
              "Precio_venta": "649.0",
              "Precio_compra": "257.38",
              "Moneda_venta": "MXN",
              "Moneda_costo": "MXN",
              "Unidades": [
                  "INVICTUS"
              ],
              "variantes": {
                  "4099686368494": {
                      "tallaProveedor": "23.5",
                      "upc": "4099686368494"
                  },
                  "4099686368470": {
                      "tallaProveedor": "22.5",
                      "upc": "4099686368470"
                  }
              }
          }
      ]
    }
 */
export const batch_creation = functions.runWith({ memory: "8GB", timeoutSeconds: 540 }).https.onCall(async (data, context) => {
  const result = await VerifyIntegrationRequest(
    data, context,
    'AltaMateriales-01_batch_creation',
    [
      'service',
      'tester',
      'compras',
      'mdm'
    ],
    undefined,
    doWork,
    'AltaMateriales'
    // ,
    // {
    //   proveedor: (data.items[0] as AltaMaterial_Request_Item).Proveedor,
    //   marca_id: (data.items[0] as AltaMaterial_Request_Item).MarcaId,
    //   marca_name: (data.items[0] as AltaMaterial_Request_Item).Marca,
    //   items: data.items.length
    // }
  );
  return result;
})

const doWork: CallbackFunction = async (
  body: AltaMaterial_Request,
  context: functions.https.CallableContext,
  user?: User
): Promise<CloudRes> => {
  /**
   * Objeto que vamos a dar de response
   */
  let res: CloudRes = {
    error: false,
    msg: '',
    data: null
  }

  if (user) {
    /**
     * Aquí separamos el batch en N jobs para su rastreo de estatus individual
     */
    const materiales_firebase = await desdoblarParaFirebase(body.items, user.uid, body.type, body.batch_id);
    res = await inicializarFirebase(materiales_firebase);
    if (!res.error) {
      if (body.batch_id !== undefined) {
        /**
         * Aquí tenemos un array de jobs
         */
        const jobs = res.data as AltaMaterial_ProductInit[];
        /**
         * Esta es la estructura resumen del batch
         */
        let _batch: { [jobID: string]: BatchMaterialStatus_Job } = {}
        /**
         * Construimos el batch con la info mínima
         */
        Object.values(jobs).forEach(j => {
          _batch[j.push_id!] = {
            Estilo: j.art.Estilo,
            status: 'pending'
          }
        })
        /**
         * Escribimos una estructura reducida para el status resumido del batch
         */
        const status: BatchMaterialStatus = {
          user: {
            uid: user.uid,
            name: user.display_name,
            email: user.email
          },
          date: new Date().getTime(),
          lastUpdate: new Date().getTime(),
          jobs: _batch,
          status:{
            pending: Object.keys(_batch).length,
            queued: 0,
            processing: 0,
            success: 0,
            failed: 0,
        }
        }
        await db_materiales
          .ref(MATERIALES_BATCH_STATUS)
          .child(user.uid)
          .child(body.batch_id)
          .set(status as any);

      }
      res = {
        error: false,
        msg: 'Se enviarán los materiales a S4.',
        data: null
      }
    }
  } else {
    res = {
      error: true,
      msg: 'Permiso denegado.',
      data: null
    }
  }

  return res;
};
