import * as functions from "firebase-functions";
import * as schema from "./HandleMonitor_schema.json";
import {
  CallbackFunction,
  VerifyIntegrationRequest,
} from "../../z_helpers/IntegrationsWrapper";
import { CloudRes } from "../../interfaces/CloudRes";
import { change } from "../../interfaces/CargaCatalogo";
import {
  getCambio,
  getMaterialByGenerico,
} from "../../z_helpers/realtimeServices";
import _ = require("lodash");
import { desdoblarParaFirebase } from "../../AltaMateriales/01_batch_creation/desdoblar";
import { inicializarFirebase } from "../../AltaMateriales/01_batch_creation/inicializarFirebase";
import { changeCambiosStatus } from "../RegistrarLogs";
import { User } from "../../interfaces/user";

/**
 * Esta función recibe un mapa (items) que es una relacion generico-campos con cambios,
 * que representa, por generico, que cambios DE PRECIOS se van a enviar a SAP.
 * Se llama desde react en monitor de cambios, rol compras.
 *
 * 1. Obtiene un arreglo de items con el formato aceptado por batch-creation, tomando como base los registros en /Materiales pero SUSTITUYENDO los valores que se van a cambiar, estos nuevos valores están en realtime y se registraron al momento de subir el catálogo.
 * > Tambien, asigna el _subtype_ un campo importante en el Alta de Materiales, ya que define que segmentos se van a enviar a SAP. Puede ser cambio_precios, cambio_precio_venta y cambio_precio_compra
 * 2. Envía a CPI los segmentos correspondientes de acuerdo al tipo de cambio:
 * - Cambio de precios compra y venta: 4 y 5
 * - Cambio de precio compra: 4
 * - Cambio precio venta: 5
 * 3. Inicializar el nodo en realtime para el tracking de los segmentos correspondientes al tipo de cambio (AltaMateriales).
 * 4. Actualiza el nodo Cambios de realtime con los logs correspondientes
 */
export const handleMonitor = functions
  .runWith({ memory: "8GB", timeoutSeconds: 540 })
  .https.onCall(async (data, context) => {
    const result = await VerifyIntegrationRequest(
      data,
      context,
      "DeteccionCambios-handleMonitor",
      ["compras", "tester"],
      schema,
      doWork,
      "CambiosCatalogo"
    );
    return result;
  });

const doWork: CallbackFunction = async (
  body: any,
  context: functions.https.CallableContext,
  user?: User
): Promise<CloudRes> => {
  try {
    // * OBTENER LA ESTRUCTURA PARA batch_creation
    const groupedItems = await handleMap(body.items);
    console.log("obtenido el body para batch creation");

    // ! ESTO ES batch_creation, LO HAGO DESDE AQUI PARA NO TENER VARIAS LLAMADAS DESDE REACT Y MEJORAR TIEMPO DE RESPUESTA
    const materiales_firebase = await desdoblarParaFirebase(
      groupedItems,
      user?.uid ?? "",
      "cambio_precios"
    );
    let res = await inicializarFirebase(materiales_firebase);
    console.log("iniciando triggers");

    //*  SI TODO SALE BIEN, REGISTRAR LOGS EN REALTIME
    if (!res.error) {
      await changeCambiosStatus(body.items, true, user);
      console.log("cambiando logs en realtime");

      return {
        error: false,
        msg: "Cambio de precios enviado a S4 con éxito",
        data: { items: groupedItems, jobID: res.data },
      };
    } else {
      return res;
    }
  } catch (error) {
    return {
      error: true,
      msg: (error as Error).message,
      data: null,
    };
  }
};

/**
 * Procesa cada materiales generico enviado desde react y sus respectivos campos con cambios
 * @returns arreglo de materiales para enviar a batch creation & estructura de cambios para actualizar con logs
 */
const handleMap = async (map: { [g: string]: string[] }) => {
  // * 1. ARMAR ITEMS PARA BATCH CREATION
  /** Items que se van a mandar a batch creation */
  let materiales: any[] = [];

  for (const [customID, fields] of _.entries(map)) {
    const generico = customID.split("-")[0];
    // traer el objeto cambios de realtime
    const cambios: change = await getCambio(customID);

    // traer el mapa de materiales con este generico
    const materialesSAP = await getMaterialByGenerico(generico);

    // obtener el item Material que se le va a enviar a batch creation
    const buildMaterial = buildMateriales(
      _.values(materialesSAP),
      fields,
      cambios
    );

    // cada item que se va a mandar a batch creation
    materiales.push(buildMaterial);
  }

  return materiales;
};

/** Crea un material con el campo "variants", de acuerdo al arreglo de las mismas (el que recibe batch creation)
 *  Además, edita el objeto cambios que tiene las actualizaciones de sus logs */
const buildMateriales = (
  variantes: any[],
  changedFields: string[],
  changes: change
) => {
  /** Objeto unico con info general, se agrega campo variantes */
  const material: any = { variantes: {} };
  const sociedad = changes.cabecera.sociedad ?? "1001";

  // por cada variante
  for (const variante of variantes) {
    // alterar el campo Variants del objeto unico
    material["variantes"][variante["UPC"]] = {
      upc: variante["UPC"],
      tallaProveedor: variante["Talla"],
      consecutivo: variante["NumMatVariante"],
    };
  }

  // estos campos van a cambiar
  // ! NO DEBE CAMBIAR PROVEEDOR Y MARCA... O SI?
  material["providerIDSAP"] = changes.cabecera.providerIDSAP;
  material["Catalogo"] = changes.cabecera.catalogID;
  material["Catalog_ID"] = changes.cabecera.catalogName;
  material["Estilo"] = changes.cabecera.estilo;
  material["Sociedad"] = sociedad;
  material["NumMatGenerico"] = variantes[0].NumMatGenerico;
  material["Banners"] = variantes[0].Banners[sociedad];
  material["Descripcion_corta"] = variantes[0].Descripcion_corta;
  material["Temporada"] = variantes[0].Temporada;
  material["Ano"] = variantes[0].Ano;
  material["Division"] = variantes[0].Division;
  material["Genero"] = variantes[0].Genero;
  material["Deporte"] = variantes[0].Deporte;
  material["Marca"] = variantes[0].Marca;
  material["Provider_name"] = variantes[0].Proveedores_Name[sociedad] ?? ""; //!
  material["Color"] = variantes[0].Color;
  material["Precio_compra"] = variantes[0].Precios_compra[sociedad]; //!
  material["Precio_venta"] = variantes[0].Precios_venta[sociedad]; //!

  // * AQUI SE SUSTITUYEN LOS VALORES A ENVIAR A BATCH CREATION
  for (const changedField of changedFields) {
    if (changes.cambios[changedField]) {
      // cambia en material para batch creation...
      material[changedField] = changes.cambios[changedField].after;
    } else {
      // ! NO DEBERIA
    }
  }

  // * AQUI LE DECIMOS A BATCH CREATION A CUALES SEGMENTOS VAN ESTOS CAMBIOS
  // ! POR ARTICULO
  let subtype = "cambio_otros";
  if (
    changedFields.includes("Precio_venta") &&
    changedFields.includes("Precio_compra")
  ) {
    subtype = "cambio_precios";
  } else if (changedFields.includes("Precio_venta")) {
    subtype = "cambio_precio_venta";
  } else if (changedFields.includes("Precio_compra")) {
    subtype = "cambio_precio_compra";
  }

  material["subtype"] = subtype;

  return material;
};
