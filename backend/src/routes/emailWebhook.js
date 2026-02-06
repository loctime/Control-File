const express = require("express");

const router = express.Router();

router.post("/email-inbound", async (req, res) => {

    console.log("📩 Email completo:");
    console.log(JSON.stringify(req.body, null, 2));

    res.status(200).send("OK");
});

module.exports = router;
