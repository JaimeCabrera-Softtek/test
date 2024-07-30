import * as functions from "firebase-functions";

import {
  VerifyIntegrationRequest,
  CallbackFunction,
} from "../../../../z_helpers/IntegrationsWrapper";
import { CloudRes } from "../../../../interfaces/CloudRes";

import * as schema from "./OrderbookCreateConfirmMasivo_schema.json";
import { User } from "../../../../interfaces/user";
import axios from "axios";
import { firestore, storage } from "../../../../firebase";
import { readJsonFile } from "../../ContractACK";
import _ = require("lodash");
import { getTokenCpiMateriales } from "../../../../AltaMateriales/z_sendSegment/helpers/cpi_hepers";

/**
 * Se encarga de crear el orderbook y enviarlo a cpi masivamente
 */
export const orderbookCreateConfirmMasivo = functions
  .runWith({
    timeoutSeconds: 540,
    memory: "4GB",
  })
  .https.onCall(async (data, context) => {
    const result = await VerifyIntegrationRequest(
      data,
      context,
      "Integraciones-Suppliers-orderbookCreateConfirmMasivo",
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
     * EMPIEZA LOGICA PARA LLAMADA A CPI
     */

    console.log("body", JSON.stringify(body));
    console.log("llamando a CPI");

    const body_original = _.cloneDeep(body) as any;
    let body_parsed: any = {
      orderBook: [],
    };
    console.log("body original", JSON.stringify(body_original));

    /**
     * Objeto que guarda las respuestas de cpi en base al numero documento del contrato
     */
    let resultMessages: any = {};

    /**
     * Objeto para guardar documentos de contratos para obtener distintos datos
     */
    let contractsFirestore: any = {};

    console.log("recorriendo array de objetos");

    const contractsRef = firestore.collection("contracts");
    /**
     *
     * Se recorre el array de objetos de payload para parsear cada body
     */
    const orderBook = body_original.orderBook as any[];

    for (let i = 0; i < orderBook.length; i++) {
      const bodyI = orderBook[i];

      console.log("a parsear");
      console.log(JSON.stringify(bodyI));
      /**
       * PARSEAR PAYLOAD
       * Si se envia un upc que no estaba en el contrato, no enviar a cpi
       * Si se envia un upc con cantidades mayores a la del contrato, enviar la cantidad del contrato
       */

      const numeroDocumento = bodyI.ordenCompraInnovasport as string;
      /**
       * En base al numeroDocumento, sacar documento del contract para obtener datos como
       * proveedor etc, y guardarlo en objeto para usos posteriores
       */
      console.log("parseando orderbook de");
      console.log(numeroDocumento);
      const contratoSnap = await contractsRef
        .where("numeroDocumento", "==", numeroDocumento)
        .get();

      console.log("se sacó contrato");

      if (
        contratoSnap &&
        contratoSnap.docs &&
        contratoSnap.docs[0] &&
        contratoSnap.docs[0].exists
      ) {
        const contrato = contratoSnap.docs[0].data();
        console.log(contrato);
        if (contrato && contrato.proveedor === user?.SAP_idProvider) {
          console.log(JSON.stringify(contrato));

          const { proveedor } = contrato;

          const details_route = `contracts/${proveedor}/detalles_contrato_${numeroDocumento}.json`;
          console.log(details_route);
          /**
           * Leer json detail de storage del contrato
           */

          let contract = await readJsonFile(details_route);
          console.log(JSON.stringify(contract));

          let { E1EDP01 } = contract;
          contractsFirestore[numeroDocumento] = { ...contrato, E1EDP01 };

          const details_orderbook = _.cloneDeep(bodyI.detail) as any[];

          let details_orderbook_parsed: any[] = [];
          details_orderbook.forEach((detail_ob) => {
            const { eanUpc } = detail_ob;
            const found_original_contract_item = E1EDP01.find((cI: any) => {
              return cI.eanUpc.padStart(14, "0") === eanUpc.padStart(14, "0");
            });

            //Solo los que esten en el contrato
            if (found_original_contract_item) {
              const { cantidad } = found_original_contract_item;
              //Cuando la cantidad del orderbook sea mayor del contrato, poner la del contrato
              if (parseInt(detail_ob.cantidadConfirmada) > parseInt(cantidad)) {
                details_orderbook_parsed.push({
                  ...detail_ob,
                  cantidadConfirmada: cantidad,
                });
              } else {
                details_orderbook_parsed.push({
                  ...detail_ob,
                });
              }
            }
          });

          console.log("details parsed");
          //Asignar al body que se enviara a cpi con los detail parseados
          body_parsed.orderBook.push({
            ...bodyI,
            detail: details_orderbook_parsed,
          });
        } else {
          console.log(
            "El contrato no pertenece al proveedor que esta haciendo la peticion"
          );
        }
      } else {
        console.log("No se encontró contrato");
      }
    }

    console.log("Se manda a CPI");
    console.log(JSON.stringify(body_parsed));

    const token = await getTokenCpiMateriales();
    console.log("token para bearer de cpi", token);

    /**
     * Se manda a cpi el array completo
     */

    const response_cpi = await axios.post(
      process.env.SAP_ORDERBOOK_REQUEST_URL_USER_R44 ?? "",
      { ...body_parsed },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    /**
     * CPI responde un array de respuestas, van en orden con cada contrato?
     */
    console.log("recorriendo array de mensajes de response de cpi");

    const message: any[] = response_cpi.data.message;
    if (message) {
      for (let i = 0; i < message.length; i++) {
        /**
         * En base al index, se tiene que sacar el numeroDocumento y el contrato
         */
        const numeroDocumento = body_parsed.orderBook[i]
          .ordenCompraInnovasport as string;
        const messageI = message[i];
        if (messageI.returnType === "S") {
          const contrato = contractsFirestore[numeroDocumento];
          console.log(numeroDocumento);
          console.log(
            "OrderBook enviado a CPI correctamente ",
            numeroDocumento
          );
          console.log(JSON.stringify(message));
          console.log("Guardando en firestore y storage");

          /**
           * INICIA LOGICA PARA GUARDAR EN FIRESTORE Y STORAGE
           */

          console.log(body_original.orderBook[i]);
          const orderbook_ref_fs = firestore.collection("orderbooks").doc();
          let cabeceras = _.cloneDeep(body_original.orderBook[i]);

          console.log("cabeceras");
          console.log(JSON.stringify(cabeceras));

          const docCabeceraToSave = {
            banner: cabeceras.banner,
            sold_to_number: cabeceras.soldToNumber,
            sold_to_name: cabeceras.soldToName,
            ship_to_number: cabeceras.shipToNumber,
            ship_to_name: cabeceras.ShipToName,
            tipo_orden: cabeceras.tipoOrden,
            orden_compra_innovasport: cabeceras.ordenCompraInnovasport,
            orden_compra_proveedor: cabeceras.ordenCompraProveedor,
            temporada: cabeceras.temporada,
            marca: cabeceras.marca,
            status: "Confirmado",
            contract_id: contrato.doc_id,
            orderbook_detail_id: numeroDocumento,
            orderbookID: orderbook_ref_fs.id,
          };

          console.log("lo que se guarda en cabeceras");
          console.log(JSON.stringify(docCabeceraToSave));

          await orderbook_ref_fs.set(docCabeceraToSave);

          console.log("cabeceras guardadas en firestore");

          /**
           * Guardar en storage los details como array
           */

          const details_orderbook = body_original.orderBook[i].detail;

          const buffer = Buffer.from(JSON.stringify(details_orderbook));

          const orderbook_details_route = `orderbooks/${contrato.doc_id}/details_orderbook_${numeroDocumento}.json`;

          console.log("orderbook details route");
          console.log(orderbook_details_route);
          console.log(JSON.stringify(details_orderbook));

          await storage
            .bucket()
            .file(orderbook_details_route)
            .save(buffer, {
              contentType: "application/json",
            })
            .then(() => {
              console.log("Detalles de orderbook guardados en storage");
            });

          console.log(
            "Actualizando en contrato las cantidadesConfirmadas y el status"
          );

          /**
           * INICIA LOGICA PARA ACTUALIZAR EL CONTRATO
           * AGREGAR SUS cantidadConfirmadaProveedor Y STATUS
           */
          await firestore
            .doc(`contracts/${contrato.doc_id}`)
            .update({ status: "Confirmado" });

          /**
           * Por cada detalle, agregar en el correspondiente la cantidad aceptada por el proveedor
           * Encuentra el producto de los datos del ack
           */
          const { E1EDP01, proveedor } = contrato;

          let contractToSave = { ...contrato };
          const details_route = `contracts/${proveedor}/detalles_contrato_${numeroDocumento}.json`;

          if (E1EDP01) {
            details_orderbook.forEach((e: any) => {
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
                  E1EDP01[idx].fechaConfirmadaProveedor = e.fechaEsperadaCedis;
                  E1EDP01[idx].status = "Confirmado";
                }
              }
            });
          }

          contractToSave.E1EDP01 = _.cloneDeep(E1EDP01);
          contractToSave.status = "Confirmado";

          /**
           * Se ha actualizado el json de detalles
           * Ahora guardarlo de nuevo en storage
           */

          const buffer_contract = Buffer.from(JSON.stringify(contractToSave));

          console.log("guardando archivo de contract");
          console.log(JSON.stringify(contractToSave));

          await storage.bucket().file(details_route).save(buffer_contract, {
            contentType: "application/json",
          });
          resultMessages[numeroDocumento] = { ...messageI };
        } else {
          resultMessages[numeroDocumento] = { ...messageI };
        }
      }
    }
    return {
      error: false,
      msg: "Proceso de orderbook terminado",
      data: resultMessages,
    };
  } catch (error) {
    console.error("Error");
    console.log(JSON.stringify(error));
    return {
      error: true,
      msg: "Error al crear orderbook",
      data: error,
    };
  }
};
