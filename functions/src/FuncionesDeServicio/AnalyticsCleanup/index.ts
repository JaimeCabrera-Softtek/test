import * as functions from 'firebase-functions';
import axios from 'axios';
import { db_analytics } from '../../firebase';
import { ANALYTICS_THRESHOLD_DAYS } from '../../z_helpers/constants';

export const AnalyticsCleanup = functions
    .pubsub
    .schedule('every day 00:00')
    .timeZone('America/Monterrey')
    .onRun(async (context) => {
        const threshold_days = (await db_analytics.ref(ANALYTICS_THRESHOLD_DAYS).once('value')).val();

        const url = `${process.env.DATABASE_ANALYTICS ?? ''}API_Analytics_Summary`;
        const res = await axios.get(`${url}.json`,
            {
                params: {
                    auth: process.env.DATABASE_ANALYTICS_AUTH ?? '',
                    shallow: true
                }
            });

        const items = res.data;
        console.log('Analytics items', JSON.stringify(items));

        for (let api in items) {
            const _res = await axios.get(`${url}/${api}.json`,
                {
                    params: {
                        auth: process.env.DATABASE_ANALYTICS_AUTH ?? '',
                        shallow: true
                    }
                });
            const api_dates = _res.data;
            console.log(api, JSON.stringify(api_dates));

            for (let date in api_dates) {
                if (isOldDate(date, threshold_days)) {
                    await removeAnalytics(url, api, date);
                }
            }
        }
    })

/**
 * Evaluar si una fecha ya se puede desechar
 * @param date fecha a evaluar
 * @param threshold_days días a partir de los que se considerará vieja la fecha de entrada
 * @returns {boolean} true si es fecha vieja
 */
function isOldDate(date: string, threshold_days: number): boolean {
    /**
     * Timestamp en millis de la fecha de entrada
     */
    const d_in = new Date(date).getTime();
    /**
     * La fecha de now - X_days
     */
    const past_date = (new Date().getTime()) - (threshold_days * 8.64e+7);

    /**
     * Regresamos true si la fecha la tenemos que borrar (es fecha antigua)
     */
    return d_in < past_date;
}

/**
 * Borra un día de analytics para una api
 * @param url url base de la db
 * @param api nombre del api
 * @param date fecha que se quiere borrar
 */
async function removeAnalytics(url: string, api: string, date: string): Promise<void> {
    //Borrar el detalle
    console.log('will delete', `${api}/${date}`)
    await axios.delete(`${url}/${api}/${date}.json`,
        {
            params: {
                auth: process.env.DATABASE_ANALYTICS_AUTH ?? '',
                writeSizeLimit: 'unlimited'
            }
        });

    //Borrar el summary
    const ref_summary = db_analytics.ref('API_Analytics_Summary').child(api).child(date);
    await ref_summary.remove();

}