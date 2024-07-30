import * as functions from "firebase-functions";

import {
  VerifyIntegrationRequest,
  CallbackFunction,
} from "../../../../z_helpers/IntegrationsWrapper";
import { CloudRes } from "../../../../interfaces/CloudRes";

import * as schema from "./OrderbookCreateConfirm_schema.json";
import { User } from "../../../../interfaces/user";
import axios from "axios";
import { firestore, storage } from "../../../../firebase";
import { readJsonFile } from "../../ContractACK";
import _ = require("lodash");
import { getTokenCpiMateriales } from "../../../../AltaMateriales/z_sendSegment/helpers/cpi_hepers";

export const orderbookCreateConfirm = functions
  .runWith({
    timeoutSeconds: 540,
    memory: "4GB",
  })
  .https.onCall(async (data, context) => {
    const result = await VerifyIntegrationRequest(
      data,
      context,
      "Integraciones-Suppliers-orderbookCreateConfirm",
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
    const { numeroDocumento, proveedor } = body;

    /**
     * EMPIEZA LOGICA PARA LLAMADA A CPI
     */

    console.log("body", JSON.stringify(body));
    console.log("llamando a CPI");

    /**
     * Sacar contract_id de payload
     */

    const contractId = body.data.orderBook[0].contractId;

    /**
     * PARSEAR PAYLOAD
     * Si se envia un upc que no estaba en el contrato, no enviar a cpi
     * Si se envia un upc con cantidades mayores a la del contrato, enviar la cantidad del contrato
     */

    const body_original = _.cloneDeep(body.data);
    let body_parsed = _.cloneDeep(body_original);
    console.log("body original", JSON.stringify(body_original));

    /**
     * Leer json detail de storage del contrato
     */

    const details_route = `contracts/${proveedor}/detalles_contrato_${numeroDocumento}.json`;
    let contract = await readJsonFile(details_route);
    let { E1EDP01 } = contract;

    const details_orderbook = _.cloneDeep(
      body_parsed.orderBook[0].detail
    ) as any[];

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
    body_parsed.orderBook[0].detail = details_orderbook_parsed;

    console.log("Se manda a CPI");
    console.log(JSON.stringify(body_parsed));

    const token = await getTokenCpiMateriales();
    console.log("token para bearer de cpi", token);

    const response_cpi = await axios.post(
      process.env.SAP_ORDERBOOK_REQUEST_URL_USER_R44 ?? "",
      { ...body_parsed },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (
      response_cpi.data?.message &&
      response_cpi.data?.message[0] &&
      response_cpi.data?.message[0].returnType === "S"
    ) {
      console.log("OrderBook enviado a CPI correctamente");
      console.log(JSON.stringify(response_cpi.data));

      console.log("Guardando en firestore y storage");

      /**
       * INICIA LOGICA PARA GUARDAR EN FIRESTORE Y STORAGE
       */

      const orderbook_ref_fs = firestore.collection("orderbooks").doc();

      let cabeceras = _.cloneDeep(body_original.orderBook[0]);

      await orderbook_ref_fs.set({
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
        contract_id: cabeceras.contractId,
        orderbook_detail_id: contract.numeroDocumento,
        orderbookID: orderbook_ref_fs.id,
      });

      console.log("cabeceras guardadas en firestore");

      /**
       * Guardar en storage los details como array
       */

      const buffer = Buffer.from(JSON.stringify(details_orderbook));

      const orderbook_details_route = `orderbooks/${contractId}/details_orderbook_${contract.numeroDocumento}.json`;

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
        .doc(`contracts/${contractId}`)
        .update({ status: "Confirmado" });

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
              return v.eanUpc.padStart(14, "0") === e.eanUpc.padStart(14, "0");
            });
            //Se encontró el detalle en el ack
            if (idx !== -1) {
              E1EDP01[idx].cantidadConfirmadaProveedor = e.cantidadConfirmada;
              E1EDP01[idx].fechaConfirmadaProveedor = e.fechaEsperadaCedis;
              E1EDP01[idx].status = "Confirmado";
            }
          }
        });
      }

      contract.E1EDP01 = _.cloneDeep(E1EDP01);
      contract.status = "Confirmado";

      /**
       * Se ha actualizado el json de detalles
       * Ahora guardarlo de nuevo en storage
       */

      const buffer_contract = Buffer.from(JSON.stringify(contract));

      console.log("guardando archivo de contract");
      console.log(JSON.stringify(contract));

      await storage.bucket().file(details_route).save(buffer_contract, {
        contentType: "application/json",
      });

      console.log("Terminó proceso de orderbook");

      return {
        error: false,
        msg: "Orderbook creado correctamente",
        data: response_cpi.data,
      };
    } else {
      return {
        error: true,
        msg: "Error al crear orderbook",
        data: response_cpi.data,
      };
    }
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
