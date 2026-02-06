const express = require("express");

const router = express.Router();

router.post("/email-inbound", async (req, res) => {

    console.log("📩 EMAIL RAW COMPLETO:");
    console.dir(req.body, { depth: null });

    res.status(200).send("OK");
});

module.exports = router;
