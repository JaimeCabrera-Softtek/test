import _ = require("lodash");

import {
  AltaMaterial_ProductInit,
  JobStatus,
} from "../01_batch_creation/interfaces";
import { db, db_materiales } from "../../firebase";
import {
  ALTA_MATERIALES,
  MATERIALES,
  PRECIOS_VENTA_SAP,
  MATERIALES_BATCH_STATUS,
} from "../../z_helpers/constants";
import { body05 } from "../z_sendSegment/helpers/segment_body_helpers/5";
import { getCatalog } from "../../z_helpers/firestoreServices";
import {
  updateItemStatus,
  updateUpdateDate,
} from "../../CargaCatalogo/services";
import { PreciosVentaSAP } from "../../interfaces/CargaCatalogo/precios";

/**
 * Guarda el material tipo: "nuevo_completo" en el nodo Materiales (cuando termina el envío de segmentos)
 * @param jobId cual job ID tiene los datos que voy a guardar
 */
export const saveNuevoCompleto = async (jobId: string) => {
  try {
    // get job data
    const jobRef = db_materiales.ref(ALTA_MATERIALES).child(jobId);
    const jobData = (
      await jobRef.once("value")
    ).val() as AltaMaterial_ProductInit;

    const basicInfo = getBasicInfo(jobData, {});

    // por cada variante, guardar una entrada en Materiales
    for (const v of Object.values(jobData.art.variantes)) {
      const material = {
        ...basicInfo,
        Edad: v.edad,
        Subgenero: v.subgenero,
        UPC: v.upc,
        Talla: v.tallaProveedor,
        NumMatVariante: v.consecutivo,
        identificador_personalizado: `${basicInfo.MarcaId}+${basicInfo.Estilo}`,
      };

      const matRef = db_materiales.ref(`${MATERIALES}/${v.upc}`);
      await matRef.set(material);
    }

    // GUARDAR EL PRECIO POR PRIMERA VEZ
    const precios = await body05(jobData);

    const numMaterial = jobData.consecutivo.toString();
    const preciosRef = db_materiales.ref(`${PRECIOS_VENTA_SAP}/${numMaterial}`);

    await preciosRef.set(precios.preciosVenta);
  } catch (error) {
    console.log(
      `Error guardando el artículo ${jobId}`,
      (error as Error).message
    );

    throw new Error(
      `Error guardando el artículo ${jobId}
      ${(error as Error).message}`
    );
  }
};

/**
 * Guarda los resultados de una extensión (actualiza en banner en Materiales y el nodo Precios_Venta)
 * @param jobId job id que es de tipo "extension_de_banner" y se acaba de terminar
 */
export const saveExtensionBanner = async (jobId: string) => {
  try {
    // get job data
    const jobRef = db_materiales.ref(ALTA_MATERIALES).child(jobId);
    const jobData = (
      await jobRef.once("value")
    ).val() as AltaMaterial_ProductInit;

    // por cada variante, actualizar los banners
    for (const v of Object.values(jobData.art.variantes)) {
      const matRef = db_materiales.ref(`${MATERIALES}/${v.upc}`);
      const material = (await matRef.once("value")).val();

      let basicInfo = getBasicInfo(jobData, material ?? {});

      const updater = {
        ...basicInfo,
        UPC: v.upc,
        Talla: v.tallaProveedor,
        NumMatVariante: v.consecutivo,
      };

      await matRef.set(updater);
    }

    // GUARDAR EL PRECIO
    const numMaterial = jobData.consecutivo.toString();
    const preciosRef = db_materiales.ref(`${PRECIOS_VENTA_SAP}/${numMaterial}`);

    // obtiene los dos precios, almacenados en base de datos, y los del job
    const oldPrecios = (await preciosRef.once("value")).val() ?? [];
    const newPrecios = await body05(jobData);
    const precios = [...oldPrecios, ...newPrecios.preciosVenta];

    // guarda los precios
    await preciosRef.set(precios);
    console.log("INFO DE EXTENSION GUARDADA", jobId);
  } catch (error) {
    throw new Error(
      `Error guardando la extensión ${jobId}
      ${(error as Error).message}`
    );
  }
};

/**
 * Proceso que se ejecuta una vez finalizado exitosamente el proceso de cambio de precios en SAP
 * @param jobId jobID correspondiente
 */
export const saveCambioPrecios = async (jobId: string) => {
  try {
    // get job data
    const jobRef = db_materiales.ref(ALTA_MATERIALES).child(jobId);
    const jobData = (
      await jobRef.once("value")
    ).val() as AltaMaterial_ProductInit;

    // Obtener la información básica
    let basicInfo: any = _.cloneDeep(jobData.art);
    let totalNew = 0;

    // por cada variante, guardar una entrada en Materiales
    for (const vv of Object.values(basicInfo.variantes)) {
      const v = vv as any;
      // * ACTUALIZA EL PRECIO/COSTO EN MATERIALES
      const matRef = db_materiales.ref(`${MATERIALES}/${v.upc}`);
      const m = (await matRef.once("value")).val();

      const sociedad = basicInfo["Sociedad"] ?? "1001";

      const preciosVenta = {
        ...m["Precios_venta"],
        [sociedad]: basicInfo["Precio_venta"],
      };

      const preciosCompra = {
        ...m["Precios_compra"],
        [sociedad]: basicInfo["Precio_compra"],
      };

      const catalogos = {
        ...m["Catalogos"],
        [sociedad]: basicInfo["Catalogo"],
      };

      const catalogosID = {
        ...m["Catalogos_ID"],
        [sociedad]: basicInfo["Catalog_ID"],
      };

      const material = {
        ...m, // OTRA INFO QUE NO DEBE CAMBIAR...
        Precios_venta: preciosVenta, // ACTUALIZA PRECIO VENTA
        Precios_compra: preciosCompra, // ACTUALIZA PRECIO COMPRA
        Catalogos: catalogos, // ACTUALIZA EL CATÁLOGO QUE TRAE LOS PRECIOS NUEVOS
        Catalogos_ID: catalogosID,
      };

      await matRef.set(material);

      // * ACTUALIZA INFO DEL PRODUCTO EN /Products
      const provider = m["Proveedores"][sociedad];
      const brand = m["MarcaId"];
      const date = new Date().toISOString().split(".")[0];

      const productosRef = db.ref(`Productos/${provider}/${brand}`);
      const allRef = productosRef.child(`Productos/${v.upc}`);
      const historialRef = productosRef.child(`Historial/${v.upc}/${date}`);
      const catalogsRef = productosRef.child(
        `Catalogos/${basicInfo.Catalogo}/${v.upc}`
      );

      const a = (await allRef.once("value")).val();
      const updater = {
        ...a, //info que no cambia
        "Precio de compra del producto": basicInfo.Precio_compra,
        "Precio venta del producto": basicInfo.Precio_venta,
        catalog: basicInfo.Catalogo,
        catalog_id: basicInfo.Catalog_ID,
      };

      await allRef.set(updater);
      await historialRef.set(updater);
      await catalogsRef.set(updater);

      totalNew++;
    }

    // ** ACTUALIZAR STATUS Y OTROS CAMPOS DEL CATÁLOGO
    const catalog = await getCatalog(basicInfo.Catalogo);
    if (catalog) {
      const totalOldOk = catalog.item_status.total_ok ?? 0;
      await updateUpdateDate(basicInfo.Catalogo);
      await updateItemStatus(
        basicInfo.Catalogo,
        "total_ok",
        totalOldOk + totalNew
      );
    }

    // * ACTUALIZA EL PRECIO EN NODO PRECIOS SAP
    if (
      jobData.type === "cambio_precios" ||
      jobData.type === "cambio_precio_venta"
    ) {
      const numMaterial = jobData.consecutivo.toString();
      const preciosRef = db_materiales.ref(
        `${PRECIOS_VENTA_SAP}/${numMaterial}`
      );
      const realtimePrecios: PreciosVentaSAP[] = (
        await preciosRef.once("value")
      ).val();
      // const updater = _.cloneDeep(realtimePrecios);
      const actualPrecios = (await body05(jobData)).preciosVenta;
      const updater = [...realtimePrecios, ...actualPrecios];

      preciosRef.set(updater);
    } else {
      // TODO: SE NECESITA GUARDAR EL COSTO SAP EN REALTIME??
    }
  } catch (error) {
    console.log(
      `Error guardando el cambio de precios ${jobId}`,
      (error as Error).message
    );

    throw new Error(
      `Error guardando el cambio de precios ${jobId}
      ${(error as Error).message}`
    );
  }
};

/**
 * Actualizar el status de un job de un batch de selección de materiales (nuevo_completo)
 * @param job Job de selección de materiales
 * @param status status que queremos ponerle
 * @returns void
 */
export const updateBatchStatus_NuevoCompleto = async (
  job: AltaMaterial_ProductInit,
  status: JobStatus
): Promise<void> => {
  try {
    const { batch_id, push_id, uid } = job;
    if (batch_id !== undefined) {
      return db_materiales
        .ref(MATERIALES_BATCH_STATUS)
        .child(uid)
        .child(batch_id)
        .child("jobs")
        .child(push_id!)
        .update({ status: status });
    } else {
      console.log(
        "Error actualizando status de job",
        push_id,
        "en el batch",
        batch_id
      );
    }
  } catch (err) {
    console.log("Error actualizando status en batch", (err as Error).message);
  }
};

/** Obtiene la estructura principal del nodo Materiales */
const getBasicInfo = (jobData: any, material: any) => {
  // * Obtener la información básica
  let basicInfo: any = _.cloneDeep(jobData.art);
  // no nos interesa variantes, vamos a detallarlas en cada registro
  delete basicInfo["variantes"];
  delete basicInfo["Unidades"];

  // lo guardo como arreglo porque puede haber varias después
  const sociedad = basicInfo["Sociedad"] ?? "1001";
  const sociedades = {
    ...(material["Sociedades"] ?? {}),
    [sociedad]: sociedad,
  };
  delete basicInfo["Sociedad"];

  const banners = { ...(material["Banners"] ?? {}) };

  if (!banners[sociedad]) {
    banners[sociedad] = [];
  }

  banners[sociedad] = [...banners[sociedad], ...jobData.banners];

  const commerce = { ...(material["Commerce"] ?? {}) };

  if (basicInfo.Commerce && basicInfo.Commerce !== "") {
    if (!commerce[sociedad]) {
      commerce[sociedad] = [];
    }

    commerce[sociedad] = [...commerce[sociedad], basicInfo.Commerce];
  }

  delete basicInfo["Commerce"];

  const preciosVenta = {
    ...(material["Precios_venta"] ?? {}),
    [sociedad]: basicInfo["Precio_venta"],
  };
  delete basicInfo["Precio_venta"];

  const preciosCompra = {
    ...(material["Precios_compra"] ?? {}),
    [sociedad]: basicInfo["Precio_compra"],
  };
  delete basicInfo["Precio_compra"];

  const catalogos = {
    ...(material["Catalogos"] ?? {}),
    [sociedad]: basicInfo["Catalogo"],
  };

  const catalogosID = {
    ...(material["Catalogos_ID"] ?? {}),
    [sociedad]: basicInfo["Catalog_ID"] ?? basicInfo["Catalogo"],
  };
  delete basicInfo["Catalog_ID"];
  delete basicInfo["Catalogo"];

  const proveedores = {
    ...(material["Proveedores"] ?? {}),
    [sociedad]: basicInfo["Proveedor"],
  };

  const proveedoresSAP = {
    ...(material["Proveedores_SAP"] ?? {}),
    [sociedad]: basicInfo["providerIDSAP"] ?? basicInfo["Proveedor"],
  };

  const proveedoresName = {
    ...(material["Proveedores_Name"] ?? {}),
    [sociedad]: basicInfo["Provider_name"] ?? basicInfo["Proveedor"],
  };
  delete basicInfo["providerIDSAP"];
  delete basicInfo["Proveedor"];
  delete basicInfo["Provider_name"];

  const canales = {
    ...(material["CanalDistribucion"] ?? {}),
    [sociedad]: jobData.canal_distribucion,
  };

  basicInfo = {
    ...basicInfo,
    NumMatGenerico: jobData.consecutivo,
    CanalDistribucion: canales,
    Banners: banners,
    Sociedades: sociedades,
    Precios_venta: preciosVenta,
    Precios_compra: preciosCompra,
    Catalogos: catalogos,
    Catalogos_ID: catalogosID,
    Proveedores: proveedores,
    Proveedores_SAP: proveedoresSAP,
    Proveedores_Name: proveedoresName,
    Commerce: commerce,
  };

  return basicInfo;
};
