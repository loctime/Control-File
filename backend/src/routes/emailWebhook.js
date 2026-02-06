const express = require("express");

const router = express.Router();

router.post("/email-inbound", async (req, res) => {

    console.log("📩 Email recibido:");

    console.log(req.body);

    // acá después parseamos patente, velocidad, etc.

    res.status(200).send("OK");
});

module.exports = router;
