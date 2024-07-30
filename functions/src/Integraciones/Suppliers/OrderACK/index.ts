import * as functions from "firebase-functions";
import {
  CallbackFunction,
  VerifyIntegrationRequest,
} from "../../../z_helpers/IntegrationsWrapper";
import { CloudRes } from "../../../interfaces/CloudRes";
import * as schema from "./OrderACK_scheme.json";
import axios from "axios";
import { getTokenCpiMateriales } from "../../../AltaMateriales/z_sendSegment/helpers/cpi_hepers";
import { firestore } from "../../../firebase";
import * as _ from "lodash";

/**
 * Lógica core para registrar el acknowledgement de un pedido
 * @param body Body del request original
 * @param name Nombre de la función para los logs
 * @returns CloudRes estándar
 */
export const orderACK = functions.https.onCall(async (data, context) => {
  const result = await VerifyIntegrationRequest(
    data,
    context,
    "Integraciones-Suppliers-orderACK",
    ["service", "tester", "proveedor"],
    schema,
    doWork,
    'Compras'
  );
  return result;
});

/**
 * Lógica core para registrar el acknowledgement de un pedido
 * @param body Body del request original
 * @param name Nombre de la función para los logs
 * @return CloudRes estándar
 */
const doWork: CallbackFunction = async (
  body: Order_ACK_Body
): Promise<CloudRes> => {
  try {
    /**
     * EMPIEZA LOGICA PARA
     * ACTUALIZAR ORDER CON STATUS CONFIRMADO
     */
    const { data } = body;
    const { order_id, RecibeOrderAck } = data;
    await firestore.doc(`orders/${order_id}`).update({ status: "Confirmado" });

    /**
     * EMPIEZA LOGICA PARA INTEGRACION CON
     * ENDPOINT DE CPI
     */

    const url = process.env.CONFIRMAPEDIDO_CPI_R86 ?? "";
    const token = await getTokenCpiMateriales();

    const cpi_body = { RecibeOrderAck };
    console.log("Pedido: ", cpi_body);

    const Detail = _.cloneDeep(cpi_body.RecibeOrderAck[0].detail);
    delete cpi_body.RecibeOrderAck[0].detail;
    cpi_body.RecibeOrderAck[0].Detail = Detail;
    console.log(JSON.stringify(cpi_body));

    const res = await axios.post(url, cpi_body, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("CPI response R86", JSON.stringify(res.data));

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

interface Order_ACK_Body {
  data: {
    order_id: string;
    RecibeOrderAck: any[];
  };
}
