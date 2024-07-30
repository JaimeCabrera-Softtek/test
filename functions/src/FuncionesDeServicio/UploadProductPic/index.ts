import * as functions from 'firebase-functions';
import { materialPictureUpload } from '../../z_helpers/material_picture';


/**
 * API PRUEBA!!! NO PRODUCTIVA
 * OBTIENE LA FOTO DE UN PRODUCTO Y LO SUBE A S3
 * body: { 
 *   product: "70001",
 *   picture: "https://www.innovasport.com/medias/IS-GW9195-1.jpg?context=bWFzdGVyfGltYWdlc3w3NTEyOXxpbWFnZS9qcGVnfGltYWdlcy9oZmEvaDAzLzEwOTc4OTk1MzA2NTI2LmpwZ3w3NWRmYjEwNmY5OTE2Nzk4NjYwMjYwNTk4NDNjOWE5ZTJlOWUyOTcxOTRiNWFmMjgzMmY2ODY4NTRkM2NhZjky"
 * }
 */
export const uploadProductPicture = functions.https.onRequest(async (req, res) => {
    try {
        const { product, picture } = req.body;

        await materialPictureUpload(product, picture);

        res.send({
            error: false,
            msg: 'Imagen subida exitosamente',
            data: 'url de la foto en S3'
        })
    } catch (err) {
        const msg = (err as Error).message;
        console.log('Error', msg)
        res.send({
            error: true,
            msg,
            data: null
        });
    }
})