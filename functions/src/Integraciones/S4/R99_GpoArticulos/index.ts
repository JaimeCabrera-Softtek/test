import * as functions from "firebase-functions";
import {
  CallbackFunction,
  VerifyIntegrationRequest,
} from "../../../z_helpers/IntegrationsWrapper";
import { db_materiales } from "../../../firebase";
import { HELPER_CATALOGS } from "../../../z_helpers/constants";

import * as schema from "./r99_GpoArticulos_schema.json";

export const R99_gpoArticulos = functions.https.onCall(
  async (data, context) => {
    const res = await VerifyIntegrationRequest(
      data,
      context,
      "Integraciones-S4-R99_replicaGrupoArticulos",
      ["service"],
      schema,
      doWork,
      'Replicas'
    );

    return res;
  }
);

async function procesarYGuardarR99(input: any) {
  const gruposArticulos = input.GruposArticulos;
  const estructura: any = {};

  gruposArticulos.forEach((articulo: any) => {
    if (!estructura[articulo.numero]) {
      estructura[articulo.numero] = {
        descripcion: articulo.descripcion,
        detalles: {
          centro: articulo.centro,
          fechaActivacion: articulo.fechaActivacion,
          fechaModificacion: articulo.fechaModificacion,
          numero2: articulo.numero2,
        },
        subGrupos: [],
      };
    }
    if (articulo.enlaceGrupos) {
      if (!estructura[articulo.enlaceGrupos]) {
        estructura[articulo.enlaceGrupos] = { subGrupos: [] };
      }
      estructura[articulo.enlaceGrupos].subGrupos.push(articulo.numero);
    }
  });
  Object.keys(estructura).forEach((key) => {
    // Asegura que cada grupo tenga su descripción si no fue definida previamente
    if (!estructura[key].descripcion) {
      const subGrupo = estructura[key].subGrupos[0]; // Asume que hay al menos un subGrupo
      estructura[key].descripcion = estructura[subGrupo].descripcion; // O define una lógica para determinar la descripción
    }

    // Hacer un Set para eliminar duplicados
    if (estructura[key].subGrupos.length > 0) {
      estructura[key].subGrupos = Array.from(new Set(estructura[key].subGrupos));
    }
  });

  try {
    await db_materiales
      .ref(HELPER_CATALOGS)
      .child("R99_GpoArticulos")
      .update(estructura);
  } catch (error) {
    console.error("Error al guardar los datos: ", error);
  }
}

const doWork: CallbackFunction = async (
  body: any,
  context: functions.https.CallableContext
): Promise<any> => {
  try {

    await procesarYGuardarR99(body);

    return {
      error: false,
      message: [
        {
          returnType: "S",
          returnId: "IBN",
          returnNumber: "200",
          returnMessage: "Mensaje procesado correctamente",
        },
      ],
    };
  } catch (err) {
    console.log((err as Error).message);
    return {
      error: true,
      message: [
        {
          returnType: "E",
          returnId: "IBN",
          returnNumber: "500",
          returnMessage: (err as Error).message,
        },
      ],
    };
  }
};
