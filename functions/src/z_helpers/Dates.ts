/**
 * Convertir fecha en formato string de asn a date
 * @param date fecha formato string yyyy/mm/dd
 * @returns fecha en formato tipo Date
 */
export const asnStringDateToDate = (date: string): Date => {
    const year = date.slice(0, 4);
    const month = date.slice(4, 6);
    const day = date.slice(6, 8);

    return new Date(`${year}/${month}/${day}`);
}