import { toLower } from "lodash";
import { materialFileData } from "../../interfaces/SeleccionMateriales";
import { getAsignedSpots } from "../../z_helpers/firestoreServices";
import {
  getMateriales,
  getProductsFromProvider,
} from "../../z_helpers/realtimeServices";
import _ = require("lodash");
import { getSimple } from "../../AltaMateriales/z_sendSegment/helpers/helperCatalogs";
import { User } from "../../interfaces/user";
import { getHelperCatalog } from "../../CargaCatalogo/2_ReglasPasoDos/03_Transformaciones/jerarquiasSolicitadass";

/**
 * Validates material selection based on real-time data.
 * @param selection Material selection data.
 * @param id UID of user that made the request.
 * @returns Object containing missing materials and selected materials.
 */

export const validarSeleccionWork = async (
  selection: materialFileData,
  user: User
) => {
  /** Campos del objeto que se van a verificar */
  const toCheck: string[] = [
    "Banners propuestos",
    "Commerce",
    "Deporte",
    "Tallas",
    "NOOS",
    "Carry Over",
    "Básico",
    "Exclusividad",
    "Segmentación de productos",
    "Colecciones",
    "Subsilueta",
    "Franquicia",
    // "Subgénero",
    "Versión",
    "Fit",
  ];
  // const toCheck: string[] = [
  //   "Banners propuestos",
  //   "Commerce",
  //   "NOOS",
  //   "CARRYOVER",
  //   "BASICOS",
  //   "EXCLUSIVIDADES",
  //   "SEGMENTACIÓN DE PRODUCTOS",
  //   "COLECCIONES",
  //   "FRANQUICIA",
  //   "SUB GÉNERO",
  //   "VERSIÓN",
  //   "FIT",
  //   "Tallas"
  // ]
  //?const usersUDN = await getAsignedUDN() //possible banners
  const usersSports = await getAsignedSpots(user.uid);
  const productsIBN: any = await getProductsFromProvider(
    selection.provider,
    selection.brand
  ); //TODO: fix any
  // const UPCs: string[] = Object.keys(productsIBN)
  // const ProductsSAP: any[] = await getSAPFromSelection(UPCs) //TODO!
  const materialSAP: any = await getMateriales(selection.brand);
  // console.log("get all materiales",materialSAP['1'])
  // const Banners = await getBanners()
  // console.log("banners")
  // const materialSAP: any = await getMaterialByGenerico();
  let selectedMap: any = {};
  let missing: any[] = [];

  const sociedadUsuario = user.IDSociedad ?? "1001";
  // console.log(sociedadUsuario)
  const bannersPorSociedad = await getSimple(
    "BannersPorSociedad",
    sociedadUsuario.toString()
  );
  const Banners = Object.keys(bannersPorSociedad);

  const kbsValidos: { [kbs: string]: string[] } = await getKBS();

  for (const mat of selection.products) {
    //check if mat has style
    if (mat.Estilo) {
      const { Tallas, ...matReal } = productsIBN[mat.Estilo] ?? null;
      //Check if material exists in IBN
      if (matReal) {
        //* validate fields that user wants to check *
        let variants: any = {};
        const { variantes } = matReal;
        let valid = true;

        const sociedad = matReal.sociedad ?? "1001";
        if (sociedad.toString() !== sociedadUsuario.toString()) {
          missing.push({
            error: `Material no encontrado para la sociedad ${sociedadUsuario}. `,
            mat: mat,
          });

          valid = false;
        }

        for (let field of toCheck) {
          // if (mat[field] === "" && field !== "Tallas") {
          //   break
          // }
          switch (field) {
            case "Banners propuestos":
              // console.log("banner",mat[field])
              if (mat[field] === "" || !Banners.includes(mat[field])) {
                missing.push({
                  error: `El campo ${field} no es correcto. ${
                    mat[field] === ""
                      ? "Está vacío."
                      : `${mat[field]} valor inválido.`
                  }`,
                  mat: mat,
                });
                valid = false;
              }
              break;
            case "Commerce":
              if (String(mat.Commerce) === "") {
                continue;
              } else if (mat["Banners propuestos"] !== mat[field]) {
                missing.push({
                  error: `'${field}' y 'Banners propuestos' deben tener el mismo valor.`,
                  mat: mat,
                });
                valid = false;
                break;
              }
              break;
            case "Tallas":
              let sizeTemp: any[] = [];
              Object.keys(mat).forEach((key) => {
                if ("x" === toLower(mat[key])) {
                  // console.log("tallas",Tallas,key)
                  if (Tallas.includes(key)) {
                    variants[variantes[key].upc] = variantes[key];
                  } else {
                    sizeTemp.push({
                      error: `Error en el campo ${field}. La talla ${key} no existe o no está disponible para selección.`,
                      mat: mat,
                    });
                    // console.log("sizeTemp",sizeTemp)
                  }
                  delete mat[key];
                }
              });
              if (Object.values(variants).length < 1 && sizeTemp.length < 1) {
                missing.push({
                  error: `Error en el campo ${field}. No hay tallas seleccionadas.`,
                  mat: mat,
                });
                valid = false;
              } else {
                missing = [...sizeTemp, ...missing];
              }

              break;

            case "Deporte":
              if (!usersSports.includes(matReal[field])) {
                missing.push({
                  error: `Error en el campo ${field}. ${matReal[field]} no está asignado.`,
                  mat: mat,
                }); //TODO!
                valid = false;
                break;
              }
              break;

            case "NOOS":
            case "Carry Over":
            case "Exclusividad":
            case "Subsilueta":
            case "Franquicia":
            case "Fit":
            case "Versión":
            // case "Subgénero":
            case "Segmentación de productos":
            case "Colecciones":
            case "Básico":
              const kbs = mat[field] ? mat[field].toString() : "";

              if (String(kbs) === "") {
                continue;
              } else if (!kbsValidos[field].includes(kbs)) {
                missing.push({
                  error: `Valor inválido para '${field}' (${kbs}). Valores aceptados: ${kbsValidos[
                    field
                  ].join(", ")}. `,
                  mat: mat,
                });
                valid = false;
                break;
              }

              break;

            default:
              break;
          }
        }

        // VALIDAR EXTENSION DE MATERIAL
        for (const variante of _.values(variantes)) {
          // const materialSAP: any = await getMaterial(variante.upc);
          try {
            if (
              materialSAP &&
              materialSAP[variante.upc] &&
              materialSAP[variante.upc]["Banners"][
                sociedad.toString()
              ].includes(mat["Banners propuestos"])
            ) {
              missing.push({
                error: `El UPC ${variante.upc} ya está extendido al banner ${mat["Banners propuestos"]}. `,
                mat: mat,
              });

              // ? Se debe ignorar el UPC y no mandarlo a extensión de banner
              delete variants[variante.upc];
            }
          } catch (err) {
            console.log(`variante:${variante.upc} has no banner in sap`);
          }
        }

        // quitar estilos que no tengan tallas después de la validacion de extension
        if (_.isEmpty(variants)) {
          console.log("sin variantes", materialSAP.Estilo);
          continue;
        }

        const seasonData = matReal.season.split(/(?=[A-Za-z])/);
        if (!valid) {
          continue;
        }
        const matSelect = {
          Marca: selection.brandData.name,
          Proveedor: matReal.provider,
          MarcaId: selection.brand,
          Catalogo: matReal.catalog, // ?
          MarcaSAP: selection.brandData.SAP_id,
          providerIDSAP: selection.ProviderSAPID,
          Temporada: seasonData[1],
          Ano: seasonData[0],
          Genero: matReal.Género, // !
          Descripcion_larga: matReal["Descripción larga del producto"],
          Descripcion_corta: matReal["Descripción corta del producto"],
          Deporte: matReal.Deporte, // !
          Color: matReal.Color, // !
          Division: matReal.División, // !
          Precio_venta: matReal["Precio venta del producto"],
          Precio_compra: matReal["Precio de compra del producto"],
          Moneda_venta: matReal["Moneda venta"],
          Moneda_costo: matReal["Moneda costo"],
          Unidades: [mat["Banners propuestos"]] ?? [], //? This has to be changed to a string later
          Estilo: matReal.Estilo,
          Fotografia: matReal.Fotografía ?? "",
          Commerce: mat.Commerce ?? [],
          Basicos: mat["Básico"] ?? "",
          Colecciones: mat["Colecciones"] ?? "",
          NOOS: mat["NOOS"] ?? "", //!
          CarryOver: mat["Carry Over"] ?? "", //!
          Exclusividades: mat["Exclusividad"] ?? "", //!
          SegmentacionDeProducto: mat["Segmentación de productos"] ?? "", //!
          Subsilueta: mat["Subsilueta"] ?? "", //!
          Silueta: matReal["Silueta"] ?? "", //!
          Franquicia: mat["Franquicia"] ?? "", //!
          Version: mat["Versión"] ?? "", //!
          Fit: mat["Fit"] ?? "", //!
          variantes: variants,
          // DATOS INFORMATIVOS
          Provider_name: matReal.provider_name,
          Catalog_ID: matReal.catalog_id,
          Sociedad: sociedad.toString(),
          // TRANSFORMACIONES AUTOMATICAS
          Largo: matReal.Largo ?? "",
          Ancho: matReal.Ancho ?? "",
          Alto: matReal.Alto ?? "",
        };
        selectedMap[matReal.Estilo] = matSelect;
      } else {
        // Matieral no se encuentra en realtime aka upc no se encontro en realtime
        missing.push({
          error: `El estilo seleccionado ${mat.Estilo} no se encontró en IBN.`,
          mat: mat,
        });
      }
    } else {
      // Input material no tiene upc
      missing.push({
        error: `El estilo seleccionado ${mat.Estilo} no tiene UPC.`,
        mat: mat,
      });
    }
  }
  const selected = Object.values(selectedMap);
  missing = [...new Set(missing)];
  return { missing, selected };
};

const getKBS = async () => {
  let map: { [kbs: string]: string[] } = {};
  // Como están los nodos en HelperCatalogs
  const headers = [
    "NOOS",
    "Carry Over",
    "Basicos",
    "Exclusividad",
    "Segmentacion",
    "Colecciones",
    "Subsilueta",
    "Franquicia",
    // "Subgenero",
    "Version",
    "Fit",
  ];

  for (const h of headers) {
    // Como es el campo del material a evaluar
    let kbs = h;

    // if (h === "Subgenero") {
    //   kbs = "Subgénero";
    // } else
    if (h === "Version") {
      kbs = "Versión";
    } else if (h === "Segmentacion") {
      kbs = "Segmentación de productos";
    } else if (h === "Basicos") {
      kbs = "Básico";
    }

    const nodo = await getHelperCatalog(h);
    map[kbs] = _.values(nodo);
  }

  return map;
};
