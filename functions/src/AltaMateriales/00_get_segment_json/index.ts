import * as functions from 'firebase-functions';
import { body01 } from '../z_sendSegment/helpers/segment_body_helpers/1';
import { body02 } from '../z_sendSegment/helpers/segment_body_helpers/2';
import { body03 } from '../z_sendSegment/helpers/segment_body_helpers/3';
import { body04 } from '../z_sendSegment/helpers/segment_body_helpers/4';
import { body05 } from '../z_sendSegment/helpers/segment_body_helpers/5';
import { body06 } from '../z_sendSegment/helpers/segment_body_helpers/6';
import { db_materiales } from '../../firebase';
import { ALTA_MATERIALES } from '../../z_helpers/constants';
import { AltaMaterial_ProductInit } from '../01_batch_creation/interfaces';

export const getSegmentJSON = functions.https.onRequest(async (req, res) => {
    try {
        const { job, segment } = req.body;

        console.log(job, 'segment:', segment);

        const logic: any = {
            1: body01,
            2: body02,
            3: body03,
            4: body04,
            5: body05,
            6: body06
        };

        const prodRef = db_materiales.ref(ALTA_MATERIALES).child(job);
        const product_data = (await prodRef.once('value')).val() as AltaMaterial_ProductInit;
        const json = await logic[segment](product_data)

        res.send(json);
    } catch (err) {
        console.log('error', (err as Error).message)
        res.send((err as Error).message);
    }
})