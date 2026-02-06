const express = require("express");
const axios = require("axios");
require("dotenv").config();

const router = express.Router();

router.post("/email-inbound", async (req, res) => {

    console.log("📩 EMAIL RAW COMPLETO:");
    console.dir(req.body, { depth: null });

    // Resend solo envía metadata en el webhook, necesitamos obtener el contenido
    const emailId = req.body?.data?.email_id;
    
    if (emailId && process.env.RESEND_API_KEY) {
        try {
            console.log(`\n📥 Obteniendo contenido del email ${emailId}...`);
            
            const response = await axios.get(`https://api.resend.com/emails/${emailId}`, {
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log("\n📧 CONTENIDO DEL EMAIL:");
            console.log("Subject:", response.data?.subject);
            console.log("From:", response.data?.from);
            console.log("To:", response.data?.to);
            console.log("HTML:", response.data?.html || "(sin HTML)");
            console.log("Text:", response.data?.text || "(sin texto plano)");
            console.log("Headers:", JSON.stringify(response.data?.headers, null, 2));
            
        } catch (error) {
            console.error("❌ Error al obtener contenido del email:", error.response?.data || error.message);
        }
    } else {
        if (!emailId) {
            console.log("⚠️ No se encontró email_id en el webhook");
        }
        if (!process.env.RESEND_API_KEY) {
            console.log("⚠️ RESEND_API_KEY no está configurada en .env");
        }
    }

    res.status(200).send("OK");
});

module.exports = router;
