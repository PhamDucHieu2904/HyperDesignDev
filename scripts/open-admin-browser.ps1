$adminUrl = 'http://127.0.0.1:8788'
$adminDeadline = (Get-Date).AddMinutes(2)
while ((Get-Date) -lt $adminDeadline) {
    try {
        $adminResponse = Invoke-WebRequest -Uri $adminUrl -UseBasicParsing -TimeoutSec 2
        if ($adminResponse.StatusCode -eq 200 -and $adminResponse.Content -match '<title>Hyper D Admin</title>') {
            Start-Process $adminUrl
            exit 0
        }
    } catch {
        # The Worker is still building or starting.
    }
    Start-Sleep -Seconds 1
}
Write-Host "Admin did not become ready. Check the server window, then open $adminUrl manually."
exit 1
