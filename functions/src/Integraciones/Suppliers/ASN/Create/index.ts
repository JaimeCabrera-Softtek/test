import * as functions from "firebase-functions";
import {
  VerifyIntegrationRequest,
  CallbackFunction,
} from "../../../../z_helpers/IntegrationsWrapper";
import { CloudRes, res_ok } from "../../../../interfaces/CloudRes";
import * as schema from "./asnCreate_schema.json";
import { User } from "../../../../interfaces/user";
import _ = require("lodash");
import { db, firestore, storage } from "../../../../firebase";
import { COLLECTION_ASN } from "../../../../z_helpers/constants";
import axios from "axios";
import { getTokenCpiMateriales } from "../../../../AltaMateriales/z_sendSegment/helpers/cpi_hepers";
import {
  getOrderByNoDoc,
  updateOrderBoxCount,
  verifyInvoince,
} from "../../../../z_helpers/firestoreServices";

interface asnBody {
  firebaseData: any;
}

// TODO: comentar

export const asnCreate = functions.https.onCall(async (data, context) => {
  const result = await VerifyIntegrationRequest(
    data,
    context,
    "Integraciones-Suppliers-asnCreate",
    ["service", "tester", "proveedor"],
    schema,
    doWork,
    "ASN",
    "api"
  );
  return result;
});

const doWork: CallbackFunction = async (
  body: any,
  context: functions.https.CallableContext,
  user?: User
): Promise<CloudRes> => {
  const token = await getTokenCpiMateriales();
  console.log("el token", token);
  console.log("entra a logica de R23 para cargar a firebase y storage");
  try {
    const { firebaseData } = body as asnBody;
    console.log("pedido", firebaseData.encabezado.no_orden);

    const order = await getOrderByNoDoc(firebaseData.encabezado.no_orden);

    if (order) {
      const { success, data } = await verifyInvoince(
        firebaseData.encabezado.factura,
        firebaseData.encabezado.no_provedor
      );
      // Verify invoice number, if it's duplicated return error
      if (!success) return { error: true, msg: data, data: null };
      console.log("order", JSON.stringify(order));
      console.log("finValidez ", order?.finValidez);
      console.log("type: ", order.claseDocumento);
      firebaseData.encabezado.claseDocumento = order.claseDocumento;
      firebaseData.encabezado.finValidez = order?.finValidez;

      const storeOrder = order.claseDocumento === "ZPDT" ? true : false;
      const asn_id = await nextID();
      await saveValue(asn_id);

      console.log(JSON.stringify(firebaseData));

      const collectionRef = firestore.collection(COLLECTION_ASN);
      const buffer = Buffer.from(JSON.stringify(firebaseData.contenedores));
      const docRef = collectionRef.doc();
      const bucket = storage.bucket();

      // console.log("Context", JSON.stringify(context));
      // const token = context.rawRequest.header("x-ibn-token");
      // const secret = process.env.PRIVATE_KEY;
      // const decoded = jwt.verify(token!, secret ?? "");
      const provider_id = firebaseData.encabezado.no_provedor;
      console.log("ID proveedor", provider_id);

      const filePath = `asn/${provider_id}/asn_${docRef.id}.json`;
      const file = bucket.file(filePath);

      firebaseData.encabezado.doc_id = docRef.id;
      firebaseData.encabezado.asn_path = filePath;
      firebaseData.encabezado.provider_id = provider_id;
      firebaseData.encabezado.asn = asn_id;
      firebaseData.encabezado.delivered = false;

      console.log("Cargando ASN a firestore y storage");
      const boxCount = _.values(firebaseData.contenedores).length;
      const arrNum: number[] = _.values(firebaseData.contenedores).map(
        (caja) => {
          const arr: number[] = caja.contenido.map((item: any) => {
            return parseInt(item.no_piezas);
          });
          return arr.reduce((acc, val) => {
            return acc + val;
          }, 0);
        }
      );
      const total = arrNum.reduce((acc, val) => {
        return acc + val;
      });
      firebaseData.encabezado.quantity = total;

      await docRef.set(firebaseData.encabezado);

      await file.save(buffer, {
        contentType: "text/json",
      });

      console.log("Archivo cargado y guardado");
      const convertStringToFloatWithTwoDecimals = (
        inputString: string
      ): string => {
        // Parse the input string to a float
        const floatValue = parseFloat(inputString);

        // Convert the rounded float back to a string
        const resultString = floatValue.toFixed(2);

        return resultString;
      };

      const formatDate = (inputDate: string): string => {
        // Extract year, month, and day from the input string
        const year = inputDate.slice(0, 4);
        const month = inputDate.slice(4, 6);
        const day = inputDate.slice(6, 8);

        // Format the date as DD.MM.YYYY
        const formattedDate = `${day}.${month}.${year}`;

        return formattedDate;
      };

      const rootJSONCPI = {
        asn: asn_id,
        fechaEmbarque: formatDate(firebaseData.encabezado.fecha_embarque),
        fechaEntrega: formatDate(firebaseData.encabezado.fecha_entrega),
        horaEntrega: firebaseData.encabezado.hora_entrega,
        proveedor: firebaseData.encabezado.no_provedor,
        OrdenCompra: firebaseData.encabezado.no_orden,
        centroDistribucion: firebaseData.encabezado.no_cedis,
        shipmentNumber: firebaseData.encabezado.shipmentNumber,
      };

      const CajasJSONCPI = Object.values(firebaseData.contenedores).map(
        (contenedor: any) => {
          return {
            tienda: contenedor.no_tienda,
            numeroContenedor: contenedor.no_caja,
            Posicion: contenedor.contenido.map((prod: any) => {
              return {
                codigoBarra: prod.codigo_barra,
                tipoCodigo: prod.tipo_codigo,
                numeroPiezas: convertStringToFloatWithTwoDecimals(
                  prod.no_piezas
                ),
                unidadMedida: prod.unidad,
                piezasPorUnidad: convertStringToFloatWithTwoDecimals(
                  prod.no_piezas_unidad
                ),
              };
            }),
          };
        }
      );

      console.log(JSON.stringify(rootJSONCPI));
      console.log(JSON.stringify(CajasJSONCPI));

      const jsonCPI = {
        EnviaAsn: [{ ...rootJSONCPI, Cajas: CajasJSONCPI }],
      };

      console.log("JSON CPI: ", JSON.stringify(jsonCPI));

      const url: string = process.env.ASN_CPI_R23 ?? "";

      const res = await axios.post(url, jsonCPI, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      let response = JSON.stringify(res.data);
      let status = storeOrder ? "En Tránsito" : "Sin Cita";

      console.log(response);

      if (res?.data?.message)
        for (const message of res.data.message) {
          if (message.returnType !== "S") status = "SAP ERROR";
        }
      else {
        response = JSON.stringify({
          message: [
            {
              returnType: "E",
              returnId: "SAP/CPI",
              returnNumber: "504",
              returnMessage: "Error desconocido",
            },
          ],
        });
        status = "SAP ERROR";
      }

      const entregas: any = {};
      if (status !== "SAP ERROR") {
        for (const message of res.data.message) {
          const ee = String(message.returnMessage).split("creada ")[1];
          entregas[ee] = "P";
        }
      }

      docRef.update({
        SAP_response: response,
        status: status,
        ee: Object.keys(entregas).length > 0 ? entregas : null,
      });

      await updateOrderBoxCount(firebaseData.encabezado.no_orden, boxCount);

      let message = "";
      let error = false;
      if (status === "SAP ERROR") error = true;
      message = error
        ? `Error: SAP_ERROR: ${response}`
        : `SUCCESS: SAP_RESPONSE: ${response}`;

      return {
        error: error,
        msg: message,
        data: res_ok,
      };
    } else {
      return {
        error: true,
        msg: `La orden de compra ${firebaseData.encabezado.no_orden} no existe`,
        data: null,
      };
    }
  } catch (error) {
    console.error("Error al hacer el request", error);

    return {
      error: true,
      msg: "Error al hacer el request",
      data: error,
    };
  }
};

// TODO: check for diferent types, for now using only one on 'tipo2'

/**
 * Obtener el siguiente ID consecutivo para ASN
 * @return el ID siguiente
 */
const nextID = async () => {
  const tres = await db.ref("ASN_Count/tipo2").transaction(
    (snap) => {
      if (snap != undefined && snap != null) {
        snap++;
      } else {
        snap = 1;
      }
      return snap;
    },
    (error, committed, snap) => {
      if (error) {
        console.log("Error en transaccion", error);
      }
    },
    true
  );

  if (tres.committed) {
    console.log(JSON.stringify(tres.snapshot.val()));
    return tres.snapshot.val();
  } else {
    throw `No se pudo obtener el consecutivo`;
  }
};

/**
 * Guarda un valor por medio de una transacción en realtime
 * @param value valor a guardar
 */
const saveValue = async (value: any) => {
  const tres = await db.ref("ASN_Count/tipo2").transaction(
    () => {
      return value;
    },
    (error, committed, snap) => {
      if (error) {
        console.log("Error en transaccion", error);
      }
    },
    true
  );

  if (tres.committed) {
    return tres.snapshot.val();
  } else {
    throw `No se pudo guardar el consecutivo`;
  }
};
