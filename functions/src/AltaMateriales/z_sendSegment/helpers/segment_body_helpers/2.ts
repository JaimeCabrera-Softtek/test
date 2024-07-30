import { AltaMaterial_ProductInit } from "../../../01_batch_creation/interfaces";
import {
  getKeyForDeporte,
  getKeyForDivision,
  getKeyForFamilia_Automatica,
  getKeyForGenero,
  getKeyForMarca,
  getKeyForSilueta,
} from "../helperCatalogs";

export const body02 = async (
  product_data: AltaMaterial_ProductInit,
  operacion: "create" | "update" | "delete"
) => {
  const op = getFuncKey(operacion);
  const jerarquia = await getJerarquia(product_data);

  return {
    jerarquias: jerarquizar(product_data, op, jerarquia),
  };
};

function jerarquizar(
  product_data: AltaMaterial_ProductInit,
  op: string,
  jerarquia: string
) {
  let base = {
    jerarquia: "01",
    logAplicacion: "X",
    numeroMaterial: `${product_data.consecutivo}`,
    nodoJerarquia: jerarquia,
    inicioValidez: getFechaInicio(),
    finValidez: "31.12.9999",
    asignacionPrincipal: "X",
    funcion: op,
  };

  // let arr = Object.values(product_data.art.variantes).map(x => ({
  //     ...base,
  //     numeroMaterial: `${product_data.consecutivo}${x.consecutivo.toString().padStart(3, '0')}`
  // }))

  return [
    base, //generico
    // ...arr
  ];
}

/**
 * Obtener la fecha de inicio validez
 * @returns La fecha actual en formato SAP dd.MM.yyyy
 */
const getFechaInicio = () => {
  const today_utc = new Date().toISOString().split("T")[0];
  const date_parts = today_utc.split("-");
  return `${date_parts[2]}.${date_parts[1]}.${date_parts[0]}`;
};

/**
 * Traducir `create` `update` `delete` a un char para que SAP entienda
 * @param operacion operación que queremos hacer
 * @returns el valor con el que le indicamos qué operación queremos hacer a SAP
 */
const getFuncKey = (operacion: "create" | "update" | "delete") => {
  if (operacion === "update") {
    return "U";
  } else if (operacion === "delete") {
    return "D";
  }
  return "I";
};

/**
 * Concatenado de los IDs de Género + Division + Deporte + Marca + Familia + Silueta
 * @param product_data Valor del nodo del job
 * @returns Valor concatenado para la jerarquía
 */
const getJerarquia = async (
  product_data: AltaMaterial_ProductInit
): Promise<string> => {
  const genero = await getKeyForGenero(product_data.art.Genero);
  const division = await getKeyForDivision(product_data.art.Division);
  const deporte = await getKeyForDeporte(product_data.art.Deporte);
  const marca = await getKeyForMarca(product_data.art.Marca.toUpperCase());
  const f = (await getKeyForFamilia_Automatica(product_data.art.Silueta)) ?? "";

  const silueta = await getKeyForSilueta(product_data.art.Silueta);

  return `${genero}${division}${deporte}${marca}${f}${silueta}`;
};
