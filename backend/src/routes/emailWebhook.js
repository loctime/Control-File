const express = require("express");
const cheerio = require("cheerio");
const axios = require("axios");

const router = express.Router();

router.post("/email-inbound", async (req, res) => {

    console.log("📩 Email recibido");

    const emailId = req.body?.data?.email_id;

    if (!emailId) {
        console.log("❌ No hay email_id");
        return res.status(200).send("OK");
    }

    try {

        const response = await axios.get(
            `https://api.resend.com/emails/${emailId}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.RESEND_API_KEY}`
                }
            }
        );

        const html = response.data?.html;

        if (!html) {
            console.log("❌ No hay HTML en Resend API");
            return res.status(200).send("OK");
        }

        const $ = cheerio.load(html);

        const rows = [];

        $("td").each((i, el) => {
            rows.push($(el).text().trim());
        });

        console.log("🔥 Datos extraidos:", rows);

    } catch (err) {
        console.log("❌ Error obteniendo email:", err.message);
    }

    res.status(200).send("OK");
});

module.exports = router;
