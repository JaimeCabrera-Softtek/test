import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';
import * as http from 'http';
import * as https from 'https';

/**
 * Lógica de reintentos para descargar un archivo
 * @param url url del archivo a descargar
 * @param savePath path local para guardarlo
 * @returns path del archivo descargado o undefined
 */
export const downloadFile = async (url: string, savePath: string): Promise<string | undefined> => {
    const lim = 5;
    let success = false
    let tries = 0;
    let res;
    do {
        res = await tryDownload(url, savePath);
        if (res !== undefined) {
            success = true;

            //Comprimir, para ahorrar espacio y costos de transferencia
            // await compressImage(savePath, true);
        }
        tries++;
    } while (!success && tries < lim);

    return res
}

export const compressImage = async (ruta: string, replaceOriginal: boolean) => {
    const { dir, name, ext } = path.parse(ruta);
    const newPath = path.join(dir, `${name}-sm${ext}`);

    const settings = {
        inputFile: ruta,
        outputFile: newPath,
        maxWidth: 500
    };

    await new Promise<void>((resolve) => {
        sharp(settings.inputFile)
            .resize(settings.maxWidth)
            // .png()
            .jpeg()
            .toFile(settings.outputFile, (err: any, info: any) => {
                if (err) {
                    console.log(`error:${err}`);
                    console.log(`info:${JSON.stringify(info)}`);
                }
                resolve();
            });
    });

    /**
     * La compresión de la imagen se hizo sobre un archivo nuevo "-sm"
     * Podemos "hacer como que no pasó nada" borrando el original y renombrando el nuevo
     * */
    if (replaceOriginal) {
        fs.unlinkSync(ruta);
        fs.renameSync(newPath, ruta);
    }
}

/**
 * Descargar un archivo de una url y ponerlo en una ruta local
 * @param url url del archivo a descargar
 * @param savePath path local para guardarlo
 * @returns path del archivo descargado o undefined
 */
const tryDownload = async (url: string, savePath: string): Promise<string | undefined> => {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https:') ? https : http;

        const file = fs.createWriteStream(savePath);

        protocol
            .get(url, function (response) {
                response.pipe(file);
                // after download completed close filestream
                file
                    .on("finish", () => {
                        file.close();
                        resolve(savePath);
                    })
                    .on('error', err => {
                        console.log('error downloadFile', 1, { url: url, error: err.message })
                        resolve(undefined)
                    })
            })
            .on('error', (err) => {
                console.log('error downloadFile', 2, err.message)
                fs.unlinkSync(savePath); // Delete the file async. (But we don't check the result)
                resolve(undefined)
            });
    });
}