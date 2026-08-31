$ErrorActionPreference = 'Stop'

$androidRoot = $PSScriptRoot
$projectRoot = Split-Path -Parent $androidRoot
$releaseDir = Join-Path $projectRoot 'release-android-20260830-v5-obraativa'
$buildTools = 'C:\Users\claud\.bubblewrap\android_sdk\build-tools\36.1.0'
$zipalign = Join-Path $buildTools 'zipalign.exe'
$apksigner = Join-Path $buildTools 'apksigner.bat'
$keystore = Join-Path $androidRoot 'android.keystore'
$passwordFile = Join-Path $projectRoot 'backups\android-playstore-v1\signing-password.dpapi.xml'
$unsignedApk = Join-Path $androidRoot 'app\build\outputs\apk\release\app-release-unsigned.apk'
$sourceAab = Join-Path $androidRoot 'app\build\outputs\bundle\release\app-release.aab'
$alignedApk = Join-Path $releaseDir 'escritorio-da-minha-obra-v5-aligned.apk'
$signedApk = Join-Path $releaseDir 'escritorio-da-minha-obra-v5.apk'
$signedAab = Join-Path $releaseDir 'escritorio-da-minha-obra-v5.aab'

New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
$securePassword = Import-Clixml -LiteralPath $passwordFile
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    & $zipalign -f 4 $unsignedApk $alignedApk
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao alinhar o APK.' }

    "$password`n$password" | & $apksigner sign `
        --ks $keystore `
        --ks-key-alias controledeobra `
        --ks-pass stdin `
        --key-pass stdin `
        --out $signedApk `
        $alignedApk
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao assinar o APK.' }

    Copy-Item -LiteralPath $sourceAab -Destination $signedAab -Force
    $env:OBRA_ANDROID_SIGNING_PASSWORD = $password
    & jarsigner.exe `
        -sigalg SHA256withRSA `
        -digestalg SHA-256 `
        -keystore $keystore `
        -storepass:env OBRA_ANDROID_SIGNING_PASSWORD `
        -keypass:env OBRA_ANDROID_SIGNING_PASSWORD `
        $signedAab `
        controledeobra
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao assinar o AAB.' }
}
finally {
    Remove-Item Env:OBRA_ANDROID_SIGNING_PASSWORD -ErrorAction SilentlyContinue
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
    $password = $null
}

Remove-Item -LiteralPath $alignedApk -Force
& $apksigner verify --verbose --print-certs $signedApk | Select-String 'Verified|Signer #1 certificate SHA-256 digest'
if ($LASTEXITCODE -ne 0) { throw 'A verificação do APK falhou.' }

& jarsigner.exe -verify $signedAab
if ($LASTEXITCODE -ne 0) { throw 'A verificação do AAB falhou.' }

Get-FileHash -Algorithm SHA256 -LiteralPath $signedApk, $signedAab |
    Select-Object Path, Hash
