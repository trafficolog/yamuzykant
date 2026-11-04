<?php

declare(strict_types=1);

use App\Domain\Listings\Photos\S3PresignedUploads;
use Aws\S3\S3Client;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

// Живая проверка подписи PUT в MinIO из compose (`composer test:docker`): S3 сам отвергает
// загрузку другого размера или типа, потому что content-length и content-type входят в подпись.

function minioUploads(): array
{
    $config = config('filesystems.disks.s3');
    $client = new S3Client([
        'version' => 'latest',
        'region' => $config['region'] ?: 'us-east-1',
        'endpoint' => $config['endpoint'] ?: 'http://127.0.0.1:9000',
        'use_path_style_endpoint' => true,
        'credentials' => ['key' => $config['key'] ?: 'minioadmin', 'secret' => $config['secret'] ?: 'minioadmin'],
    ]);

    return [$client, new S3PresignedUploads($client, $config['bucket'] ?: 'ymuzykant')];
}

it('MinIO принимает PUT ровно с подписанными размером и типом и отвергает остальное', function () {
    [$client, $uploads] = minioUploads();
    $bucket = config('filesystems.disks.s3.bucket') ?: 'ymuzykant';
    $key = 'uploads/docker-test/'.Str::uuid();
    $body = str_repeat('a', 2048);
    $ticket = $uploads->ticket($key, 'image/jpeg', strlen($body), now()->addMinutes(5));

    $put = fn (string $data, string $type) => Http::withHeaders(['Content-Type' => $type])
        ->withBody($data, $type)
        ->put($ticket->url);

    expect($put($body.'b', 'image/jpeg')->status())->toBe(403)
        ->and($put($body, 'image/png')->status())->toBe(403)
        ->and($put($body, 'image/jpeg')->status())->toBe(200)
        ->and((string) $client->getObject(['Bucket' => $bucket, 'Key' => $key])['Body'])->toBe($body);

    $client->deleteObject(['Bucket' => $bucket, 'Key' => $key]);
})->group('docker');
