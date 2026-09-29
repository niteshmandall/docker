<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = \app('FireflyIII\User')->where('email', 'niteshnunfara0@gmail.com')->first();
if (!$user) {
    echo "ERROR: User not found\n";
    exit(1);
}
$tokenResult = $user->createToken('GmailSync');
echo "TOKEN:" . $tokenResult->accessToken . "\n";
