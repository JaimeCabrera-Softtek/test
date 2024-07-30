import axios from "axios"

export const getToken = async () => {
    const url = process.env.GETTOKENPYTHON ?? ''
    const res = await axios.get(url, {
        headers: {
            "user_id": process.env.GETTOKEYPYTHON_UID
        }
    })

    return res.data.token
}