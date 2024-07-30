import {
  ComplexRules,
  ComplexRulesValidator,
} from "@fridaplatform-stk/motor-reglas";
import { parentPort, workerData } from "worker_threads";

/**
 * Proceso de aplicar las reglas complejas a un grupo de objetos
 * @param complexRules reglas complejas con la estructura requerida
 * @param json arreglo de objetos que se van a evaluar
 */
const applyComplexRules = async (complexRules: ComplexRules, json: any[]) => {
  console.log("Items en el batch reglas 2", json.length);

  // validar reglas complejas desde @fridaplatform-stk/motor-reglas
  const complexValidation = ComplexRulesValidator(complexRules, json, "UPC");

  // envia los resultados de la validación de reglas al hilo principal
  parentPort?.postMessage(complexValidation);
};

// Inicializar worker
applyComplexRules(workerData.rules, workerData.json);
