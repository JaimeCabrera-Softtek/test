import _ = require("lodash");
import { catalog } from "../../../interfaces/CargaCatalogo";
import { getJSON } from "../../../z_helpers/storageServices";
import {
  getHeadersPermitidos,
  saveResults,
  updateItemStatus,
  updateStatus,
} from "../../services";
import { saveProducts } from "./saveProducts";
import {
  getMissingKBS,
  saveKBSRest,
} from "../../../z_helpers/realtimeServices";
import { SendMailObj, sendMail } from "../../../z_helpers/sendmail";
import { firestore } from "../../../firebase";
import { User } from "../../../interfaces/user";
import { sendMailJerarquias } from "../03_Transformaciones/jerarquiasSolicitadass";

export const saveProcessResults = async (
  results: any[],
  catalog: catalog,
  isError: boolean
) => {
  // * GUARDAR RESULTADOS
  const finalResults = await getFinalResults(results);

  await saveFinalResults(
    finalResults.finalResults,
    finalResults.errorTallas,
    finalResults.missingKBS,
    finalResults.saveKBS,
    catalog,
    isError,
    finalResults.jerarquias
  );
};

/**
 * De los resultados de los batches, obtiene la estructura para guardar los resultados en bd
 * @param batchesResults arreglo de resultados del proceso de transformación
 * @returns datos condensados de los resultados de los batches
 */
const getFinalResults = async (batchesResults: any[]) => {
  let finalResults: any = {
    errorObjects: [],
    okObjects: [],
    unknowns: {},
  };

  let errorTallas: any[] = [];
  let jerarquias: string[] = [];
  let saveKBS = false;
  let missingKBS: any = await getMissingKBS();

  _.values(batchesResults).forEach((b) => {
    finalResults["errorObjects"] = [
      ...finalResults["errorObjects"],
      ...b.transformationResult["errorObjects"],
    ];

    finalResults["okObjects"] = [
      ...finalResults["okObjects"],
      ...b.transformationResult["okObjects"],
    ];

    finalResults["unknowns"] = {
      ...finalResults["unknowns"],
      ...b.transformationResult["unknowns"],
    };

    errorTallas = [...errorTallas, ...b.errorTallas];

    // * MERGE DE LOS KBS FALTANTES
    _.entries(b.kbsResults).forEach(([field, v]) => {
      _.entries(v as any).forEach(([conditions, nodo]) => {
        const n = nodo as any;
        if (!missingKBS[field]) {
          missingKBS[field] = {};
        }

        if (!missingKBS[field][conditions]) {
          missingKBS[field][conditions] = {};
        }

        missingKBS[field][conditions] = {
          ...missingKBS[field][conditions],
          ...n,
        };

        saveKBS = true;
      });
    });

    jerarquias = jerarquias.concat(b.jerarquias);
  });

  const sinRepetir = Array.from(new Set(jerarquias));

  return {
    finalResults,
    errorTallas,
    missingKBS,
    saveKBS,
    jerarquias: sinRepetir,
  };
};

/**
 * Guarda los resultados de las transformaciones
 * @param transformationResult resultados
 * @param errorTallas productos que tienen error en las tallas, se guardan como error para el proveedor, están a este nivel del proceso porque se tienen que aplicar a los productos ya transformados
 * @param catalog doc de firestore que estamos trabajando
 * @param isError false: se está realizando el proceso de validación por primera vez (trigger onCreate)
 * true: se está realizando el proceso para reevaluar las transformaciones del catálogo (función HTTP)
 */
const saveFinalResults = async (
  transformationResult: any,
  errorTallas: any[],
  missingKBS: any,
  saveKBS: boolean,
  catalog: catalog,
  isError: boolean,
  jerarquias: string[]
) => {
  const rootPath = catalog.paths.root;

  // * GUARDAR ERRORES DE TALLAS COMO ERRORES DE PROVEEDOR
  if (errorTallas.length > 0) {
    console.log("guardando errores de tallas");

    let errores = [];
    let oldErrores = [];

    // si existe la root path, traerse de storage los antiguos errores (obtenidos en el paso 2)
    try {
      oldErrores = await getJSON(`${rootPath}/error_rules2_provider.json`);
    } catch (error) {}

    // nuevos errores que se van a guardar en storage
    errores = [...oldErrores, ...errorTallas];

    if (errores.length > 0) {
      // * GUARDAR LOS OBJETOS CON ERRORES EN LAS REGLAS COMPLEJAS
      // guardar status en el documento
      await updateItemStatus(
        catalog.doc_id,
        "total_error_provider",
        errores.length
      );

      // guarda arreglo de objetos en storage
      await saveResults(
        errores,
        `${rootPath}/error_rules2_provider.json`,
        catalog.doc_id,
        "error_rules2"
      );
    }
  }

  // * GUARDAR ERRORES DE TRANSFORMACION
  // ! IMPORTANTE GUARDAR AUNQUE VENGAN VACIOS, NO HACER VALIDACIÓN EMPTY
  // objeto de errores, por productos y condensados
  const errorJSON = {
    products: transformationResult.errorObjects,
    condensed: transformationResult.unknowns,
  };

  // guardar json con los resultados erroneos
  await saveResults(
    errorJSON,
    `${rootPath}/error_transformations_mdm.json`,
    catalog.doc_id,
    "error_transformations"
  );

  // guardar status en el documento
  await updateItemStatus(
    catalog.doc_id,
    "total_error_MDM",
    transformationResult.errorObjects.length
  );

  let updatedFilters: any = { Deporte: { items: [] } };
  // * GUARDAR PRODUCTOS OK
  if (transformationResult.okObjects.length > 0) {
    const cleanProducts = await clearProducts(transformationResult.okObjects);

    updatedFilters = await saveProducts(catalog, cleanProducts);
  }

  // * GUARDAR MISSING KBS
  if (saveKBS) {
    await saveKBSRest(missingKBS);
    await sendMail_KBSNOTransformados(missingKBS);
  }

  // * ACTUALIZAR STATUS DEL CATÁLOGO
  // ? hay errores de transformación ?
  if (transformationResult.errorObjects.length > 0) {
    // status = revision
    await updateStatus(catalog.doc_id, "revision");

    if (!isError) {
      await sendMail_CatalogoNOTransformado(
        catalog,
        transformationResult.errorObjects.length
      );
    }
  } else {
    // status = aprobado
    await updateStatus(catalog.doc_id, "aprobado");
    if (!_.isEmpty(updatedFilters)) {
      await sendMail_CatalogoTransformado(catalog, updatedFilters);
    }
  }

  if (jerarquias.length > 0) {
    await sendMailJerarquias(jerarquias, catalog);
  }

  console.log("save results end");
};

/**
 * Enviar correo avisando a los compradores que el catálogo está listo para su selección.
 * @param catalog Objeto del catálogo en Firestore
 * @param newFilters filtros actualizados que no están en el catálogo local
 */
const sendMail_CatalogoTransformado = async (
  catalog: catalog,
  newFilters: any
) => {
  /**
   * Deportes que contiene este catálogo
   */
  let deportes: string[] = newFilters.Deporte.items;
  if (
    catalog.filters &&
    catalog.filters.Deporte &&
    catalog.filters.Deporte.items
  ) {
    deportes = Array.from(
      new Set([...deportes, ...catalog.filters.Deporte.items])
    );
  }

  /**
   * ? LIMIT: Use the array-contains-any operator to combine up to 30 array-contains clauses on the same field with a logical OR
   */
  const queryCompradores = firestore
    .collection("users")
    // .where("roles", "array-contains", "compras") // ! SOLO PERMITE UN ARRAY CONTAINS, EN TEORIA LOS UNICOS USUARIOS CON EL CAMPO deportes SON COMPRADORES
    .where("deportes", "array-contains-any", deportes);

  const users_docs = (await queryCompradores.get()).docs;
  const user_compradores = users_docs.filter(
    (x) =>
      (x.data() as User).roles.includes("compras") &&
      (x.data() as User).IDSociedad === catalog.sociedad_SAP // solo se notifica a los compradores de la sociedad
  );
  const users_mails: string[] = user_compradores.map(
    (x) => (x.data() as User).email
  );

  //Preparación del correo
  const obj: SendMailObj = {
    To: users_mails,
    Subject: "Catálogo listo para selección",
    Body: `Hay un catálogo nuevo, listo para su selección. Catálogo ${catalog.catalog_id}.`,
    isHTML: true,
    HTMLBody: `<body>
              <p>Hay un catálogo nuevo, listo para su selección.</p>
              <table>
                <tr>
                  <td>ID Catálogo</td>
                  <td>${catalog.catalog_id}</td>
                </tr>
                <tr>
                  <td>Marca</td>
                  <td>${catalog.brand_name}</td>
                </tr>
                <tr>
                  <td>Proveedor</td>
                  <td>${catalog.provider_name}</td>
                </tr>
                <tr>
                  <td>Temporada</td>
                  <td>${catalog.season.year} - ${catalog.season.name}</td>
                </tr>
                <tr>
                  <td>Productos (UPC)</td>
                  <td>${catalog.item_status.total}</td>
                </tr>
              </table>
          </body>`,
  };
  //Enviar el correo
  await sendMail(obj);

  console.log("correos a compras enviados");
};

/**
 * Enviar correo avisando a los datos maestros (mdm) cuando haya un catálogo NUEVO con errores de trasnformación.
 * @param catalog Objeto del catálogo en Firestore
 * @param total Total de UPC con errores de transformación
 */
const sendMail_CatalogoNOTransformado = async (
  catalog: catalog,
  total: number
) => {
  const queryMDM = firestore
    .collection("users")
    .where("roles", "array-contains", "mdm");

  const user_mdm = (await queryMDM.get()).docs;
  const users_mails: string[] = user_mdm.map((x) => (x.data() as User).email);

  //Preparación del correo
  const obj: SendMailObj = {
    To: users_mails,
    Subject: "Catálogo con errores de transformación",
    Body: `Hay un catálogo nuevo con errores de transformación. Catálogo ${catalog.catalog_id}.`,
    isHTML: true,
    HTMLBody: `<body>
              <p>Hay un catálogo nuevo con errores de transformación.</p>
              <table>
                <tr>
                  <td>ID Catálogo</td>
                  <td>${catalog.catalog_id}</td>
                </tr>
                <tr>
                  <td>Marca</td>
                  <td>${catalog.brand_name}</td>
                </tr>
                <tr>
                  <td>Proveedor</td>
                  <td>${catalog.provider_name}</td>
                </tr>
                <tr>
                  <td>Temporada</td>
                  <td>${catalog.season.year} - ${catalog.season.name}</td>
                </tr>
                <tr>
                  <td>Total de errores</td>
                  <td>${total} UPC</td>
                </tr>
              </table>
          </body>`,
  };

  //Enviar el correo
  await sendMail(obj);

  console.log("correos de error en transformación enviados");
};

/**
 * Enviar correo avisando a los datos maestros (mdm) cuando haya un catálogo NUEVO con KBS que no se transformaron.
 * @param catalog Objeto del catálogo en Firestore
 * @param totalKBS Total de KBS no transformados
 */
const sendMail_KBSNOTransformados = async (kbs: any) => {
  const queryMDM = firestore
    .collection("users")
    .where("roles", "array-contains", "mdm");

  const user_mdm = (await queryMDM.get()).docs;
  const users_mails: string[] = user_mdm.map((x) => (x.data() as User).email);

  let tableHTML = "";

  Object.entries(kbs).forEach(([campo, mapaDelCampo]) => {
    tableHTML += `<tr><td><b>${campo}</b></td></tr>`;
    Object.entries(mapaDelCampo as any).forEach(([condiciones, missingKBS]) => {
      if (condiciones !== "NO CONDITIONS") {
        tableHTML += `<tr><td>Donde ${condiciones}</td></tr>`;
      }

      Object.keys(missingKBS as any).forEach((kbs) => {
        tableHTML += `<tr><td><li>${kbs}</li></td></tr>`;
      });
      tableHTML += `<tr><td><br/></td></tr>`;
    });
  });

  //Preparación del correo
  const obj: SendMailObj = {
    To: users_mails,
    Subject: "KBS no transformados",
    Body: `Hay nuevos KBS que no se pudieron transformar.`,
    isHTML: true,
    HTMLBody: `<body>
      <p>Hay nuevos KBS que no se pudieron transformar./p>
      <table><tbody>${tableHTML}</tbody></table>
    </body>`,
  };

  //Enviar el correo
  await sendMail(obj);

  console.log("correos de KBS enviados");
};

const clearProducts = async (products: any[]) => {
  const headersPermitidos = await getHeadersPermitidos();
  return products.map((p) =>
    headersPermitidos.reduce((cleanP: any, h: string) => {
      if (p[h]) {
        cleanP[h] = p[h];
      }
      return cleanP;
    }, {})
  );
};
