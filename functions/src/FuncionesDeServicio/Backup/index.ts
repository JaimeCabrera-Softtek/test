import * as functions from 'firebase-functions';
import { firestore } from 'firebase-admin';

export const BackupCRON = functions.pubsub
    .schedule("0 0 * * *")
    .timeZone("America/Monterrey")
    .onRun(async (context) => {
        console.log('BackupCRON', 'starting')
        const res = await backup();
        console.log('BackupCRON', 'result', JSON.stringify(res))
    });

const backup = async () => {
    const projectId = process.env.PROJECT_ID ?? '';
    console.log('service account', process.env.CLIENT_EMAIL);
    console.log('projectId', projectId);
    console.log('bucket', process.env.STORAGE_FIRESTOREBACKUPS);
    const client = new firestore.v1.FirestoreAdminClient();
    const databaseName =
        client.databasePath(projectId, '(default)');

    try {
        const exportResponse = await client.exportDocuments({
            name: databaseName,
            outputUriPrefix: process.env.STORAGE_FIRESTOREBACKUPS,
            // Leave collectionIds empty to export all collections
            // or set to a list of collection IDs to export,
            // collectionIds: ['users', 'posts']
            collectionIds: []
        });

        const response = exportResponse[0];

        console.log(`Operation Name: ${response.name}`);

        return 'Export operation success';
    } catch (err) {
        console.error(err);
        return 'Export operation failed';
    }
}