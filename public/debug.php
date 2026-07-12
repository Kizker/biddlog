<?php
$envPath = __DIR__ . '/../.env';
if (file_exists($envPath)) {
    $env = file_get_contents($envPath);
    $env = preg_replace('/^APP_DEBUG=.*$/m', 'APP_DEBUG=true', $env);
    $env = preg_replace('/^APP_ENV=.*$/m', 'APP_ENV=local', $env);
    file_put_contents($envPath, $env);
    echo "Debug mode enabled. ";
} else {
    echo ".env not found! ";
}

require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->call('config:clear');

echo "<a href='/'>Click here to see the actual error</a>";
