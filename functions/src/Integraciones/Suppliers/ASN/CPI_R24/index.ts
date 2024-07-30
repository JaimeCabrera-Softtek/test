import * as functions from "firebase-functions";

import { VerifyIntegrationRequest } from "../../../../z_helpers/IntegrationsWrapper";

//* Se puede tomar como referencia el Template_schema.json
import * as schema from "./cpi_r24_schema.json";
import { User } from "../../../../interfaces/user";
import { db, firestore } from "../../../../firebase";
import {
  getASNbyID,
  getAcuseByASN,
  getOrderByNoDoc,
  updateEEASN,
  updateOrderStatus,
  updateStatusASN,
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
  entrega: string;
  posicionEntrega: string;
  claseMovimiento: string;
  numeroMaterial: string;
  almacen: string;
  proveedor: string;
  indDebeHaber: string;
  texto?: string;
  materialFabricante: string;
  textoCabeceraDocumento?: string;
  cartaPorte: string;
  importeMontoLocal: string;
  horaEntrada: string;
  ean: string;
  estadoCabecera?: string;
  estadoPosicion?: string;
}
interface Acuse {
  horaEntrada: string;
  importeMontoLocal: number;
  proveedor: string;
  centro: string;
  cartaPorte: string;
  fechaEntrega: string;
  cantidadEsperada: number;
  cantidadRecibida: number;
  estatus: string;
  pedido: string;
}

interface EntregaE {
  entrega: string;
  estatus: string;
  cartaPorte: string;
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
export const asnCPI_R24 = functions.https.onCall(async (data, context) => {
  try {
    console.log(JSON.stringify(data));
    const result = await VerifyIntegrationRequest(
      data,
      context,
      "Integraciones-Suppliers-asnCPI_R24",
      ["service", "tester", "proveedor"],
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
  console.log("entró a lógica core de asn_r24");
  // Extrae el array ConfirmaCantidadAsn del objeto body.data
  const confirmaciones = body.ConfirmaCantidadAsn;
  console.log("Body: ", JSON.stringify(body));

  // Accede a la colección 'acuse' de Firestore
  const acuseCollection = firestore.collection("acuse");
  let acuseList: Acuse[] = [];
  let entregasList: EntregaE[] = [];
  let allowedAcuse: string[] = [];

  const order = confirmaciones[0] ? confirmaciones[0]?.pedido : undefined;
  const orderDoc = order ? await getOrderByNoDoc(order) : order;

  if (orderDoc) {
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
      const asn_id = confirmacion.cartaPorte;
      const asn_number = Number(asn_id);
      const asn_doc = await getASNbyID(asn_number, "asn");
      console.log("ASN DOC", JSON.stringify(asn_doc));
      if (asn_doc) {
        const firestoreAcuse = allowedAcuse.includes(asn_id)
          ? null
          : await getAcuseByASN(asn_id);
        if (firestoreAcuse)
          return {
            message: [
              {
                returnType: "E",
                returnId: "IBN",
                returnNumber: "508",
                returnMessage: `Entrega de mercancía previamente realizada: ${asn_id}`,
              },
            ],
          };
        else {
          allowedAcuse.push(confirmacion.cartaPorte);
          const acuse_index = acuseList.findIndex(
            (acuse: Acuse) => acuse.cartaPorte === confirmacion.cartaPorte
          );
          if (acuse_index !== -1) {
            const importe =
              parseFloat(confirmacion.importeMontoLocal) +
              acuseList[acuse_index].importeMontoLocal;
            const cantidadRecibida =
              parseFloat(confirmacion.cantidad) +
              acuseList[acuse_index].cantidadRecibida;
            acuseList[acuse_index].cantidadRecibida = cantidadRecibida;
            acuseList[acuse_index].importeMontoLocal = importe;
          } else {
            acuseList.push({
              cantidadEsperada: asn_doc.quantity || 0,
              cantidadRecibida: parseFloat(confirmacion.cantidad),
              cartaPorte: confirmacion.cartaPorte,
              centro: confirmacion.centro,
              estatus: "Incompleto",
              fechaEntrega: confirmacion.fechaContabilizacion,
              horaEntrada: confirmacion.horaEntrada,
              importeMontoLocal: parseFloat(confirmacion.importeMontoLocal),
              proveedor: confirmacion.proveedor,
              pedido: confirmacion.pedido,
            });
          }
          const entrega_index = entregasList.findIndex((entrega: EntregaE) => {
            entrega.entrega === confirmacion.entrega;
          });
          if (entrega_index !== -1) {
            if (confirmacion?.estadoCabecera === "C")
              entregasList[entrega_index].estatus ===
                confirmacion.estadoCabecera;
          } else {
            const entregaE: EntregaE = {
              cartaPorte: confirmacion.cartaPorte,
              entrega: confirmacion.entrega,
              estatus: confirmacion.estadoCabecera ?? "P",
            };
            entregasList.push(entregaE);
          }
        }
      } else
        return {
          message: [
            {
              returnType: "E",
              returnId: "IBN",
              returnNumber: "308",
              returnMessage: `No existe asn: ${asn_id}`,
            },
          ],
        };
    }

    for await (const confirmacion of confirmaciones) {
      // Guarda los elementos en el nodo con el id del asn
      const asn_id = confirmacion.cartaPorte;
      const AcusesRef = db.ref(`/Acuses/${asn_id}`);
      // Saves all confirmation object
      const newAcuseRef = await AcusesRef.push({ ...confirmacion });
      await AcusesRef.update({ proveedor: confirmacion.proveedor });
      const AcuseKey = newAcuseRef.key;
      console.log(AcuseKey);
    }

    for (const entrega of entregasList) {
      await updateEEASN(
        { [entrega.entrega]: entrega.estatus },
        Number(entrega.cartaPorte)
      );
    }

    for (const acuse of acuseList) {
      // Update status for ASN and missing EEs
      await updateStatusASN(Number(acuse.cartaPorte));
      const delivered =
        (orderDoc?.deliveredQuantity || 0) + acuse.cantidadRecibida;
      if (acuse.cantidadEsperada === acuse.cantidadRecibida)
        acuse.estatus = "Completo";
      const changes: any = { deliveredQuantity: delivered };
      if (delivered === orderDoc?.quantity) changes.status = "COMPLETO";
      await acuseCollection.add(acuse);
      await updateOrderStatus(acuse.pedido, changes);
    }

    console.log(JSON.stringify(acuseList));
    console.log(JSON.stringify(entregasList));
  } else
    return {
      message: [
        {
          returnType: "E",
          returnId: "IBN",
          returnNumber: "305",
          returnMessage: `No existe pedido: ${order}`,
        },
      ],
    };

  console.log(JSON.stringify(acuseList));
  console.log(JSON.stringify(entregasList));

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

/**
 * Notes:
 * materialFabricante (in terms of process) should always be there
 * but since the SAP portal doesn't treat it that way is possible that
 * sometimes (at least in testing) could be null, so for now it will be
 * deleted from the required properties
 */
