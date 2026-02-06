const express = require("express");
const cheerio = require("cheerio");

const router = express.Router();

router.post("/email-inbound", async (req, res) => {

    console.log("📩 Email recibido");

    const html = req.body?.data?.html;

    if (!html) {
        console.log("❌ No hay HTML");
        return res.status(200).send("OK");
    }

    const $ = cheerio.load(html);

    const rows = [];

    $("td").each((i, el) => {
        rows.push($(el).text().trim());
    });

    console.log("Datos extraidos:", rows);

    res.status(200).send("OK");
});

module.exports = router;
