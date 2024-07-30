import axios from "axios"

export const sendMail = async (sendmailObj: SendMailObj) => {
    const url = 'https://automationplatform.azurewebsites.net/api/mailnotification'
    return axios.post(url, {
        ...sendmailObj,
        SenderName: process.env.EMAIL_SENDER_NAME ?? '',
        SenderMail: process.env.EMAIL_SENDER_MAIL ?? '',
    })
}

export interface SendMailObj {
    SenderName?: string
    SenderMail?: string
    To: string[]
    Subject: string
    Body: string
    isHTML: boolean
    HTMLBody: string
}