<?php
$envPath = __DIR__ . '/../.env';
$envExamplePath = __DIR__ . '/../.env.example';

echo "<div style='font-family: sans-serif; padding: 2rem;'>";
echo "<h2>Deployment Script</h2>";

if (!file_exists($envPath)) {
    copy($envExamplePath, $envPath);
    echo "Created .env file.<br>";
}

// Update .env safely using multiline regex
$env = file_get_contents($envExamplePath);
$env = preg_replace('/^DB_CONNECTION=.*$/m', 'DB_CONNECTION=mysql', $env);
$env = preg_replace('/^#?\s*DB_HOST=.*$/m', 'DB_HOST=127.0.0.1', $env);
$env = preg_replace('/^#?\s*DB_PORT=.*$/m', 'DB_PORT=3306', $env);
$env = preg_replace('/^#?\s*DB_DATABASE=.*$/m', 'DB_DATABASE=u141095167_bid', $env);
$env = preg_replace('/^#?\s*DB_USERNAME=.*$/m', 'DB_USERNAME=u141095167_headbid', $env);
$env = preg_replace('/^#?\s*DB_PASSWORD=.*$/m', 'DB_PASSWORD="@Dea18022003"', $env);
$env = preg_replace('/^APP_URL=.*$/m', 'APP_URL=https://biddlog.site', $env);
$env = preg_replace('/^APP_ENV=.*$/m', 'APP_ENV=production', $env);
$env = preg_replace('/^APP_DEBUG=.*$/m', 'APP_DEBUG=false', $env);

file_put_contents($envPath, $env);
echo "Database credentials injected into .env.<br>";

// Load Dotenv manually to ensure the current PHP process sees the new values
try {
    $dotenv = \Dotenv\Dotenv::createMutable(__DIR__ . '/../');
    $dotenv->load();
} catch (\Exception $e) {
    echo "Notice: Could not mutable load dotenv.<br>";
}

$cacheDir = __DIR__ . '/../bootstrap/cache';
if (!is_dir($cacheDir)) {
    mkdir($cacheDir, 0775, true);
    echo "Created bootstrap/cache directory.<br>";
}

// Run Laravel Artisan Commands
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);

echo "Clearing Config Cache...<br>";
try {
    $kernel->call('config:clear');
} catch (Exception $e) {
    echo "Warning: could not clear config: " . $e->getMessage() . "<br>";
}

echo "Generating App Key...<br>";
$kernel->call('key:generate', ['--force' => true]);

echo "Running Migrations and Seeders...<br>";
try {
    $status = $kernel->call('migrate:fresh', ['--seed' => true, '--force' => true]);
    echo "<pre>" . htmlspecialchars($kernel->output()) . "</pre>";
} catch (Exception $e) {
    echo "Error running migrations: " . $e->getMessage() . "<br>";
}

// Import Legacy Tables
echo "Importing legacy data...<br>";
$sqlPath = __DIR__ . '/biddlog_legacy.sql';
if (file_exists($sqlPath)) {
    // Read the file
    $sql = file_get_contents($sqlPath);
    try {
        \Illuminate\Support\Facades\DB::unprepared($sql);
        echo "Legacy tables imported successfully!<br>";
    } catch (Exception $e) {
        echo "Error importing legacy tables: " . $e->getMessage() . "<br>";
    }
} else {
    echo "biddlog_legacy.sql not found.<br>";
}

echo "<h3>Deployment Complete!</h3>";
echo "Go to <a href='/'>Homepage</a>";
echo "</div>";
