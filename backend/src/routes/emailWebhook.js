const express = require("express");
const cheerio = require("cheerio");

const router = express.Router();

/**
 * Endpoint POST /email-inbound
 * 
 * Recibe webhooks inbound de Resend y procesa el email completo
 * que viene en el payload del webhook.
 * 
 * NO hace llamadas HTTP adicionales a Resend.
 * El contenido completo del email ya viene en el webhook.
 */
router.post("/email-inbound", async (req, res) => {
    // Siempre responder 200 OK para no romper el webhook
    // incluso si hay errores en el procesamiento
    try {
        console.log("📩 [EMAIL-INBOUND] Webhook recibido");
        console.log("📦 [EMAIL-INBOUND] Tipo de evento:", req.body?.type || "desconocido");

        // Extraer datos del webhook según estructura de Resend Inbound
        const webhookData = req.body?.data;

        if (!webhookData) {
            console.log("⚠️  [EMAIL-INBOUND] Payload sin campo 'data', respondiendo OK");
            return res.status(200).send("OK");
        }

        // Extraer campos básicos del email de forma defensiva
        const emailId = webhookData.id || null;
        const from = webhookData.from || null;
        const to = Array.isArray(webhookData.to) ? webhookData.to : (webhookData.to ? [webhookData.to] : []);
        const subject = webhookData.subject || "(sin asunto)";
        const html = webhookData.html || null;
        const text = webhookData.text || null;
        const headers = webhookData.headers || {};
        const attachments = Array.isArray(webhookData.attachments) ? webhookData.attachments : [];

        // Logs de metadata básica
        console.log("📧 [EMAIL-INBOUND] Metadata del email:");
        console.log("   ID:", emailId || "N/A");
        console.log("   From:", from || "N/A");
        console.log("   To:", to.length > 0 ? to.join(", ") : "N/A");
        console.log("   Subject:", subject);

        // Logs de contenido
        if (html) {
            console.log("✅ [EMAIL-INBOUND] HTML presente:", html.length, "caracteres");
        } else {
            console.log("⚠️  [EMAIL-INBOUND] Sin contenido HTML");
        }

        if (text) {
            console.log("✅ [EMAIL-INBOUND] Texto plano presente:", text.length, "caracteres");
        } else {
            console.log("⚠️  [EMAIL-INBOUND] Sin contenido de texto plano");
        }

        // Logs de headers
        if (Object.keys(headers).length > 0) {
            console.log("📋 [EMAIL-INBOUND] Headers presentes:", Object.keys(headers).length, "headers");
            // Log de algunos headers importantes sin exponer todo
            if (headers["message-id"]) {
                console.log("   Message-ID:", headers["message-id"]);
            }
            if (headers["date"]) {
                console.log("   Date:", headers["date"]);
            }
        } else {
            console.log("⚠️  [EMAIL-INBOUND] Sin headers");
        }

        // Logs de attachments
        if (attachments.length > 0) {
            console.log("📎 [EMAIL-INBOUND] Attachments encontrados:", attachments.length);
            attachments.forEach((att, idx) => {
                console.log(`   [${idx + 1}] ${att.filename || "sin nombre"} (${att.content_type || "tipo desconocido"}, ${att.size || 0} bytes)`);
            });
        } else {
            console.log("ℹ️  [EMAIL-INBOUND] Sin attachments");
        }

        // Parsear HTML con cheerio de forma segura
        if (html) {
            try {
                const $ = cheerio.load(html, {
                    // Opciones de seguridad para cheerio
                    xml: false,
                    decodeEntities: true
                });

                // Extraer texto general del HTML (sin etiquetas)
                const plainTextFromHtml = $.text().trim();
                console.log("🔍 [EMAIL-INBOUND] Texto extraído del HTML:", plainTextFromHtml.length, "caracteres");

                // Ejemplo: extraer todos los párrafos
                const paragraphs = [];
                $("p").each((i, el) => {
                    const text = $(el).text().trim();
                    if (text) {
                        paragraphs.push(text);
                    }
                });

                if (paragraphs.length > 0) {
                    console.log("📝 [EMAIL-INBOUND] Párrafos encontrados:", paragraphs.length);
                }

                // Ejemplo: extraer todos los enlaces
                const links = [];
                $("a").each((i, el) => {
                    const href = $(el).attr("href");
                    const text = $(el).text().trim();
                    if (href) {
                        links.push({ href, text });
                    }
                });

                if (links.length > 0) {
                    console.log("🔗 [EMAIL-INBOUND] Enlaces encontrados:", links.length);
                }

                // Aquí puedes agregar más lógica de parsing según tus necesidades
                // Por ejemplo, buscar tablas, formularios, etc.

            } catch (parseError) {
                console.error("❌ [EMAIL-INBOUND] Error al parsear HTML con cheerio:", parseError.message);
                // Continuar el procesamiento aunque falle el parsing
            }
        }

        // Preparar objeto con datos extraídos (listo para persistir en Firestore luego)
        const emailData = {
            id: emailId,
            from,
            to,
            subject,
            html,
            text,
            headers,
            attachments,
            receivedAt: new Date().toISOString(),
            // Aquí puedes agregar más campos procesados del HTML si es necesario
        };

        console.log("✅ [EMAIL-INBOUND] Email procesado correctamente");
        console.log("💾 [EMAIL-INBOUND] Listo para persistir en Firestore (no implementado aún)");

        // TODO: Aquí irá la persistencia en Firestore
        // await firestore.collection('emails').add(emailData);

    } catch (error) {
        // Manejo defensivo de errores
        // Siempre responder 200 OK para no romper el webhook
        console.error("❌ [EMAIL-INBOUND] Error inesperado:", error.message);
        console.error("   Stack:", error.stack);
    }

    // Siempre responder 200 OK
    res.status(200).send("OK");
});

module.exports = router;
