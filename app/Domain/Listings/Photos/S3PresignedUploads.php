<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

use Aws\Credentials\CredentialsInterface;
use Aws\S3\S3Client;
use Carbon\CarbonInterface;

use function Aws\serialize;

/**
 * Прямая загрузка в S3 по presigned PUT. SDK намеренно не подписывает Content-Length и Content-Type
 * в presigned URL, поэтому подпись делает SignedHeadersS3Signature: оба заголовка входят в
 * X-Amz-SignedHeaders, и S3 (или MinIO) отвергает запрос другого размера или типа (403).
 */
final class S3PresignedUploads implements PhotoUploads
{
    public function __construct(
        private readonly S3Client $client,
        private readonly string $bucket,
    ) {}

    public function ticket(string $key, string $contentType, int $size, CarbonInterface $expiresAt): UploadTicket
    {
        $command = $this->client->getCommand('PutObject', ['Bucket' => $this->bucket, 'Key' => $key]);
        $request = serialize($command)
            ->withHeader('Content-Type', $contentType)
            ->withHeader('Content-Length', (string) $size);

        /** @var CredentialsInterface $credentials */
        $credentials = $this->client->getCredentials()->wait();
        $signer = new SignedHeadersS3Signature('s3', $this->client->getRegion());
        $signed = $signer->presign($request, $credentials, $expiresAt->getTimestamp());

        return new UploadTicket(
            url: (string) $signed->getUri(),
            method: 'PUT',
            headers: ['Content-Type' => $contentType],
            expiresAt: $expiresAt,
        );
    }
}
