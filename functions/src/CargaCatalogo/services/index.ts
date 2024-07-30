import { randomUUID } from "crypto";
import { db_materiales, firestore, storage } from "../../firebase";
import _ = require("lodash");
import { MATERIALES } from "../../z_helpers/constants";

/**
 * Guardar resultado de los filtros
 * @param objects arreglo FINAL de candidatos filtrado
 */
export const saveResults = async (
  objects: any,
  path: string,
  idCatalog: string,
  item: "error_rules2" | "error_transformations"
) => {
  const file = storage.bucket().file(path);
  const contents = JSON.stringify(objects);
  const uuid = randomUUID();

  await file
    .save(contents, {
      metadata: {
        metadata: {
          firebaseStorageDownloadTokens: uuid,
        },
      },
    })
    .then(async (v) => {
      await savePath(idCatalog, path, item);
    });

  console.log("resultados guardados", path);
};

/**
 * ! auto-generated comment
 * Updates the item_status a catalog.
 *
 * @param {string} idCatalog - The ID of the catalog doc.
 * @param {string} item - Must be one of: "total_error_MDM", "total_error_provider", or "total_ok".
 * @param {number} content - The new status value.
 * @throws {Error} If the item status update fails.
 */
export const updateItemStatus = async (
  idCatalog: string,
  item:
    | "total_error_MDM"
    | "total_error_provider"
    | "total_ok"
    | "total"
    | "total_reutilizados"
    | "total_activos"
    | "total_inactivos",
  content: number
) => {
  try {
    const statusItem = `item_status.${item}`;
    const catalogRef = firestore.collection("catalogs").doc(idCatalog);
    await catalogRef.update({ [statusItem]: content });
  } catch (error) {
    console.log((error as Error).message);
    throw new Error(
      `No se pudo actualizar el item status ${idCatalog}, ${item}`
    );
  }
};

/**
 * ! auto-generated comment
 * Updates the status of a catalog.
 *
 * @param {string} idCatalog - The ID of the catalog doc.
 * @param {string} content - The new status of the catalog. Can be one of "revision", "aprobado", or "procesando".
 * @throws {Error} If there is an error updating the status.
 */
export const updateStatus = async (
  idCatalog: string,
  content: "revision" | "aprobado" | "procesando"
) => {
  try {
    const catalogRef = firestore.collection("catalogs").doc(idCatalog);
    await catalogRef.update({ status: content });
  } catch (error) {
    console.log((error as Error).message);
    throw new Error(`No se pudo actualizar el status ${idCatalog}`);
  }
};

/**
 * ! auto-generated comment
 * Updates the `date_updated` field of a catalog document in Firestore.
 *
 * @param {string} idCatalog - The ID of the catalog document to be updated.
 * @throws {Error} If the update operation fails.
 */
export const updateUpdateDate = async (idCatalog: string) => {
  try {
    const catalogRef = firestore.collection("catalogs").doc(idCatalog);
    await catalogRef.update({ date_updated: new Date() });
  } catch (error) {
    console.log((error as Error).message);
    throw new Error(`No se pudo actualizar el date_updated ${idCatalog}`);
  }
};

/**
 * ! auto-generated comment
 * Saves the provided path to the specified item in a catalog.path field.
 *
 * @param {string} idCatalog - The ID of the catalog doc.
 * @param {string} path - The path to be saved.
 * @param {string} item - The item in the catalog to update the path for.
 *                        Possible values: "error_rules2",
 *                        "error_transformations".
 * @throws {Error} If the path update fails.
 */
export const savePath = async (
  idCatalog: string,
  path: string,
  item: "error_rules2" | "error_transformations"
) => {
  try {
    const pathItem = `paths.${item}`;
    const catalogRef = firestore.collection("catalogs").doc(idCatalog);
    await catalogRef.update({ [pathItem]: path });
  } catch (error) {
    throw new Error(`No se pudo actualizar el path ${item}`);
  }
};

/**
 * ! auto-generated comment
 * Updates the `date_updated` field of a catalog document in Firestore.
 *
 * @param {string} idCatalog - The ID of the catalog document to be updated.
 * @param {any} filters - The filters that were generated from okProducts.
 * @throws {Error} If the update operation fails.
 */
export const updateFilters = async (idCatalog: string, filters: any) => {
  try {
    const catalogRef = firestore.collection("catalogs").doc(idCatalog);
    const sports = Object.keys(filters["Deporte"]);
    await catalogRef.update({ filters: filters, sports: sports });
  } catch (error) {
    console.log((error as Error).message);
    throw new Error(
      `No se pudieron actualizar los filtros ${idCatalog}. ${JSON.stringify(
        filters
      )}. ${(error as Error).message}`
    );
  }
};

/**
 * Obtiene las reglas de pre procesamiento almacenadas en firestore db
 * @returns reglas de preprocesamiento
 */
export const getPreprocessingRules = async () => {
  let data = undefined;

  const instanceRef = firestore.collection("config").doc("PreProcessingConfig");
  const instanceDoc: any = (await instanceRef.get()).data();

  if (instanceDoc && instanceDoc["data"]) {
    data = instanceDoc["data"];
  }

  return data;
};

export const getEstiloEnSAP = async (estilo: string) => {
  let materialesByEstilo: any[] = [];

  const ref = db_materiales
    .ref(MATERIALES)
    .orderByChild("Estilo")
    .equalTo(estilo);

  await ref.once("value", async (snapshot) => {
    if (snapshot.exists()) {
      const res = snapshot.val();
      if (!_.isEmpty(res)) {
        materialesByEstilo = _.values(res);
      }
    }
  });

  return materialesByEstilo;
};

export const getHeadersPermitidos = async () => {
  let data: string[] = [];

  const instanceRef = firestore.collection("config").doc("Headers");
  const instanceDoc: any = (await instanceRef.get()).data();

  if (instanceDoc && instanceDoc["data"] && instanceDoc["data"]["DETALLES"]) {
    const map = instanceDoc["data"]["DETALLES"];
    data = Object.keys(map);
  }

  // AGREGO LOS KBS AUTOMATICOS
  data.push("Alto", "Ancho", "Edad", "Largo", "Subgénero", "active");

  const setData = Array.from(new Set(data));

  console.log("Headers permitidos", JSON.stringify(data));

  return setData;
};
