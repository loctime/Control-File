# ==============================
# CONFIGURACION
# ==============================

$BACKEND_GET_URL  = "https://controlfile.onrender.com/api/email/get-pending-daily-alerts"
$BACKEND_MARK_URL = "https://controlfile.onrender.com/api/email/mark-alert-sent"
$LOCAL_TOKEN = "61d4f092-2c7d-4fdf-8f83-624859888d77"

# CUENTA DESDE LA CUAL SE DEBE ENVIAR
$SEND_FROM = "hys@maximia.com.ar"

# ==============================
# OBTENER ALERTAS PENDIENTES
# ==============================

try {

    Write-Host "Obteniendo alertas pendientes desde: $BACKEND_GET_URL"
    
    $response = Invoke-RestMethod `
        -Uri $BACKEND_GET_URL `
        -Method GET `
        -Headers @{ "x-local-token" = $LOCAL_TOKEN }

    Write-Host "Respuesta recibida. ok = $($response.ok)"
    Write-Host "Tipo de response: $($response.GetType().Name)"

    if ($response.ok -ne $true) {
        Write-Host "Error: La respuesta indica que no hay alertas o hubo un error."
        Write-Host "Respuesta completa:"
        $response | ConvertTo-Json -Depth 10
        exit
    }

    # Verificar si la propiedad 'alerts' existe en el objeto
    if (-not ($response.PSObject.Properties.Name -contains 'alerts')) {
        Write-Host "No se encontró la propiedad 'alerts' en la respuesta."
        Write-Host "Propiedades disponibles: $($response.PSObject.Properties.Name -join ', ')"
        Write-Host "Respuesta completa:"
        $response | ConvertTo-Json -Depth 10
        exit
    }

    # Obtener alerts directamente (puede ser un array vacío)
    $alerts = $response.alerts

    Write-Host "Tipo de alerts: $($alerts.GetType().Name)"
    Write-Host "Cantidad de alertas encontradas: $($alerts.Count)"

    # Verificar si es null o no es un array
    if ($null -eq $alerts) {
        Write-Host "La propiedad 'alerts' es null."
        exit
    }

    if ($alerts -isnot [System.Array] -and $alerts -isnot [System.Collections.IEnumerable]) {
        Write-Host "La propiedad 'alerts' no es un array. Tipo: $($alerts.GetType().Name)"
        Write-Host "Valor:"
        $alerts | ConvertTo-Json -Depth 10
        exit
    }

    if ($alerts.Count -eq 0) {
        Write-Host "No hay alertas pendientes."
        exit
    }

    $outlook = New-Object -ComObject Outlook.Application
    $namespace = $outlook.GetNamespace("MAPI")

    # Buscar la cuenta correcta
    $accountToUse = $null

    foreach ($account in $outlook.Session.Accounts) {
        if ($account.SmtpAddress -eq $SEND_FROM) {
            $accountToUse = $account
            break
        }
    }

    if (-not $accountToUse) {
        Write-Host "No se encontró la cuenta $SEND_FROM en Outlook."
        exit
    }

    Write-Host "Procesando $($alerts.Count) alertas..."

    foreach ($alert in $alerts) {

        Write-Host "Enviando alerta para patente $($alert.plate)"

        $mail = $outlook.CreateItem(0)

        # FORZAR cuenta de envío
        $mail.SendUsingAccount = $accountToUse

        $mail.To = ($alert.responsables -join ";")
        $mail.Subject = $alert.subject
        $mail.HTMLBody = $alert.body

        try {
            $mail.Send()
            Write-Host "Email enviado correctamente desde $SEND_FROM."

            # Marcar como enviada
            $markResponse = Invoke-RestMethod `
                -Uri $BACKEND_MARK_URL `
                -Method POST `
                -Headers @{ "x-local-token" = $LOCAL_TOKEN } `
                -Body (@{ alertId = $alert.alertId } | ConvertTo-Json) `
                -ContentType "application/json"

            Write-Host "Alerta marcada como enviada: $($alert.alertId)"

        } catch {
            Write-Host "Error enviando email:"
            Write-Host $_
            Write-Host "Stack trace:"
            Write-Host $_.Exception.StackTrace
        }
    }

    Write-Host "Proceso completado."

} catch {
    Write-Host "Error general en el script:"
    Write-Host $_
    Write-Host "Stack trace:"
    Write-Host $_.Exception.StackTrace
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Respuesta del servidor:"
        Write-Host $responseBody
    }
}
