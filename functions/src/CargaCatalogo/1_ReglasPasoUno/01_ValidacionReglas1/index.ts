import {
  CatalogRules,
  FieldRules,
  ObjectValidator,
} from "@fridaplatform-stk/motor-reglas";
import {
  gerProviderByIDSAP,
  getAppConfig,
  getBrandByIdSAP,
  getCatalogsByProvider,
  getDocRefId,
  getOneRuleItem,
  saveDocWithID,
} from "../../../z_helpers/firestoreServices";
import _ = require("lodash");
import { saveFile } from "../../../z_helpers/storageServices";
import {
  Brand,
  PreprocessingRules,
  appConfig,
  catalog,
} from "../../../interfaces/CargaCatalogo";
import { Timestamp } from "firebase-admin/firestore";
import { User } from "../../../interfaces/user";
import { getPreprocessingRules } from "../../services";
import { getSimple } from "../../../AltaMateriales/z_sendSegment/helpers/helperCatalogs";

/**
 * Este método recibe, en formato json, un nuevo catálogo y le aplica las reglas de validación simples o de formato.
 * La idea es accionar el proceso de carga de catálogo desde backend.
 *
 * * NOTA: CADA QUE SE LLAME ESTA API, VA A CREAR UN NUEVO CATÁLOGO (SUPONIENDO QUE PASE LA VALIDACIÓN)
 * * LO QUE ACCIONARÁ LA API onCreate Y EJECUTARÁ EL RESTO DE LAS VALIDACIONES Y TRANSFORMACIONES
 */
export const applySimpleRules = async (
  c: any[],
  cabecera: {
    "ID Catálogo": number;
    "ID proveedor SAP": string;
    Temporada: string;
    "ID Marca": string;
    Año: number;
  },
  user: User
) => {
  let res: any = {};

  // OBTENER DE CABECERA LA MARCA Y EL ID SAP
  const idBrandSAP = cabecera["ID Marca"],
    idProviderSAP = cabecera["ID proveedor SAP"];

  // OBTENER REGISTROS DE BD PARA LOS DATOS DE CABECERA
  const brand: Brand[] = await getBrandByIdSAP(idBrandSAP);
  const provider: any[] = await gerProviderByIDSAP(idProviderSAP);

  // * VALIDAR MARCA Y PROVEEDOR
  console.log("validando marca y proveedor...");
  const brandRes = await checkBrandProvider(idBrandSAP, provider, brand, user);

  if (brandRes === "") {
    const providerName = provider[0].identificacion.nombreComercial.value;
    const sociedad = provider[0].IDSociedad ?? "1001";
    const providerID = provider[0].doc_id;

    // * APLICAR PREPROCESAMIENTO
    console.log("aplicando preprocesamiento");
    const catalog = await aplicarPreProcesamiento(c);

    // * COMBINAR INFO
    console.log("obteniendo appConfig...");
    const appConfig: appConfig = await getAppConfig();
    const sheetMap = {
      [appConfig["catalogSheetData"]]: [cabecera],
      [appConfig["catalogSheetProducts"]]: catalog,
    };

    // * OBTENER LAS REGLAS
    console.log("obteniendo reglas...");
    let simpleRules: CatalogRules = await getOneRuleItem("SimpleRules");
    // ? AGREGAR REGLAS DINÁMICAS
    simpleRules = await addDynamicRules(
      simpleRules,
      appConfig,
      providerID,
      sociedad.toString()
    );

    // * APLICAR REGLAS
    console.log("aplicando reglas...");
    // las reglas se aplican desde la libreria motor-de-reglas
    const result = ObjectValidator(simpleRules, sheetMap, {});

    if (_.isEmpty(result)) {
      console.log("pasó validación de reglas!");
      // * PASÓ LA VALIDACIÓN DE REGLAS
      res = await handleSuccess(
        sheetMap,
        cabecera,
        catalog,
        appConfig,
        brand[0],
        providerID,
        providerName,
        sociedad,
        result
      );
      res.error = false;
    } else {
      let errors = false;
      for (const r of _.values(result)) {
        if (r.errors) {
          errors = true;
          break;
        }
      }

      if (errors) {
        // * NO PASÓ ALGUNA REGLA
        console.log("no pasó validación de reglas");

        res.validationResults = await saveOutput(providerID, sheetMap, result);
        res.error = true;
      } else {
        // * SOLO HAY WARNINGS
        console.log("pasó validación de reglas, pero hay warnings");
        res = await handleSuccess(
          sheetMap,
          cabecera,
          catalog,
          appConfig,
          brand[0],
          providerID,
          providerName,
          sociedad,
          result
        );
        res.error = false;
      }
    }
  } else {
    res.msg = brandRes;
    res.error = true;
  }

  return res;
};

/**
 * Aplica el "preprocesamiento" a un grupo de objetos (productos), simulando el comportamiento de react.
 * El "preprocesamiento" es un tratamiento que se les aplica a los productos del catálogo antes de aplicar las reglas de formato.
 * El "preprocesamiento" puede: quitar acentos, realizar casing y reemplazar caracteres. Esto de acuerdo a las reglas almacenadas en firebase.
 * @param catalog arreglo de productos
 * @returns arreglo de productos pre procesados
 */
export const aplicarPreProcesamiento = async (catalog: any[]) => {
  const updated = _.cloneDeep(catalog);

  // OBTENER LAS REGLAS DE BD
  const rules: PreprocessingRules = await getPreprocessingRules();

  // HELPERS PARA EL PROCESO
  const replacements = new Map([
    ["Á", "A"],
    ["Í", "I"],
    ["Ú", "U"],
    ["É", "E"],
    ["Ó", "O"],
    ["á", "a"],
    ["í", "i"],
    ["ú", "u"],
    ["é", "e"],
    ["ó", "o"],
  ]);
  const regexAcentos = new RegExp("[ÁÍÚÉÓáíúéó]", "g");
  const regexReplaced = new RegExp("[" + rules.replacedCharacters + "]", "g");
  const newReplace = rules.replacement ? rules.replacement : "";

  // recorrer cada producto
  for (const prod of updated) {
    // si existe la regla de casing, hacer la transformacion en los objetos
    if (rules.casing) {
      // recorrer todos los campos del objeto
      _.keys(prod).forEach((field) => {
        // hacer transformaciones debidas
        switch (rules.casing) {
          case "toCaps":
            if (prod[field].toUpperCase) {
              prod[field] = prod[field].toUpperCase();
            }
            break;
          case "toLower":
            if (prod[field].toLowerCase) {
              prod[field] = prod[field].toLowerCase();
            }
            break;
          case "capitalize":
            if (prod[field].split) {
              prod[field] = prod[field].split(" ").forEach((palabra: any) => {
                palabra =
                  palabra.charAt(0).toUpperCase() +
                  palabra.slice(1).toLowerCase();
              });
            }
            break;
          default:
            break;
        }
      });
    }

    // si existe la regla de quitar acentos, hacer el replace
    if (rules.mantenerAcentos === false) {
      // reemplazar el valor del campo del objeto
      _.keys(prod).forEach((field) => {
        if (prod[field].replace) {
          prod[field] = prod[field].replace(regexAcentos, function (x: string) {
            return replacements.get(x);
          });
        }
      });
    }

    // si existe la regla de reemplazar caracteres
    if (rules.replacedCharacters) {
      // recorrer cada campo del objeto
      _.keys(prod).forEach((field) => {
        if (prod[field].replace) {
          prod[field] = prod[field].replace(regexReplaced, newReplace);
        }
      });
    }

    try {
      // RECORTAR LONGITUD DE ALGUNOS CAMPOS
      if (rules.substring) {
        const rs = rules.substring;
        const excluded = rs._excluded ?? [];

        _.keys(prod).forEach((field) => {
          if (!excluded.includes(field)) {
            const max = rs[field] ?? rs._default ?? prod[field].length;
            prod[field] = prod[field].substring(0, max);
          }
        });
      }
    } catch (error) {}
  }

  return updated;
};

/**
 * Este método...
 * 1. Guardar el json de cabecera y detalles en storage
 * 2. Crear documento del catálogo en firestore

 * @param cabecera json cabecera
 * @param catalog json de los productos
 * @param appConfig configuración en firebase que indica algunos campos clave
 * @param brand marca del catálogo
 * @param providerID id proveedor
 * @param providerName nombre del proveedor
 * @return ID del documento catálogo creado
 */
const handleSuccess = async (
  input: any,
  cabecera: any,
  catalog: any,
  appConfig: appConfig,
  brand: Brand,
  providerID: string,
  providerName: string,
  sociedad: "1001" | "2001",
  warnings?: any
) => {
  console.log("handle success");
  let res: any = { catalogID: "" };

  // * GET DATOS DE CABECERA
  const catalogID = cabecera[appConfig["fieldIdCatalog"]];
  const brandIdSAP = cabecera[appConfig["fieldIdBrand"]];
  const providerIdSAP = cabecera[appConfig["fieldIdSAPProvider"]];
  const q = cabecera[appConfig["fieldSeason"]];
  const y = cabecera[appConfig["fieldYear"]];

  // * ARMAR PATHS
  const docID = getDocRefId("catalogs");
  const rootPath = `catalogs/${providerID}/${docID}`;
  const allProductsPath = `${rootPath}/products-${catalogID}.json`;
  const cabeceraPath = `${rootPath}/cabecera-${catalogID}.json`;

  // * GUARDAR DATOS DEL CATÁLOGO
  await saveFile(JSON.stringify([cabecera]), cabeceraPath);
  await saveFile(JSON.stringify(catalog), allProductsPath);

  // * ARMAR CATÁLOGO (DOC)
  const catalogDoc: catalog = {
    doc_id: docID,
    brand_id: brand.id ?? brandIdSAP,
    brand_idSAP: brand.SAP_id,
    brand_name: brand.name,
    catalog_id: catalogID.toString(),
    current: true,
    date_uploaded: Timestamp.fromDate(new Date()),
    item_status: {
      total: _.keys(catalog).length,
    },
    paths: {
      all_products: allProductsPath,
      cabecera: cabeceraPath,
      catalog: "",
      root: rootPath,
    },
    provider_id: providerID,
    provider_name: providerName,
    season: {
      name: q,
      year: y,
    },
    provider_idSAP: providerIdSAP,
    status: "enviado",
    carga: "AUTO",
    filters: {},
    sociedad_SAP: sociedad,
  };

  // * GUARDAR CATÁLOGO (DOC)
  try {
    await saveDocWithID("catalogs", catalogDoc, docID);
    res.catalogID = docID;
    // ! AQUÍ SE ACCIONA EL API reglasPasoDos_onCreate (valida reglas 2 y realiza transformaciones)
  } catch (error) {
    throw new Error(
      `Error creando catálogo, proveedor ${providerID}, brand ${brand.id}, doc ${docID}`
    );
  }

  if (!_.isEmpty(warnings)) {
    // ? solo si hay warnings guardar el result
    console.log("warnings");
    const path = await saveOutput(providerID, input, warnings, docID);
    res = { ...res, validationResults: path };
  }

  return res;
};

/**
 * Este método...
 * 1. Guardar los resultados de la validación en storage
 * 2. Guardar en storage la data recibida en el body
 *
 * @param provider proveedor del catálogo
 * @param input json cabecera y catálogo combinados
 * @param results resultados de la validación
 * @return path donde se guardaron los resultados y el input
 */
const saveOutput = async (
  providerID: string,
  input: any,
  results?: any,
  catalog?: string
) => {
  // * GUARDAR INFO
  const date = new Date().toISOString().split(".")[0];
  const rootPath = `SimpleRulesResults/${providerID}/${date}${
    catalog ? ` - ${catalog}` : ""
  }`;

  if (!catalog) {
    // ? solo si no se escribió el catálogo se guarda el input
    const inputPath = `${rootPath}/input.json`; // incluye cabecera y productos (Catálogo)
    await saveFile(JSON.stringify(input), inputPath);
  }

  if (!_.isEmpty(results)) {
    // ? solo si hay resultados se guardan...
    const failedResultsPath = `${rootPath}/results.json`;
    await saveFile(JSON.stringify(results), failedResultsPath);
  }

  return rootPath;
};

/**
 * Verifica si...
 * 1. La marca es válida
 * 2. El proveedor es válido
 * 3. El proveedor tiene permiso de subir catálogos de esa marca
 * @param idBrandSAP id SAP de la marca pasado en el body
 * @param idProvider id del proveedor
 * @param brand objeto marca obtenido
 * @param provider objeto proveedor obtenido
 */
const checkBrandProvider = async (
  idBrandSAP: string,
  provider: any[],
  brand: Brand[],
  user: User
) => {
  let msg = "";

  // * VALIDA QUE EL PROVEEDOR EXISTA Y SOLO HAYA UN REGISTRO CON ESE ID SAP
  if (provider.length === 1) {
    // * VALIDAR USUARIO QUE ESTÁ LLAMANDO LA API
    const providerID = provider[0].doc_id;

    if (user.roles.includes("proveedor")) {
      // ! EL USUARIO QUE LLAMÓ LA API ES PROVEEDOR
      // * VALIDAR QUE USUARIO QUE LLAMÓ LA API PERTENECE A LA ORGANIZACIÓN DEL PROVEEDOR
      const organization: any[] = provider[0].organization;
      const index = organization.findIndex((o) => o.uid === user.uid);

      if (user.docProviderOrg !== providerID || index === -1) {
        console.log(
          `El usuario no tiene permiso para el proveedor ${providerID}`
        );
        msg = "Missing permissions -1";
      }
    } else {
      // SERVICE Y TESTER NO VALIDA PERMISOS SOBRE PROVEEDOR...
    }

    // * VALIDAR MARCA EN BASE DE DATOS, QUE EXISTA Y HAYA SOLO UN REGISTRO
    if (brand.length === 0) {
      console.log(`Error al obtener la marca ${idBrandSAP}`);
      msg = "Invalid brand -1";
    } else if (brand.length > 1) {
      console.log(
        `Error al obtener la marca ${idBrandSAP}, hay más de una marca con el mismo ID SAP`
      );
      msg = "Invalid brand 1";
    }

    // * VALIDA QUE EL PROVEEDOR TENGA PERMISO PARA ESTA MARCA
    if (
      !(
        provider[0].brands &&
        provider[0].brands[brand[0].id] &&
        provider[0].brands[brand[0].id].SAP_id === idBrandSAP
      )
    ) {
      console.log(
        `El proveedor ${provider[0].doc_id} no tiene permiso para la marca ${idBrandSAP}-${brand[0].id}`
      );
      msg = "Missing permissions 1";
    }
  } else {
    console.log(`Hay 0 o > 2 proveedores con el idSAP`);
    msg = "Invalid provider";
  }

  return msg;
};

/**
 * Agrega reglas a la configuración en tiempo de ejecución
 * @param catalogRules reglas actuales
 * @param appConfig configuración en firebase que indica algunos campos clave
 * @param providerID id del proveedor
 * @return nuevo mapa de reglas
 */
const addDynamicRules = async (
  catalogRules: CatalogRules,
  appConfig: appConfig,
  providerID: string,
  sociedad: string
) => {
  console.log("agregando reglas dinamicas...");
  const catalogSheet = appConfig.catalogSheetData; // CABECERA
  const productsSheet = appConfig.catalogSheetProducts; //DETALLES
  const rulesTemp = _.cloneDeep(catalogRules) ?? {};

  // * NO PERMITIR IDS DE CATÁLOGO DUPLICADOS
  const allDocCatalogs: catalog[] = await getCatalogsByProvider(providerID);
  const allCatalogs: string[] = allDocCatalogs.map((c) => c.catalog_id);

  const ruleCatDupes: FieldRules = {
    field: `${appConfig.fieldIdCatalog}`,
    notIn: [...allCatalogs],
    priority: "error",
    description: "No se permite un ID que ya exista en el sistema",
  };

  // ? obtener la regla si ya existe con el notIn
  let dupCatID: number = 0;
  if (rulesTemp[catalogSheet] && rulesTemp[catalogSheet].sheetsRules) {
    dupCatID = rulesTemp[catalogSheet].sheetsRules.findIndex(
      (r) => r.notIn && r.field === appConfig.fieldIdCatalog
    );
  }

  if (dupCatID === -1) {
    // agregar el campo de ids del catálogo
    if (allCatalogs.length > 0) {
      rulesTemp[catalogSheet].sheetsRules.push(ruleCatDupes);
    }
  } else {
    rulesTemp[catalogSheet].sheetsRules[dupCatID].notIn = [
      ...rulesTemp[catalogSheet].sheetsRules[dupCatID].notIn!,
      ...allCatalogs,
    ];
  }

  // * EL AÑO DEBE SER IGUAL O MAYOR QUE EL AÑO ACTUAL
  let date = new Date();
  let anioActual = date.getFullYear();
  let next = date.getFullYear() + 1;
  let ant = date.getFullYear() - 1;

  const ruleYear: FieldRules = {
    field: `${appConfig.fieldYear}`,
    hasToBeInNumber: [anioActual, next, ant],
    priority: "error",
    description: `El año del catálogo debe ser el año anterior (${ant}), el año actual (${anioActual}) o el año siguiente (${next}).`,
  };

  let dupYear = -1;
  if (rulesTemp[catalogSheet] && rulesTemp[catalogSheet].sheetsRules) {
    dupYear = rulesTemp[catalogSheet].sheetsRules.findIndex(
      (r) => r.field === appConfig.fieldYear && r.hasToBeInNumber
    );
  }

  if (dupYear === -1) {
    rulesTemp[catalogSheet].sheetsRules.push(ruleYear);
  } else {
    rulesTemp[catalogSheet].sheetsRules[dupYear] = ruleYear;
  }

  // Agregar regla para disponible desde el año debe ser igual al actual o el siguiente
  let ruleDisponibleDesde: FieldRules = {
    field: `Disponible desde`,
    checkRegex: `^(0[1-9]|[1-2][0-9]|3[0-1]])(.)(0[1-9]|1[0-2])(.)(${anioActual}|${next}|${ant})$`,
    priority: "error",
    description: `El año del campo debe ser el anterior (${ant}), actual (${anioActual}) o el siguiente (${next}).`,
  };

  rulesTemp[productsSheet].sheetsRules.push(ruleDisponibleDesde);

  // * BANNERS POR SOCIEDAD
  const bannersPorSociedad = await getSimple("BannersPorSociedad", sociedad);
  const banners = Object.values(bannersPorSociedad);

  let ruleBannerSociedad: FieldRules = {
    field: `Banners propuestos`,
    hasToBeIn: banners,
    priority: "error",
    description: `Los únicos valores aceptados son: ${banners.join(", ")}`,
  };

  rulesTemp[productsSheet].sheetsRules.push(ruleBannerSociedad);

  return rulesTemp;
};
