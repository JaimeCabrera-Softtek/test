import * as _ from "lodash";

import { AltaMaterial_Articulo, ConsecutivoJob } from "../AltaMateriales/01_batch_creation/interfaces";
import { db_materiales } from "../firebase";
import { MATERIALES } from "./constants";

/** 
 * Obtiene el identificador del material generico, si ya existia en el nodo AltaMaterialesConsecutivosJobs, regresa el que corresponde al estilo
 * Si no, realiza un incremento al último valor guardado en el nodo AltaMaterialesConsecutivos
 */
export const getConsecutivo_Generico = async (found: any[], foundJob: ConsecutivoJob | undefined, customID: string) => {
  if (found.length > 0) {
    //ya existe en Materiales, regresar consecutivo_generico
    // no importa que sea el primer item, todos traen el mismo valor consecutivo
    return found[0]["NumMatGenerico"];
  } else if (foundJob) {
    // existe un job con el mismo identificador personalizado
    return foundJob.generico;
  } else {
    //genera un consecutivo nuevo
    const newID = await nextID("AltaMaterialesConsecutivos/genericos");
    // guarda consecutivo en nodo auxiliar para jobs
    await saveValue(`AltaMaterialesConsecutivosJobs/${customID}/generico`, newID);
    return newID;
  }
}

/**
 * Obtener los consecutivos de las variantes de un material genérico
 * @param consecutivo_generico El id_material SAP (consecutivo) que tiene asignado el 'padre'
 * @param mat objeto tipo AltaMaterial_Articulo
 * @return AltaMaterial_Articulo con los consecutivos de las variantes ya asignados
 */
export const getConsecutivos_Variantes = async (
  consecutivo_generico: number,
  mat: AltaMaterial_Articulo,
  found: any[],
  foundJob: ConsecutivoJob | undefined,
  customID: string
): Promise<AltaMaterial_Articulo> => {
  let _res = _.cloneDeep(mat);

  const variantes = Object.values(mat.variantes);

  for (let v of variantes) {
    let isNew = false;
    //Buscarlo en /Materiales
    if (found.length > 0) {
      // buscar la talla entre el mapa de materiales encontrados
      const talla = found.find((m) => m.Talla === v.tallaProveedor)

      if (talla) {
        // ya existe, regresar consecutivo_variante
        const c_v = talla["NumMatVariante"];
        _res.variantes[v.upc].consecutivo = c_v;
      } else {
        // esta talla es nueva
        isNew = true;
      }
    } else if (foundJob) {
      // quitar caracteres especiales a la talla (ya está guardado así en realtime)
      const cleanTalla = replaceTallas(v.tallaProveedor);

      if (foundJob.variantes[cleanTalla]) {
        // ya había un job con esta variante
        const c_v = foundJob.variantes[cleanTalla]
        _res.variantes[v.upc].consecutivo = c_v;
      } else {
        isNew = true;
      }
    } else {
      isNew = true;
    }

    if (isNew) {
      //genera un consecutivo nuevo
      const c_v = await nextID(`AltaMaterialesConsecutivos/variantes/${consecutivo_generico}`);

      // obtiene la talla sin caracteres especiales
      const cleanTalla = replaceTallas(v.tallaProveedor);
      // guarda en nodo auxiliar para consecutivos (jobs)
      await saveValue(`AltaMaterialesConsecutivosJobs/${customID}/variantes/${cleanTalla}`, c_v);

      _res.variantes[v.upc].consecutivo = c_v;
    }
  }


  return _res;
};

/**
 * Obtener el siguiente ID consecutivo para alta de materiales
 * @param path Path sobre el que aplicar la transacción y obtener el siguiente ID
 * @return el ID siguiente
 */
const nextID = async (path: string) => {
  const tres = await db_materiales.ref(path).transaction(
    (snap) => {
      if (snap != undefined && snap != null) {
        snap++;
      } else {
        snap = 1;
      }
      return snap;
    },
    (error, committed, snap) => {
      if (error) {
        console.log("Error en transaccion", error);
      }
    },
    true
  );

  if (tres.committed) {
    // console.log(JSON.stringify(tres.snapshot.val()));
    return tres.snapshot.val();
  } else {
    throw `No se pudo obtener el consecutivo ${path}`;
  }
}

/**
 * Obtiene un mapa de materiales por identificador personalizado (variantes de un mismo estilo)
 * @param identificador_personalizado brandID+estilo del producto genérico
 * @returns {[key: string]: objetos} | undefined si no hay productos con este identificador personalizado
 */
export const getMaterialesByCustomID = async (identificador_personalizado: string) => {
  let materialesMap: any[] = [];

  const ref = db_materiales
    .ref(MATERIALES)
    .orderByChild("identificador_personalizado")
    .equalTo(identificador_personalizado);

  await ref.once('value', async (snapshot) => {
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        // por alguna razón la consulta regresa null 
        if (childSnapshot.val()) {
          materialesMap.push();
        }
      });
    }
  })

  return materialesMap;
}

/**
 * Obtiene el un nodo de AltaMaterialesConsecutivosJobs de acuerdo a su identificador personalizado
 * @param identificador_personalizado brandId+Estilo
 * @returns objeto tipo ConsecutivoJob
 */
export const getConsecutivoJobs = async (identificador_personalizado: string) => {
  let consecutivo = undefined;

  const ref = db_materiales.ref(`AltaMaterialesConsecutivosJobs/${identificador_personalizado}`)

  await ref.once('value', async (snapshot) => {
    if (snapshot.exists()) {
      consecutivo = snapshot.val();
    }
  })

  return consecutivo;
}

/**
 * Guarda un valor por medio de una transacción en realtime
 * @param path path a donde va el valor
 * @param value valor a guardar
 */
const saveValue = async (path: string, value: any) => {
  const tres = await db_materiales.ref(path).transaction(
    () => {
      return value;
    },
    (error, committed, snap) => {
      if (error) {
        console.log("Error en transaccion", error);
      }
    },
    true
  );

  if (tres.committed) {
    return tres.snapshot.val();
  } else {
    throw `No se pudo guardar el consecutivo ${path}`;
  }
}

/**
 * Limpia una talla de caracteres especiales y sustituye su equivalente a letra
 *
 * - Punto (.) por (p) --> 25.5 to 25p5
 * - Slash (/) por (s) --> CH/M to CHsM
 * - Comilla (") por (c) --> CH 2" to CH 2c
 * - Guión medio (-) por (g) --> 30-32 to 30g32
 *
 * @param original talla a sustituir
 * @returns reemplazo de los caracteres
 */
const replaceTallas = (original: string) => {
  return original.replaceAll(".", "p").replaceAll("/", "s").replaceAll("\"", "c").replaceAll("-", "g");
}
