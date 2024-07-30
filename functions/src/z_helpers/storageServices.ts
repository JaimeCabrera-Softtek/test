import * as os from "os";
import * as path from "path";
import {storage} from "../firebase";
import {randomUUID} from "crypto";

/**
 * Obtiene el arreglo de objetos almacenado en un json de storage
 * @param ruta ruta del json en storage
 * @return arreglo de objetos any[]
 */
export const getJSON = async (ruta: string) => {
  let objsArr = [];

  // Vamos a poner el json en temp, construir ruta local
  const fileName = `${new Date().getTime()}.json`;
  const tempFilePath = path.join(os.tmpdir(), fileName);

  // Descargar el archivo a la ruta local
  await storage.bucket().file(ruta).download({
    destination: tempFilePath,
  });

  // leer el json de local
  objsArr = require(tempFilePath);

  return objsArr;
};

/**
 * Saves a file to a specified path in storage bucket.
 *
 * @param {any} data - The data to save as the file content.
 * @param {string} path - The path where the file will be saved.
 * @return true if the file was successfully saved, and rejects with an error otherwise.
 * @throws {Error} - If there was an error while saving the file.
 */
export const saveFile = async (data: any, path: string) => {
  const file = storage.bucket().file(path);
  const uuid = randomUUID();
  const res = await file
    .save(data, {
      metadata: {
        metadata: {
          firebaseStorageDownloadTokens: uuid,
        },
      },
    })
    .then(() => {
      console.log("Archivo guardado... ", path);
      return true;
    })
    .catch((e) => {
      console.log("Error guardando archivo... " + e);
      throw new Error(e);
    });

  return res;
};
