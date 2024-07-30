import * as functions from "firebase-functions";

import { VerifyIntegrationRequest } from "../../../../z_helpers/IntegrationsWrapper";

//* Se puede tomar como referencia el Template_schema.json
import * as schema from "./cpi_r24_schema.json";
import { User } from "../../../../interfaces/user";
import { db, firestore } from "../../../../firebase";
import {
  getAcuseByOrder,
  updateAcuseNoCore,
  getOrderByNoDoc,
  updateOrderStatus,
} from "../../../../z_helpers/firestoreServices";

// Para uso futuro (probablemente) definición de la interfaz del body que se recibe
interface Confirmation {
  centro: string;
  unidadMedida: string;
  cantidad: string;
  fechaContabilizacion: string;
  fechaEntrega: string;
  fechaDocumento: string;
  pedido: string;
  posicionPedido: string;
  claseMovimiento: string;
  numeroMaterial: string;
  almacen?: string;
  proveedor: string;
  indDebeHaber: string;
  texto?: string;
  materialFabricante: string;
  textoCabeceraDocumento?: string;
  importeMontoLocal: string;
  horaEntrada: string;
  estadoCabecera?: string;
  estadoPosicion?: string;
  estatus?: string;
}

interface Acuse {
  horaEntrada: string;
  importeMontoLocal: number;
  proveedor: string;
  centro: string;
  pedido: string;
  fechaEntrega: string;
  cantidadEsperada: number;
  cantidadRecibida: number;
  estatus: string;
}

/**
 * Plantilla para el desarrollo de una integración con sistemas externos
 *
 * El endpoint debe de ser onRequest, y utilizar el wrapper 'VerifyIntegrationRequest'
 * que se encarga de aplicar ciertas reglas y verificaciones básicas sobre el request como
 * el api key, así como del manejo de errores y log a analytics.
 *
 * Para loggear analytics solo tendríamos que hacer un throw
 */
export const CPI_R24_noCore = functions.https.onCall(async (data, context) => {
  try {
    console.log(JSON.stringify(data));
    const result = await VerifyIntegrationRequest(
      data,
      context,
      "Integraciones-Suppliers-CPI_R24_noCore",
      ["service", "tester", "proveedor", "proveedornocore"],
      schema,
      doWork,
      "ASN"
    );
    return result;
  } catch (error) {
    console.error("Error processing request:", error);
    return { error: true, message: "Error processing your request." };
  }
});

/**
 * Ejemplo de una función que aplica cierta lógica core en este endpoint
 * @param body Body del request original
 * @param name Nombre de la función para los logs
 * @return CloudRes estándar
 */
const doWork: any = async (
  body: any,
  context: functions.https.CallableContext,
  user?: User
): Promise<any> => {
  console.log("entró a lógica core de asn_r24 no core");
  // Extrae el array ConfirmaCantidadAsn del objeto body.data
  const confirmaciones = body.ConfirmaCantidadAsn;
  console.log("Body: ", JSON.stringify(body));

  // Accede a la colección 'acuse' de Firestore
  const acuseCollection = firestore.collection("acuseNoCore");

  let error: any = { message: [] };
  let firestoreAcuse: any = undefined;
  let currentQuantity = 0;
  let acuse: Acuse = {
    horaEntrada: "",
    importeMontoLocal: 0,
    proveedor: "",
    centro: "",
    pedido: "",
    fechaEntrega: "",
    cantidadEsperada: 0,
    cantidadRecibida: 0,
    estatus: "",
  };

  const storesSet = new Set<string>();
  const order = confirmaciones[0] ? confirmaciones[0]?.pedido : undefined;
  // TEMP: uncomment when orders should exist
  const orderDoc = order ? await getOrderByNoDoc(order) : order;

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}${month}${day}`;
  };

  if (orderDoc) {
    if (!firestoreAcuse) {
      firestoreAcuse = await getAcuseByOrder(confirmaciones[0].pedido);
      if (firestoreAcuse) {
        if (firestoreAcuse.estatus === "Completo")
          return {
            message: [
              {
                returnType: "E",
                returnId: "IBN",
                returnNumber: "110",
                returnMessage: `Pedido previamente completado`,
              },
            ],
          };
        currentQuantity = firestoreAcuse.cantidadRecibida;
      }
    }
    console.log("Order Doc", JSON.stringify(orderDoc));

    for (const conf of confirmaciones) {
      const confirmacion: Confirmation = conf;
      confirmacion.proveedor = removeLeadingZeros(confirmacion.proveedor);
      if (confirmacion.pedido !== order) {
        return {
          message: [
            {
              returnType: "E",
              returnId: "IBN",
              returnNumber: "106",
              returnMessage: `Todas las posiciones deben ser del mismo pedido`,
            },
          ],
        };
      }
      const importe =
        parseFloat(confirmacion.importeMontoLocal) + acuse.importeMontoLocal;
      const cantidadRecibida =
        parseFloat(confirmacion.cantidad) + acuse.cantidadRecibida;
      if (!storesSet.has(confirmacion.centro)) {
        if (!firestoreAcuse?.centro.includes(confirmacion.centro))
          storesSet.add(confirmacion.centro);
      }
      console.log(storesSet);
      acuse = {
        cantidadEsperada: orderDoc.quantity || 0,
        cantidadRecibida: cantidadRecibida,
        pedido: confirmacion.pedido,
        centro: confirmacion.centro,
        estatus: "Parcial",
        fechaEntrega: formatDate(new Date()),
        horaEntrada: confirmacion.horaEntrada,
        importeMontoLocal: importe,
        proveedor: confirmacion.proveedor,
      };
      if (acuse.cantidadRecibida + currentQuantity > orderDoc.quantity) {
        return {
          message: [
            {
              returnType: "E",
              returnId: "IBN",
              returnNumber: "105",
              returnMessage: `La cantidad recibida excede la cantidad esperada en la orden de compra`,
            },
          ],
        };
      } else if (acuse.cantidadRecibida + currentQuantity === orderDoc.quantity)
        acuse.estatus = "Completo";
    }
  } else {
    return {
      message: [
        {
          returnType: "E",
          returnId: "IBN",
          returnNumber: "305",
          returnMessage: `No existe Ordern: ${order}`,
        },
      ],
    };
  }

  if (acuse.pedido.trim() !== "") {
    const status =
      acuse.estatus === "Completo"
        ? "PENDIENTE DE FACTURACIÓN"
        : "ENTREGA PARCIAL";
    let counter = 1;
    acuse.centro = Array.from(storesSet).join(", ");
    if (firestoreAcuse) {
      const prevImporte = firestoreAcuse.importeMontoLocal;
      const prevCantidad = firestoreAcuse.cantidadRecibida;
      acuse.centro = `${firestoreAcuse.centro}, ${acuse.centro}`;

      const importe = parseFloat(prevImporte) + acuse.importeMontoLocal;
      const cantidad = parseFloat(prevCantidad) + acuse.cantidadRecibida;

      console.log("new quantity: ", cantidad);
      console.log("new importe: ", importe);
      acuse.cantidadRecibida = cantidad;
      acuse.importeMontoLocal = importe;

      counter = await updateAcuseNoCore(acuse);
    } else await acuseCollection.add({ ...acuse, requestCount: 1 });
    await updateOrderStatus(acuse.pedido, { status: status });

    for await (const confirmacion of confirmaciones) {
      // Guarda los elementos en el nodo con el id del pedido
      const AcusesRef = db.ref(`/AcusesNoCore/${order}`);
      // Saves all confirmation object
      const newAcuseRef = await AcusesRef.push({
        ...confirmacion,
        entrega: counter,
      });
      await AcusesRef.update({ proveedor: confirmacion.proveedor });
      const AcuseKey = newAcuseRef.key;
      console.log("Acuse key", AcuseKey);
    }
  }

  if (error.message.length > 0) return error;
  else
    return {
      message: [
        {
          returnType: "S",
          returnId: "IBN",
          returnNumber: "200",
          returnMessage: "Mensaje procesado correctamente",
        },
      ],
    };
};

const removeLeadingZeros = (input: string): string => {
  return input.replace(/^0+/, ""); // Removes leading zeros
};
