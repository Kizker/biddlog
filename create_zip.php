<?php
$zip = new ZipArchive();
$filename = 'c:/laragon/www/biddlog/public/biddlog-portable.zip';

if ($zip->open($filename, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
    exit("Cannot open <$filename>\n");
}

$dir = 'c:/laragon/www/biddlog/biddlog_legacy/collector';
$iterator = new RecursiveIteratorIterator(
    new RecursiveCallbackFilterIterator(
        new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
        function ($current, $key, $iterator) {
            // Skip .venv and __pycache__ and output
            if ($iterator->hasChildren()) {
                $basename = $current->getBasename();
                if ($basename === '.venv' || $basename === '__pycache__' || $basename === 'output') {
                    return false;
                }
            }
            return true;
        }
    )
);

foreach ($iterator as $file) {
    $filePath = $file->getPathname();
    $relativePath = substr($filePath, strlen($dir) + 1);
    $zip->addFile($filePath, 'biddlog-portable/' . str_replace('\\', '/', $relativePath));
}

$zip->close();
echo "Zip created successfully.\n";
?>
