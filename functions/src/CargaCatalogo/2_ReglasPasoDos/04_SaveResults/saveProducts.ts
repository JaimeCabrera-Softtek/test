import _ = require("lodash");
import {
  Changes,
  Historic,
  appConfig,
  catalog,
  change,
  changesLog,
  productsMap,
} from "../../../interfaces/CargaCatalogo";
import {
  getHistoric,
  getMateriales,
  saveChangesREST,
  saveProductsREST,
  saveUPCReutilizados,
} from "../../../z_helpers/realtimeServices";
import {
  updateFilters,
  updateItemStatus,
  updateUpdateDate,
} from "../../services";
import { getAppConfig } from "../../../z_helpers/firestoreServices";

/**
 * Método reutilizable que procesa un arreglo de productos y les da formato para que puedan guardarse en realtime con la estrctura
 *
 * 1. /Productos/{IDProveedor}/{IDMarca}/Catalogos/{IDCatalogo}
 * 2. /Productos/{IDProveedor}/{IDMarca}/Historial *
 * 3. /Productos/{IDProveedor}/{IDMarca}/Productos
 *
 * También detecta cambios contra el nodo db_materiales/Materiales y los almacenaen storage.
 * Todas las rutas son almacenadas en el documento del catálogo.
 * @param catalogDoc Objeto catálogo
 * @param products arreglo de objetos que conforman el catálogo
 */
export const saveProducts = async (catalogDoc: catalog, products: any[]) => {
  // ** GUARDAR PRODS OK, SE SUMAN A LOS QUE YA ESTABAN, SE CREAN SI NO ESTABAN
  console.log("Procesando productos...");
  const providerID = catalogDoc.provider_id;
  const providerID_SAP = catalogDoc.provider_idSAP;
  const provider_name = catalogDoc.provider_name;
  const catalog_id = catalogDoc.catalog_id;
  const brandID = catalogDoc.brand_id;
  const brand_name = catalogDoc.brand_name;
  const brand_sap = catalogDoc.brand_idSAP;
  const catalogID = catalogDoc.doc_id;
  const date = catalogDoc.date_uploaded.toDate().toISOString().split(".")[0];
  const totalOldOk = catalogDoc.item_status.total_ok ?? 0;
  const q = `${catalogDoc.season.year}${catalogDoc.season.name}`;
  const totalReutilizadosOld = catalogDoc.item_status.total_reutilizados ?? 0;
  const sociedad = catalogDoc.sociedad_SAP;

  // * Testing
  const filters = catalogDoc.filters ? catalogDoc.filters : {};
  const headersForFilters = [
    "Talla",
    "Género",
    "Deporte",
    "División",
    "Silueta",
    "Banners propuestos",
  ];

  /** TODOS los productos del catálogo */
  const catalog: productsMap = {};
  /** Se va armando el historial de los productos subidos */
  const newHistorial: Historic = {};
  /** Es un mapa que contiene SOLAMENTE los productos que sean la versión más actual de ellos mismos.
   *  Es decir, si había un producto registrado en realtime con una fecha mayor que la fecha de este catálogo, ese
   *  producto NO aparecerá en este mapa porque ya tenía una versión más actual en realtime.
   *  Esta estructura actualiza el nodo .../Productos*/
  const newProducts: productsMap = {};
  /** Historial actual del proveedor/marca */
  const histActual = await getHistoric(providerID, brandID);

  // * INICIA VERIFICACIÓN DE CAMBIOS
  /** Productos que ya se dieron de alta en SAP */
  const productsSAP: productsMap = await getMateriales(brandID);

  /** Mapa de UPC cambiados */
  let changedUPC: {
    [Estilo: string]: {
      generico: string;
      varianteSAP: string[];
      variantesIBN: string[];
      changes: changesLog;
      precios: {
        compra: any;
        venta: any;
      };
      name: string;
    };
  } = {};

  const appConfig: appConfig = await getAppConfig();

  /** Son los campos que se van a checar para detectar cambios */
  const fieldsToCheck: { [fieldSAP: string]: string } =
    appConfig.fieldsToCheckChanges;

  /** Son los UPC reutilizados */
  let reutilizados: any = {};

  // por cada producto de la nueva lista de productos
  // ? VERIFICAR SI HUBO CAMBIOS, SOLO CON PRODUCTOS QUE YA SE DIERON DE ALTA EN SAP
  for (const product of products) {
    let reutilizado = false;
    const UPC = product.UPC;
    const fields: { [field: string]: string } = {};
    const productSAP: any = productsSAP[UPC];

    // ? ESTE PRODUCTO YA FUE DADO DE ALTA EN SAP, REVISAR SI TIENE CAMBIOS
    if (productSAP) {
      // ? SI EL MATERIAL EN SAP TIENE UN ESTILO DIFERENTE QUE EL NUEVO PRODUCTO, ES UN UPC REUTILIZADO
      if (productSAP["Estilo"] !== product["Estilo"]) {
        reutilizado = true;
        reutilizados[UPC] = product;
      } else {
        // iterar cada campo que se tiene que verificar cambios
        for (const [fieldSAP, field] of _.entries(fieldsToCheck)) {
          if (fieldSAP === "Precio_compra") {
            if (
              productSAP["Precios_compra"][sociedad] &&
              productSAP["Precios_compra"][sociedad].toString().trim() !==
                product[field].toString().trim()
            ) {
              fields[field] = fieldSAP;
            }
          } else if (fieldSAP === "Precio_venta") {
            if (
              productSAP["Precios_venta"][sociedad] &&
              productSAP["Precios_venta"][sociedad].toString().trim() !==
                product[field].toString().trim()
            ) {
              fields[field] = fieldSAP;
            }
          } else {
            if (!productSAP[fieldSAP]) {
              if (product[field]) {
                fields[field] = fieldSAP;
              }
            } else if (!product[field]) {
              if (productSAP[fieldSAP]) {
                fields[field] = fieldSAP;
              }
            } else if (
              productSAP[fieldSAP].toString().trim() !==
              product[field].toString().trim()
            ) {
              fields[field] = fieldSAP;
            } else {
              // NO HUBO CAMBIOS
            }
          }
        }
      }
    } else {
      // aun no se da de alta, no ha cambiado
    }

    // ? si no es reutilizado
    if (!reutilizado) {
      // ? Hubo cambios
      if (!_.isEmpty(fields)) {
        // * Si hay cambios para este UPC, ir armando la estructura de cambios
        if (!changedUPC[product.Estilo]) {
          const tempChanges: any = {};

          // por cada campo detectado con cambios, crear un registro del valor antes y después del cambio, log
          for (const [field, fieldSAP] of _.entries(fields)) {
            let before = "";

            switch (fieldSAP) {
              case "Precio_compra":
                before = productSAP["Precios_compra"][sociedad];
                break;
              case "Precio_venta":
                before = productSAP["Precios_venta"][sociedad];
                break;
              default:
                before = productSAP[fieldSAP];
                break;
            }

            tempChanges[fieldSAP] = {
              before: before,
              after: product[field],
            };
          }

          // valores de cabecera...
          changedUPC[product.Estilo] = {
            generico: productSAP.NumMatGenerico,
            varianteSAP: [productSAP.NumMatVariante],
            variantesIBN: [product.UPC],
            changes: tempChanges,
            precios: {
              compra: productSAP["Precios_compra"][sociedad],
              venta: productSAP["Precios_venta"][sociedad],
            },
            name: productSAP["Descripcion_larga"],
          };
        } else {
          // ir actualizando las variantes por cada UPC
          const temp = _.cloneDeep(changedUPC[product.Estilo]),
            varianteSAPTemp = temp.varianteSAP,
            variantesIBNTemp = temp.variantesIBN;

          changedUPC[product.Estilo] = {
            ...changedUPC[product.Estilo],
            varianteSAP: [...varianteSAPTemp, productSAP.NumMatVariante],
            variantesIBN: [...variantesIBNTemp, product.UPC],
          };

          // en caso de que hubiera diferentes campos con cambios en las variantes, que no deberia ocurrir...
          const tempChanges: any = _.cloneDeep(temp.changes);

          // actualizar el registro de cambios
          for (const [field, fieldSAP] of _.entries(fields)) {
            if (!tempChanges[fieldSAP]) {
              let before = "";

              switch (fieldSAP) {
                case "Precio_compra":
                  before = productSAP["Precios_compra"][sociedad];
                  break;
                case "Precio_venta":
                  before = productSAP["Precios_venta"][sociedad];
                  break;
                default:
                  before = productSAP[fieldSAP];
                  break;
              }

              tempChanges[fieldSAP] = {
                before: before,
                after: product[field],
              };
            }
          }
        }
      } else {
        // * NO hubo cambios en SAP para este producto
        const active = product.active ?? true;

        // * CATALOGO
        // se va armando un mapa con todos los UPC
        catalog[UPC] = { ...product, season: q, active, sociedad };

        // ** HISTORIAL
        // crea una entrada del producto en el historial
        newHistorial[UPC] = _.cloneDeep(histActual[UPC] ?? {});
        // agrega el producto actual
        newHistorial[UPC][date] = {
          ...product,
          catalog: catalogID,
          season: q,
          active,
          sociedad,
        };

        // obtener última versión del producto en el historial (no necesariamente ultima versión en SAP)
        const versionDates = _.keys(newHistorial[UPC]);
        const lastVersionDate = versionDates[versionDates.length - 1];

        // ** PRODUCTOS
        // ver si la fecha de la última versión es igual a la fecha que trae este catálogo
        if (lastVersionDate === date || lastVersionDate === undefined) {
          // guardar este producto como última versión
          newProducts[UPC] = {
            ...product,
            brand: brandID,
            brand_name: brand_name,
            brand_sap: brand_sap,
            catalog: catalogID,
            provider: providerID,
            provider_sap: providerID_SAP,
            provider_name: provider_name,
            catalog_id: catalog_id,
            season: q,
            active,
            sociedad,
          };
        }

        // * Filters
        // agregar al arreglo de filtros
        headersForFilters.forEach((key) => {
          if (filters[key] === undefined) {
            filters[key] = { items: [product[key]], count: [1] };
          } else {
            const index = filters[key].items.indexOf(product[key]);
            if (index === -1) {
              // If product[key] is not already present in items array
              filters[key].items.push(product[key]);
              filters[key].count.push(1);
            } else {
              // If product[key] already exists, increment its count
              filters[key].count[index]++;
            }
          }
        });
      }
    }
  }

  // * HACER EL LLAMADO PARA GUARDAR LAS ESTRUCTURAS CREADAS EN REALTIME
  await saveProductsREST(
    providerID,
    brandID,
    catalogID,
    newProducts,
    newHistorial,
    catalog
  );

  // * GUARDAR LOS PRODUCTOS CON UPC REUTILIZADOS
  if (!_.isEmpty(reutilizados)) {
    const totalReutilizados =
      totalReutilizadosOld + _.keys(reutilizados).length;

    await updateItemStatus(catalogID, "total_reutilizados", totalReutilizados);
    await saveUPCReutilizados(reutilizados, catalogID, providerID);
  } else {
    console.log("sin UPC reutilizados");
  }

  // * GUARDAR LOS PRODUCTOS QUE TIENEN CAMBIOS
  // ? Hay cambios
  if (!_.isEmpty(changedUPC)) {
    let changes: Changes = {};

    // Guardar el JSON de cambios
    const base: change = {
      cabecera: {
        providerID: providerID,
        providerIDSAP: providerID_SAP!,
        brandID: brandID,
        catalogID: catalogID,
        catalogName: catalogDoc.catalog_id,
        date: date,
        season: `${catalogDoc.season.year} ${catalogDoc.season.name}`,
        sociedad: catalogDoc.sociedad_SAP,
      },
      cambios: {},
      allChangesCheck: false,
    };

    for (const [style, obj] of _.entries(changedUPC)) {
      const id = `${obj.generico}-${sociedad}`;

      const dbObject: change = {
        cabecera: {
          ...base.cabecera,
          productName: obj.name,
          estilo: style,
          generico: obj.generico,
          variantesSAP: obj.varianteSAP,
          variantesIBN: obj.variantesIBN,
        },
        cambios: obj.changes,
        precios: obj.precios,
        allChangesCheck: false,
        id: id,
      };

      changes[id] = _.cloneDeep(dbObject);
    }

    // EL NODO DEL MATERIAL GENERICO, SIEMRPE TENDRÁ LA ULTIMA PETICIÓN DE CAMBIOS, NO SE GUARDA HISTORIAL
    await saveChangesREST(changes);

    console.log("guardados productos con cambios");
  } else {
    console.log("Sin cambios en SAP...");
  }

  // ** ACTUALIZAR STATUS Y OTROS CAMPOS DEL CATÁLOGO
  const totalCatalog = _.keys(catalog).length;

  // actualizamos última vez modificado solo si hubo cambios en los objetos OK
  if (totalOldOk !== totalCatalog) {
    await updateUpdateDate(catalogID);
  }

  // guardar status en el documento
  await updateItemStatus(catalogID, "total_ok", totalCatalog + totalOldOk);

  // * GUARDAR CONTEO DE ACTIVOS/INACTIVOS
  const oldActive = catalogDoc.item_status.total_activos ?? 0;
  const oldDrop = catalogDoc.item_status.total_inactivos ?? 0;
  const actives = _.values(catalog).filter((p) => p.active).length;
  const drops = _.values(catalog).filter((p) => !p.active).length;

  await updateItemStatus(catalogID, "total_activos", oldActive + actives);
  await updateItemStatus(catalogID, "total_inactivos", oldDrop + drops);

  // * GUARDAR FILTROS
  if (!_.isEmpty(filters)) {
    await updateFilters(catalogID, filters);
    console.log("actualizados status y filtros");
  }

  return filters;
};
