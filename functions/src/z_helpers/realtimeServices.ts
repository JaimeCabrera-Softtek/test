import axios from "axios";
import { db, db_materiales } from "../firebase";
import {
  Changes,
  Historic,
  change,
  productsMap,
} from "../interfaces/CargaCatalogo";
import _ = require("lodash");
import { MATERIALES, PRECIOS_VENTA_SAP } from "./constants";
import { PreciosVentaSAP } from "../interfaces/CargaCatalogo/precios";
import { AltaMaterial_Articulo } from "../AltaMateriales/01_batch_creation/interfaces";

/**
 * Obtiene los materiales que están dados de alta en SAP DE UNA MARCA
 * TODO: SECCIONAR POR PROVEEDOR... COMO EL MATERIAL PUEDE TENER DOS PROVEEDORES (UNO PARA LA SOCIEDAD 1001 Y OTRO PARA LA 2001)
 * @return materiales dados de alta en SAP
 */
export const getMateriales = async (marca: string) => {
  let materiales: any = {};

  const ref = db_materiales
    .ref(MATERIALES)
    .orderByChild("MarcaId")
    .equalTo(marca);

  await ref.once("value", async (snapshot) => {
    if (snapshot.exists()) {
      materiales = snapshot.val();
    }
  });

  return materiales;
};

export const getPrecioVenta = async (id: string) => {
  let prices: PreciosVentaSAP[] = [];
  const ref = db_materiales.ref(`${PRECIOS_VENTA_SAP}/${id}`);

  await ref.once("value", (data) => {
    prices = data.val() as PreciosVentaSAP[];
    // console.log("prices", JSON.stringify(prices));
  });

  return prices;
};

/**
 * Obtiene un material del nodo Materiales
 * @param UPC UPC a consultar
 * @returns material dado de alta en SAP...
 */
export const getMaterial = async (UPC: string) => {
  let mat: AltaMaterial_Articulo | undefined = undefined;
  const ref = db_materiales.ref(`${MATERIALES}/${UPC}`);

  await ref.once("value", (data) => {
    mat = data.val() as AltaMaterial_Articulo;
  });

  return mat;
};

/**
 * Obtiene un mapa de materiales que tienen el mismo numero de material generico (variantes)
 * @param generico valor generico a buscar
 * @returns {[UPC: string]: any} -> mapa de variantes
 */
export const getMaterialByGenerico = async (generico: string) => {
  let mat: any = {};
  const ref = db_materiales.ref(`${MATERIALES}`);

  await ref
    .orderByChild("NumMatGenerico")
    .equalTo(Number(generico))
    .once("value", (data) => {
      mat = data.val();
    });

  return mat;
};

/**
 * Obtiene un catálogo de realtime dado un ID de proveedor, ID de marca e ID de catálogo
 * @param providerID ID del proveedor que subió el catálogo
 * @param catalogID ID del catálogo que se va a consultar
 * @param brandID ID de la marca del catálogo
 * @return un mapa de productos, la key es el UPC
 */
export const getCatalogRealtime = async (
  providerID: string,
  catalogID: string,
  brandID: string
) => {
  let prods: any = {};
  const dbRef = db.ref(
    `Productos/${providerID}/${brandID}/Catalogos/${catalogID}`
  );
  await dbRef.get().then((snapshot) => {
    if (snapshot.exists()) {
      prods = snapshot.val();
    }
  });
  return prods;
};

/**
 * Obiene el historial completo de los productos dado el ID de proveedor y el ID de la marca
 * @param providerID ID del proveedor al que corresponde el historial a consultar
 * @param brandID ID de la marca al que corresponden el historial a consultar
 * @return Nodo Historial completo del proveedor y marca dados
 */
export const getHistoric = async (providerID: string, brandID: string) => {
  let historic: Historic = {};
  const dbRef = db.ref(`Productos/${providerID}/${brandID}/Historial`);
  await dbRef
    .get()
    .then((snapshot) => {
      if (snapshot.exists()) {
        historic = snapshot.val();
      }
    })
    .catch((error) => {
      throw new Error(error);
    });
  return historic;
};

/**
 * Obtiene un item cambio perteneciente a un material generico
 * @param customID numero de material a consultar del nodo Cambios
 * @returns nodo hijo con toda la info del cambio
 */
export const getCambio = async (customID: string) => {
  let cambio: any = {};
  const dbRef = db.ref(`Cambios/${customID}`);
  await dbRef
    .get()
    .then((snapshot) => {
      if (snapshot.exists()) {
        cambio = snapshot.val() as change;
      }
    })
    .catch((error) => {
      throw new Error(error);
    });
  return cambio;
};

/**
 * Guarda la estructura completa de un catálogo en realtime mediante peticiones REST.
 * La estructura es:
 *
 * 1. /Productos/{IDProveedor}/{IDMarca}/Catalogos/{IDCatalogo}
 *
 * 2. /Productos/{IDProveedor}/{IDMarca}/Historial
 *
 * 3. /Productos/{IDProveedor}/{IDMarca}/Productos
 *
 * @param providerID ID del proveedor que subió el catálogo
 * @param brandID ID de la marca del catálogo
 * @param catalogID ID del catálogo en cuestión
 * @param allProducts Es una estructura de tipo {[UPC]: product} que contiene SOLAMENTE la versión más actual de los productos. Actualiza el nodo .../Products
 * @param historic Es una estructura tipo Historic que actualiza el nodo .../Historial
 * @param catalog Es una estructura de tipo {[UPC]: product} que contiene TODOS los productos del catálogo y actualiza el nodo .../Catalogos/{catalogID}
 */
export const saveProductsREST = async (
  providerID: string,
  brandID: string,
  catalogID: string,
  allProducts: productsMap,
  historic: Historic,
  catalog: productsMap
) => {
  console.log("Guardando productos...");

  const baseURL = `${process.env.DATABASE}`;
  const productsURL = `${baseURL}/Productos/${providerID}/${brandID}`;
  const auth = `?auth=${process.env.DATABASE_SECRET}&writeSizeLimit=unlimited`;

  // * GUARDANDO NODO AllProducts
  // await paginarGuardado(
  //   allProducts,
  //   `${baseURL}/AllProducts.json${auth}`,
  //   "ALL PRODUCTS"
  // );

  // * GUARDANDO NODO Productos/Productos
  await paginarGuardado(
    allProducts,
    `${productsURL}/Productos.json${auth}`,
    "PRODUCTOS"
  );

  // * GUARDANDO NODO Productos/Historial
  await paginarGuardado(
    historic,
    `${productsURL}/Historial.json${auth}`,
    "HISTORIAL"
  );

  // * GUARDANDO NODO PRODUCTOS/Catalogos/CatalogID
  await paginarGuardado(
    catalog,
    `${productsURL}/Catalogos/${catalogID}.json${auth}`,
    "CATALOGO"
  );
};

/**
 * Guarda datos del catálogo por páginas, fix agregado porque axios no soporta gran volumen de datos
 * @param data data json que se va a guardar
 * @param url url del nodo a donde se hará la solicitud REST
 * @param type identificador del proceso
 */
const paginarGuardado = async (data: any, url: string, type: string) => {
  const batchSize = 5000; // Tamaño del lote
  const totalPages = Math.ceil(_.keys(data).length / batchSize); // Número total de páginas

  for (let page = 1; page <= totalPages; page++) {
    const startIndex = (page - 1) * batchSize;
    const endIndex = Math.min(startIndex + batchSize, _.keys(data).length);
    const pageData = _.pick(data, _.keys(data).slice(startIndex, endIndex));

    try {
      await axios.patch(
        url,
        { ...pageData },
        { headers: { "Content-Type": "application/json" } }
      );
      console.log(
        `Página ${page} de ${type} guardada (${startIndex + 1}-${endIndex})`
      );
    } catch (error) {
      console.log(
        `Error al guardar página ${page} de ${type}:`,
        (error as Error).message
      );
      throw error;
    }
  }

  console.log(`${type} guardado`);
};

/**
 * Actualiza el nodo Cambios por medio de Rest
 * @param changes nodos hijo a actualizar, la key es el consecutivo generico
 */
export const saveChangesREST = async (changes: Changes) => {
  console.log("Guardando cambios...");

  const changesURL = `${process.env.DATABASE}/Cambios`;
  const auth = `?auth=${process.env.DATABASE_SECRET}&writeSizeLimit=unlimited`;

  // * GUARDANDO NODO Cambios
  await axios
    .patch(`${changesURL}.json${auth}`, { ...changes })
    .then(() => {
      console.log("Cambios guardados", _.keys(changes).length);
    })
    .catch((e) => {
      console.log("Error al guardar Cambios", (e as Error).message);
      throw new Error(e);
    });

  console.log("Se guardaron los cambios!");
};

/**
 * Guarda los resultados de los KBS faltantes en realtime por medio de REST
 * @param kbsResults nodo que se va a guardar
 */
export const saveKBSRest = async (kbsResults: any) => {
  console.log("Guardando resultado kbs...");

  const kbsURL = `${process.env.DATABASE}/MissingKBS`;
  const auth = `?auth=${process.env.DATABASE_SECRET}&writeSizeLimit=unlimited`;

  // * GUARDANDO NODO KBS
  await axios
    .patch(`${kbsURL}.json${auth}`, { ...kbsResults })
    .then(() => {
      console.log("KBS RESULTS guardados");
    })
    .catch((e) => {
      console.log("Error al guardar KBS RESULTS", (e as Error).message);
      throw new Error(e);
    });

  console.log("Se guardaron los kbs results!");
};

/**
 * Obtiene el registro de los KBS faltantes desde realtime
 */
export const getMissingKBS = async () => {
  let missingKBS = {};
  const ref = db.ref(`MissingKBS`);

  await ref.once("value", (data) => {
    missingKBS = data.val() ?? {};
  });

  return missingKBS;
};

/**
 * Guarda los productos de un catálogo que tengan UPC reutilizados (que ya existen en SAP, pero con otro estilo)
 * @param productos productos a guardar
 * @param catalogID catalogID a los que corresponden los productos
 * @param providerID providerID que subio el catálogo
 */
export const saveUPCReutilizados = async (
  productos: any,
  catalogID: string,
  providerID: string
) => {
  console.log("Guardando upc reutilizados...");

  const reutilizadosUPC = `${process.env.DATABASE}/UPCReutilizados/${providerID}/${catalogID}`;
  const auth = `?auth=${process.env.DATABASE_SECRET}&writeSizeLimit=unlimited`;

  // * GUARDANDO NODO Cambios
  await axios
    .patch(`${reutilizadosUPC}.json${auth}`, { ...productos })
    .then(() => {
      console.log("UPC reutilizados guardados", _.keys(productos).length);
    })
    .catch((e) => {
      console.log("Error al guardar UPC reutilizados", (e as Error).message);
      throw new Error(e);
    });

  console.log("Se guardaron los UPC reutilizados!");
};

/**
 * Obtiene un catálogo de realtime dado un ID de proveedor, ID de marca e ID de catálogo
 * @param providerID ID del proveedor que subió el catálogo
 * @param brandID ID de la marca del catálogo
 * @returns un mapa de productos, la key es el UPC
 */
export const getProductsFromProvider = async (
  providerID: string,
  brandID: string
) => {
  try {
    const dbRef = db.ref(`/Productos/${providerID}/${brandID}/Productos`);
    const snapshot = await dbRef.get();
    if (snapshot.exists()) {
      const values = snapshot.val();
      // FILTRAR LOS ACTIVOS
      const actives = Object.values(values).filter((p: any) => p.active ?? true);
      const map = actives.reduce((acc: any, prod: any) => {
        const estilo = prod["Estilo"];
        const { UPC, Talla, ...rest } = prod;
        if (acc[estilo]) {
          acc[estilo].variantes[Talla] = { tallaProveedor: Talla, upc: UPC, edad: prod.Edad ?? "", subgenero: prod.Subgénero ?? "" };
          acc[estilo].Tallas.push(Talla);
        } else {
          let variantes: any = {};
          variantes[Talla] = { tallaProveedor: Talla, upc: UPC, edad: prod.Edad ?? "", subgenero: prod.Subgénero ?? "" };
          acc[estilo] = { ...rest, variantes, Tallas: [Talla] }; // Use the rest of the properties except "upc"
        }
        return acc;
      }, {});
      return map;
    }
    throw new Error(
      `Error inProductos/${providerID}/${brandID}/Productos/ no products where found`
    );
  } catch (error) {
    throw new Error(
      `Error getting data from Productos/${providerID}/${brandID}/Productos/: ${error}`
    );
  }
};
