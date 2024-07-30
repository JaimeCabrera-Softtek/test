import * as functions from "firebase-functions";
import {
  VerifyIntegrationRequest,
  CallbackFunction,
} from "../../../../z_helpers/IntegrationsWrapper";
import { CloudRes, res_ok } from "../../../../interfaces/CloudRes";
import * as schema from "./cpiSap_schema.json";
import { User } from "../../../../interfaces/user";
import { getTokenCpiMateriales } from "../../../../AltaMateriales/z_sendSegment/helpers/cpi_hepers";
import _ = require("lodash");
import axios from "axios";
import { db, firestore, storage } from "../../../../firebase";
import { COLLECTION_ASN } from "../../../../z_helpers/constants";
import { FieldValue } from "firebase-admin/firestore";

interface asnBody {
  cpi: {
    EnviaAsn: any[];
  };
  firebaseData: any;
}

// TODO: comentar
// TODO: save json when it's not called from portal

export const asnCPI_R23 = functions.https.onCall(async (data, context) => {
  const result = await VerifyIntegrationRequest(
    data,
    context,
    "Integraciones-Suppliers-asnCPI",
    ["service", "tester", "proveedor"],
    schema,
    mockStuff,
    "ASN",
    "api"
  );
  return result;
});

const mockStuff: CallbackFunction = async (
  body: any,
  context: functions.https.CallableContext,
  user?: User
): Promise<CloudRes> => {
  console.log("entra a logica de R23");
  try {
    const token = await getTokenCpiMateriales();
    console.log("el token", token);
    const { cpi, firebaseData } = body as asnBody;

    const asn_id = await nextID();
    await saveValue(asn_id);
    cpi.EnviaAsn[0].asn = asn_id;

    if (firebaseData) {
      const collectionRef = firestore.collection(COLLECTION_ASN);
      const buffer = Buffer.from(JSON.stringify(firebaseData.contenedores));
      const docRef = collectionRef.doc();
      const bucket = storage.bucket();
      const provider_id = user?.SAP_idProvider ?? user?.uid;
      const filePath = `asn/${provider_id}/asn_${docRef.id}.json`;
      const file = bucket.file(filePath);

      firebaseData.encabezado.doc_id = docRef.id;
      firebaseData.encabezado.asn_path = filePath;
      firebaseData.encabezado.provider_id = provider_id;
      firebaseData.encabezado.asn = asn_id;
      firebaseData.encabezado.delivered = false;

      console.log("Cargando ASN a firestore y storage");
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
      const url: string = process.env.ASN_CPI_R23 ?? "";

      const res = await axios.post(url, cpi, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const response = JSON.stringify(res.data);
      let status = "Sin Cita";

      for (const message of res.data.message)
        if (message.returnType !== "S") status = "SAP ERROR";

      const entregas: any = {};
      if (status === "Sin Cita") {
        for (const message of res.data.message) {
          const ee = String(message.returnMessage).split("creada ")[1];
          entregas[ee] = "P";
        }
      }

      docRef.update({
        SAP_response: response,
        status: status,
        factura:
          status === "SAP ERROR"
            ? FieldValue.delete()
            : firebaseData.encabezado.factura,
        ee: Object.keys(entregas).length > 0 ? entregas : null,
      });
      // ADD SAP response to asn in firebase
      // const response = res.data

      console.log("ASN enviado a CPI desde web: ", asn_id);
      console.log("CPI R23", "req.body", JSON.stringify(cpi));
      console.log("CPI R23", "res.data", response);
    } else {
      console.log("No portal");
      const url: string = process.env.ASN_CPI_R23 ?? "";

      const res = await axios.post(url, cpi, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log("ASN enviado a CPI desde api: ", asn_id);
      console.log("CPI R23", "req.body", JSON.stringify(cpi));
      console.log("CPI R23", "res.data", JSON.stringify(res.data));
    }

    return {
      error: false,
      msg: "Se hizo el request correctamente",
      data: res_ok,
    };
  } catch (error) {
    console.error("Error al hacer el request a CPI R23", error);

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
