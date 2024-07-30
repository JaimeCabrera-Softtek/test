import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import {
    PutObjectCommand,
    S3Client
} from '@aws-sdk/client-s3';
import { downloadFile } from './download_picture';

/**
 * Upload image file to our own cloud
 * @param productCode Código de material genérico
 * @param pictureURL URL de la imagen original del producto
 */
export const materialPictureUpload = async (productCode: string, pictureURL: string): Promise<string> => {
    if (pictureURL !== "") {
        //Setup de ubicación local
        let downloadPathBase = os.tmpdir();
        console.log(downloadPathBase);
        const downloadDir = path.join(downloadPathBase, 'prev');
        fs.mkdirSync(downloadDir, { recursive: true });
        const downloadPath = path.join(downloadDir, `${productCode}.jpg`);

        const downloadedPicturePath = await downloadFile(pictureURL, downloadPath);

        if (downloadedPicturePath !== undefined) {
            await uploadFileToS3(downloadedPicturePath, process.env.S3_BUCKET_NAME ?? '');
            return 'OK'
        } else {
            //No se obtuvo la imagen del producto
            throw new Error('No se obtuvo la imagen del producto')
        }
    } else {
        throw new Error('pictureURL undefined')
    }
}

/**
 * 
 * @param filePath Ruta al archivo local
 * @param bucketName Bucket donde lo queremos guardar
 */
export const uploadFileToS3 = async (filePath: string, bucketName: string) => {
    const fileName = `${path.basename(filePath)}`
    const fileContent = fs.readFileSync(filePath);

    // A region and credentials can be declared explicitly. For example
    // `new S3Client({ region: 'us-east-1', credentials: {...} })` would
    //initialize the client with those settings. However, the SDK will
    // use your local configuration and credentials if those properties
    // are not defined here.
    const s3Client = new S3Client({
        credentials: {
            accessKeyId: process.env.S3_BUCKET_ACCESSKEYID ?? '',
            secretAccessKey: process.env.S3_BUCKET_SECRETACCESSKEY ?? ''
        },
        region: process.env.S3_BUCKET_REGION ?? ''
    });

    await s3Client.send(
        new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME ?? '',
            Key: fileName,
            Body: fileContent,
            ContentType: 'image/jpg'
        }))
};