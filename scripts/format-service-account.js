// format-service-account.js
const fs = require("fs")

const data = JSON.parse(fs.readFileSync("serviceAccountKey-controlfile.json", "utf8"))

// escapar saltos de línea
data.private_key = data.private_key.replace(/\n/g, "\\n")

// convertir a una sola línea
const result = JSON.stringify(data)

console.log(result)