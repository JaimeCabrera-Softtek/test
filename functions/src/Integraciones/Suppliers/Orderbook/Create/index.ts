import * as functions from "firebase-functions";

import {
  VerifyIntegrationRequest,
  CallbackFunction,
} from "../../../../z_helpers/IntegrationsWrapper";
import { CloudRes } from "../../../../interfaces/CloudRes";

import * as schema from "./OrderbookCreate_schema.json";
import { User } from "../../../../interfaces/user";
import axios from "axios";
import { firestore, storage } from "../../../../firebase";
import { readJsonFile } from "../../ContractACK";
import _ = require("lodash");

export const orderbookCreate = functions
  .runWith({
    timeoutSeconds: 540,
    memory: "4GB",
  })
  .https.onCall(async (data, context) => {
    const result = await VerifyIntegrationRequest(
      data,
      context,
      "Integraciones-Suppliers-orderbookCreate",
      ["service", "tester", "proveedor", "compras"],
      schema,
      doWork,
      "Compras"
    );
    return result;
  });

const doWork: CallbackFunction = async (
  body: any,
  context: functions.https.CallableContext,
  user?: User
): Promise<CloudRes> => {
  try {
    /**
     * Primero sacar el x-ibn-token
     */
    const x_ibn_token_axios_resp = await axios.get(
      process.env.GET_TOKEN_TEXT_URL ?? "",
      {
        params: {
          code: "",
        },
        headers: {
          user_id: user?.uid,
        },
      }
    );
    const { confirmatedMateriales, orderbookID, numeroDocumento, proveedor } =
      body;
    const data = x_ibn_token_axios_resp.data as TokenTextResponse;
    const { token } = data;

    /**
     * Una vez teniendo el token, llamar a azure function que hace llamada
     * a cpi y guarda collection
     */
    const response_cpi = await axios.post(
      process.env.CPI_SEND_ORDERBOOK ?? "",
      { ...body.data },
      {
        headers: {
          "x-ibn-token": token,
        },
      }
    );
    const response = response_cpi.data;
    if (response.error) {
      return {
        error: true,
        msg: "Error al crear orderbook",
        data: null,
      };
    } else {
      if (confirmatedMateriales && orderbookID) {
        /**
         * Guardar en firestore los  eanUpc que han sido confirmados
         */
        const refOB = firestore.doc(`orderbooks/${orderbookID}`);
        await refOB.update({ confirmatedMateriales, status: "Confirmado" });

        const obDocument = (await refOB.get()).data();
        const contractId = obDocument ? obDocument.contract_id : "";

        //Se guarda de una vez el status del contract a confirmado
        if (contractId) {
          await firestore
            .doc(`contracts/${contractId}`)
            .update({ status: "Confirmado" });

          console.log("Se ha guardado status de Confirmado en ", contractId);
        }
      } else {
        /**
         * Cuando se esta subiendo nuevo orderbook, delete la propiedad de confirmatedMateriales o dejarla en array vacio
         */
        await firestore
          .doc(`orderbooks/${response.msg}`)
          .update({ confirmatedMateriales: [], orderbookID: response.msg });

        /**
         * INICIA LOGICA PARA
         * AGREGAR AL CONTRATO POR CADA DETALLE LA CANTIDAD CONFIRMADA POR EL PROVEEDOR
         */

        /**
         * Recuperar el json de detalle
         */

        if (proveedor && numeroDocumento) {
          const details_route = `contracts/${proveedor}/detalles_contrato_${numeroDocumento}.json`;
          let detalles = await readJsonFile(details_route);
          let { E1EDP01 } = detalles;
          /**
           * Por cada detalle, agregar en el correspondiente la cantidad aceptada por el proveedor
           * Encuentra el producto de los datos del ack
           */
          if (E1EDP01) {
            const dataOB = body.data;
            const { orderBook } = dataOB;
            const oBD = orderBook[0];
            const { detail } = oBD;
            detail.forEach((e: any) => {
              if (e?.eanUpc) {
                const idx = E1EDP01.findIndex((v: any) => {
                  return (
                    v.eanUpc.padStart(14, "0") === e.eanUpc.padStart(14, "0")
                  );
                });
                //Se encontró el detalle en el ack
                if (idx !== -1) {
                  E1EDP01[idx].cantidadConfirmadaProveedor =
                    e.cantidadConfirmada;
                }
              }
            });
          }

          detalles.E1EDP01 = _.cloneDeep(E1EDP01);
          /**
           * Se ha actualizado el json de detalles
           * Ahora guardarlo de nuevo en storage
           */
          detalles.status = "Confirmado";
          const buffer = Buffer.from(JSON.stringify(detalles));
          console.log("guardando archivo");
          console.log(detalles);
          await storage.bucket().file(details_route).save(buffer, {
            contentType: "application/json",
          });
        }
      }
      return {
        error: false,
        msg: "Orderbook creado correctamente",
        data: {},
      };
    }
  } catch (error) {
    console.error("Error al guardar en Firestore o Storage:", error);
    return {
      error: true,
      msg: "Error al crear orderbook",
      data: error,
    };
  }
};

interface TokenTextResponse {
  token: string;
}
