import * as functions from "firebase-functions";
import {
  CallbackFunction,
  VerifyIntegrationRequest,
} from "../../../z_helpers/IntegrationsWrapper";
import { CloudRes } from "../../../interfaces/CloudRes";
import * as schema from "./ContractACK_schema.json";
import axios from "axios";
import { getTokenCpiMateriales } from "../../../AltaMateriales/z_sendSegment/helpers/cpi_hepers";
import { firestore, storage } from "../../../firebase";
import _ = require("lodash");

/**
 * Contract ACK
 *
 * Se modifica el estatus a recibido
 */
export const contractACK = functions.https.onCall(async (data, context) => {
  const result = await VerifyIntegrationRequest(
    data,
    context,
    "Integraciones-Suppliers-contractACK",
    ["service", "tester", "proveedor"],
    schema,
    doWork,
    "Compras"
  );
  return result;
});

/**
 * Lógica core para registrar el acknowledgement de un contrato
 * @param body Body del request original
 * @param name Nombre de la función para los logs
 * @return CloudRes estándar
 */
const doWork: CallbackFunction = async (
  body: Contract_ACK_Body
): Promise<CloudRes> => {
  try {
    /**
     * EMPIEZA LOGICA PARA
     * ACTUALIZAR CONTRACT CON STATUS CONFIRMADO
     */
    const { data } = body;
    const { contract_id, confirmaContrato, proveedor, numeroDocumento } = data;
    const cpi_body = confirmaContrato;

    await firestore
      .doc(`contracts/${contract_id}`)
      .update({ status: "Aceptado" });

    /**
     * EMPIEZA LOGICA PARA
     * ACTUALIZAR DETALLES DEL CONTRATO PARA AGREGAR LA CANTIDAD QUE EL PROVEEDOR ENVIA EN EL ACK
     */

    /**
     * Primero sacar el detalle del json de storage
     */

    const details_route = `contracts/${proveedor}/detalles_contrato_${numeroDocumento}.json`;

    let detalles = await readJsonFile(details_route);
    let { E1EDP01 } = detalles;
    if (E1EDP01) {
      /**
       * Por cada detalle, agregar en el correspondiente la cantidad aceptada por el proveedor
       * Encuentra el producto de los datos del ack
       */
      const { detail } = cpi_body[0];
      let nDetail: any[] = [];
      detail.forEach((e: any) => {
        if (e?.numeroEan) {
          const idx = E1EDP01.findIndex((v: any) => {
            const detail_e_nm = v.eanUpc.padStart(14, "0");
            const detail_nm = e.numeroEan.padStart(14, "0");
            return detail_nm === detail_e_nm;
          });
          //Se encontró el detalle en el ack
          if (idx !== -1) {
            E1EDP01[idx].status = "Aceptado";
            E1EDP01[idx].fechaAceptadaProveedor = e.fechaConfirmaPosicion;
            E1EDP01[idx].cantidadAceptadaProveedor = e.cantidadConfirmada;
            console.log(`Encontrado en índice ${idx}`, E1EDP01[idx]);
            if (e.cantidadConfirmada > E1EDP01[idx].cantidad) {
              nDetail.push({ ...e, cantidadConfirmada: E1EDP01[idx].cantidad });
            } else {
              nDetail.push({ ...e });
            }
          }
        }
      });
      cpi_body[0].detail = nDetail;
    }

    detalles.E1EDP01 = _.cloneDeep(E1EDP01);

    /**
     * Se ha actualizado el json de detalles
     * Ahora guardarlo de nuevo en storage
     */

    const buffer = Buffer.from(JSON.stringify(detalles));

    await storage.bucket().file(details_route).save(buffer, {
      contentType: "application/json",
    });

    /**
     * EMPIEZA LOGICA PARA INTEGRACION CON
     * ENDPOINT DE CPI
     */
    const url = process.env.CONFIRMACONTRATO_CPI_R74 ?? "";
    const token = await getTokenCpiMateriales();

    console.log("cpi_body", JSON.stringify(cpi_body));

    const res = await axios.post(
      url,
      { confirmaContrato: cpi_body },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log("CPI response R74", JSON.stringify(res.data));

    const { message } = res.data;
    if (message.returnType === "E") {
      //Hay errores
      console.log("CPI reporta error", message.returnMessage);
      //TODO: Qué hacemos con los errores?
      throw `CPI reporta error: ${message.returnMessage}`;
    } else {
      //No se reportan errores
      console.log("CPI reporta success");
    }

    //#endregion Envío a CPI

    return {
      error: false,
      msg: "ACK recibido y actualizado",
      data: null,
    };
  } catch (error) {
    console.error("Error al recibir ACK:", error);
    throw {
      error: true,
      msg: "Error interno del servidor",
      data: JSON.stringify(error),
    };
  }
};

/**
 * Helper para leer el archivo json de detalle de un contract
 * @param details_route ruta del archivo en storage
 * @returns json de detalle
 */
export const readJsonFile = async (details_route: string) => {
  try {
    const now = new Date();
    now.setDate(now.getDate() + 1);
    const detalles_url_resp = await storage
      .bucket()
      .file(details_route)
      .getSignedUrl({ action: "read", expires: now });
    const detalles_url = detalles_url_resp[0];
    const response = await fetch(detalles_url);
    const data = await response.json();
    return data;
  } catch (e) {
    return {};
  }
};

interface Contract_ACK_Body {
  data: {
    contract_id: string;
    proveedor: string;
    numeroDocumento: string;
    confirmaContrato: [Contract_ACKRequest_Contrato];
  };
}

interface Contract_ACKRequest_Contrato {
  detail: Contract_ACK_Detail[];
  orderCompra: string;
  ordenVenta: string;
  fechaConfirmacion: string;
  fechaMensaje: string;
}

interface Contract_ACK_Detail {
  numeroEan: string;
  numeroMaterial: string;
  cantidadConfirmada: string;
  fechaConfirmaPosicion: string;
}
