import {
  CatalogSheet,
  Transformation,
  TransformationItem,
} from "@fridaplatform-stk/motor-reglas";
import _ = require("lodash");

let missing: any = {};

export const KBSTransformator = async (
  fixes: Transformation[],
  rules: CatalogSheet,
  objects: any[],
  conditions: boolean
) => {
  // * NUEVO DATA, clonamos el que ya tenemos
  let updData: any[] = _.cloneDeep(objects);

  //   recorrer arreglo Transformation[]
  fixes.forEach((t) => {
    // recorrer cada TransformationItem
    for (const transformation of t.transformations) {
      // ? Verificar si este field acepta valores undefineds
      const undIndex = rules.sheetsRules.findIndex(
        (r) => r.acceptsUndefined && r.field === t.field
      );

      // recorrer todos los objetos
      for (const [rowIndex, object] of updData.entries()) {
        /** indica si se realiza el proceso de transformacion con el valor en curso */
        let check = true;
        /** Valor del objeto en este field */
        let cell = object[t.field];
        if (cell !== undefined && cell !== null) {
          cell = cell.toString().trim();
        } else {
          // ? El valor es undefined pero este campo es opcional y no tenemos la transformación a vacios
          if (
            undIndex !== -1 &&
            !transformation.map["#"] &&
            !transformation.map["@"]
          ) {
            check = false;
          }
        }

        if (check) {
          // * verificar si hay o no condiciones en el TransformationItem
          if (
            !transformation.conditions ||
            _.isEmpty(transformation.conditions)
          ) {
            // * NO HAY CONDICIONES
            // ? Es el proceso donde NO se verifican las condiciones
            if (!conditions) {
              updateKBS(
                transformation,
                object,
                t,
                updData,
                rowIndex,
                cell,
                missing
              );
            }
            // else: la transformación no tiene condiciones, y está transformando aquellas con condiciones, entonces no hace nada
          } else {
            // * HAY CONDICIONES
            // ? Es el proceso donde se verifican las condiciones
            if (conditions) {
              // * ¿ESTE OBJETO CUMPLE CON LAS CONDICIONES?
              const cumple = checkConditions(transformation, object);

              // ? Todos los campos cumplen las condiciones?
              if (cumple) {
                updateKBS(
                  transformation,
                  object,
                  t,
                  updData,
                  rowIndex,
                  cell,
                  missing
                );
              }
              // else: no es un objeto para aplicarle la transformación, no cumple todas las condiciones
            }
            // else: la transformación tiene condiciones, pero no se están transformando las que tengan condiciones, entonces no hace nada
          }
        }
      }
    }
  });

  return { updData, missing };
};

/** Proceso de transformación para una celda / campo */
const updateKBS = (
  transformation: TransformationItem,
  object: any,
  t: Transformation,
  updData: any[],
  rowIndex: number,
  cell: string,
  missing: any
) => {
  // ? SI EXISTE LA TRANSFORMACIÓN A TODOS LOS VALORES, INCLUYENDO VACIOS
  if (transformation.map["@"]) {
    // ? SI EL OBJETO NO TIENE ESTE CAMPO LO AGREGA, SI LO TIENE, LO SUSTITUYE
    object[t.field] = transformation.map["@"];
    updData[rowIndex] = _.cloneDeep(object);
    // ! AQUÍ SE ASUME QUE NO HAY OTRAS TRANSFORMACIONES PARA ESTE CAMPO, PORQUE SI NO, SE IGNORAN
  } else {
    // ? SOLO TRANSFORMAMOS VACIOS O UNDEFINEDS
    if (transformation.map["#"]) {
      if (
        !object[t.field] ||
        object[t.field] === null ||
        object[t.field].toString().trim() === ""
      ) {
        // si y solo si, el objeto no tiene este campo o está vacio, se agrega/modifica por el valor a transformar
        object[t.field] = transformation.map["#"];
        updData[rowIndex] = _.cloneDeep(object);
      }
      // ! AQUÍ SE ASUME QUE NO HAY OTRAS TRANSFORMACIONES PARA ESTE CAMPO, PORQUE SI NO, SE IGNORAN
    } else {
      // ? EL MAPA DE TRANSFORMACIONES TIENE EL VALOR ENCONTRADO
      if (
        // ? este valor está en el mapa de transformaciones
        transformation.map[cell]
      ) {
        // * ACTUALIZO ESTA CELDA AL VALOR QUE VIENE EN EL MAPA
        let value = transformation.map[cell];

        object[t.field] = value;
        updData[rowIndex] = _.cloneDeep(object);
      } else {
        // * LIMPIAR EL KBS
        object[t.field] = "";
        updData[rowIndex] = _.cloneDeep(object);

        // construir un identificador unico de esta transformacion
        let cond = "";
        if (transformation.conditions) {
          _.entries(transformation.conditions).forEach(([key, value]) => {
            cond += `${key} = ${value}; `;
          });
        }

        const conditionsString =
          cond.length > 0
            ? cond.substring(0, cond.length - 2)
            : "NO CONDITIONS";

        const field = t.field;
        const missingValue = cell;

        if (!missing[field]) {
          missing[field] = {};
        }

        missing[field] = {
          ...missing[field],
          [conditionsString]: {
            ...missing[field][conditionsString],
            [missingValue]: true,
          },
        };
      }
    }
  }
};

/**
 * Verifica las condiciones de la transformación en curso.
 * @param transformation Transformación en curso.
 * @param object Objeto que va a revisar si cumple las condiciones.
 * @returns boolean que indica si cumple o no las condiciones.
 */
const checkConditions = (transformation: TransformationItem, object: any) => {
  let cumple: number = 0;

  // por cada campo de las condiciones
  for (const conditionalField of _.keys(transformation.conditions)) {
    // ? el valor del objeto de este campo, es igual que la condición de este campo
    if (object[conditionalField]) {
      const condition = transformation.conditions![conditionalField] as string;

      const acceptedValues: string[] = condition
        .split(",")
        .map((c) => c.toString().trim());

      if (acceptedValues.includes(object[conditionalField].toString().trim())) {
        cumple++;
      } else {
        break;
      }
    }
  }

  return cumple === _.keys(transformation.conditions).length;
};
