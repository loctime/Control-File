const express = require("express");
const cheerio = require("cheerio");

const router = express.Router();

router.post("/email-inbound", async (req, res) => {

    console.log("📩 Email recibido");

    function findHtml(obj) {
        for (const key in obj) {
            if (typeof obj[key] === "string" && obj[key].includes("<td")) {
                console.log("🔥 HTML encontrado en:", key);
                console.log(obj[key]);
            }

            if (typeof obj[key] === "object" && obj[key] !== null) {
                findHtml(obj[key]);
            }
        }
    }

    findHtml(req.body);

    res.status(200).send("OK");
});

module.exports = router;
