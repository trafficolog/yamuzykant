<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

use Aws\Signature\S3SignatureV4;

/**
 * SigV4 для presigned PUT, где Content-Length и Content-Type подписаны (входят в X-Amz-SignedHeaders).
 * Браузер не может изменить Content-Length, а Content-Type отправляет ровно тот, что выдан в UploadTicket.
 */
final class SignedHeadersS3Signature extends S3SignatureV4
{
    /** @return array<string, bool> */
    protected function getHeaderBlacklist()
    {
        $blacklist = parent::getHeaderBlacklist();
        unset($blacklist['content-length']);

        return $blacklist;
    }

    /** @return array<string, bool> */
    protected function getPresignHeaderDenyList()
    {
        $deny = parent::getPresignHeaderDenyList();
        unset($deny['content-type']);

        return $deny;
    }
}
