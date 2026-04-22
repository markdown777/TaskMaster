# TaskMaster Edge扩展打包脚本
# 用于创建可提交到Microsoft Edge Add-ons商店的扩展包

Write-Host "开始打包TaskMaster Edge扩展..." -ForegroundColor Green

# 定义需要包含的文件
$includeFiles = @(
    "manifest.json",
    "popup.html",
    "popup.css",
    "popup.js",
    "background.js",
    "options.html",
    "options.js",
    "icons"
)

# 创建临时打包目录
$tempDir = "temp-package"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Name $tempDir | Out-Null

# 复制必要文件到临时目录
foreach ($file in $includeFiles) {
    if (Test-Path $file) {
        if ((Get-Item $file).PSIsContainer) {
            Copy-Item $file -Destination $tempDir -Recurse
            Write-Host "已复制目录: $file" -ForegroundColor Yellow
        } else {
            Copy-Item $file -Destination $tempDir
            Write-Host "已复制文件: $file" -ForegroundColor Yellow
        }
    } else {
        Write-Host "警告: 文件不存在 $file" -ForegroundColor Red
    }
}

# 创建ZIP包
$zipName = "TaskMaster-Edge-v2.9.0.zip"
if (Test-Path $zipName) {
    Remove-Item $zipName -Force
}

# 使用PowerShell压缩
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipName

# 清理临时目录
Remove-Item $tempDir -Recurse -Force

# 验证ZIP文件
if (Test-Path $zipName) {
    $zipSize = (Get-Item $zipName).Length
    Write-Host ""
    Write-Host "✅ 打包完成!" -ForegroundColor Green
    Write-Host "📦 文件名: $zipName" -ForegroundColor Cyan
    Write-Host "📏 文件大小: $([math]::Round($zipSize/1KB, 2)) KB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🚀 现在可以将 $zipName 提交到Microsoft Edge Add-ons商店!" -ForegroundColor Green
    Write-Host "📖 提交地址: https://partner.microsoft.com/dashboard/microsoftedge/overview" -ForegroundColor Blue
} else {
    Write-Host "❌ 打包失败!" -ForegroundColor Red
}

Write-Host ""
Write-Host "按任意键继续..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")