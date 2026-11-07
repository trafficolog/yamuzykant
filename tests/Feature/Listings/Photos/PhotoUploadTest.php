<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Events\ListingSubstantiallyEdited;
use App\Domain\Listings\Jobs\ProcessListingPhoto;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Listings\Photos\PendingPhotoUploads;
use App\Domain\Listings\Photos\S3PresignedUploads;
use App\Domain\Listings\Photos\UploadTicket;
use Aws\S3\S3Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\Support\ImageFixtures;

// BR-03, UC-L1 п. 4: прямая загрузка по подписанному URL, подтверждение на бэкенде, проверка по содержимому.

beforeEach(function () {
    config(['scout.driver' => 'null']);
    Storage::fake(config('photos.disk'));
    Queue::fake();
});

function photoOwner(): User
{
    return User::factory()->create();
}

function draftOf(User $user): Listing
{
    return Listing::factory()->for($user)->create();
}

/** @return TestResponse<JsonResponse> */
function requestUpload(Listing $listing, string $type = 'image/jpeg', int $size = 1000): TestResponse
{
    return currentTest()->postJson("/listings/{$listing->id}/photos/uploads", ['content_type' => $type, 'size' => $size]);
}

/** Загрузить байты по выданному URL (локальный приёмник в тестах) и вернуть upload_id. */
function uploadBytes(Listing $listing, string $bytes, string $type = 'image/jpeg'): string
{
    $ticket = requestUpload($listing, $type, strlen($bytes))->assertCreated()->json();

    currentTest()->call('PUT', $ticket['url'], [], [], [], ['CONTENT_TYPE' => $type], $bytes)->assertNoContent();

    return $ticket['upload_id'];
}

/** @return TestResponse<JsonResponse> */
function confirmUpload(Listing $listing, string $uploadId, bool $serial = false): TestResponse
{
    return currentTest()->postJson("/listings/{$listing->id}/photos", ['upload_id' => $uploadId, 'serial' => $serial]);
}

/** Подтверждённые фото без обработки (Queue::fake). */
function addPhotos(Listing $listing, int $count, bool $firstIsSerial = true): void
{
    for ($i = 0; $i < $count; $i++) {
        confirmUpload($listing, uploadBytes($listing, ImageFixtures::jpeg(64, 48)), $firstIsSerial && $i === 0)->assertCreated();
    }
}

describe('presign', function () {
    it('владелец черновика получает URL загрузки: PUT, короткий срок, Content-Type в заголовках', function () {
        $user = photoOwner();
        $listing = draftOf($user);

        $response = $this->actingAs($user)->postJson("/listings/{$listing->id}/photos/uploads", [
            'content_type' => 'image/jpeg',
            'size' => 2_400_000,
        ]);

        $response->assertCreated()->assertJsonStructure(['upload_id', 'url', 'method', 'headers', 'expires_at']);
        expect($response->json('method'))->toBe('PUT')
            ->and($response->json('headers.Content-Type'))->toBe('image/jpeg');
        $expiresIn = now()->diffInSeconds($response->json('expires_at'));
        expect($expiresIn)->toBeGreaterThan(0)->toBeLessThanOrEqual(config('photos.upload_ttl'))
            ->and(config('photos.upload_ttl'))->toBeLessThanOrEqual(900);
    });

    it('принимает JPEG, PNG и HEIC', function (string $type) {
        $user = photoOwner();
        $this->actingAs($user);

        requestUpload(draftOf($user), $type)->assertCreated();
    })->with(['image/jpeg', 'image/png', 'image/heic', 'image/heif']);

    it('отказывает другим типам с понятным текстом', function (string $type) {
        $user = photoOwner();
        $this->actingAs($user);

        requestUpload(draftOf($user), $type)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['content_type' => 'Загрузите фото в формате JPEG, PNG или HEIC.']);
    })->with(['application/pdf', 'image/gif', 'image/svg+xml', 'text/html']);

    it('отказывает файлу больше 15 МБ до загрузки', function () {
        $user = photoOwner();
        $this->actingAs($user);

        requestUpload(draftOf($user), 'image/jpeg', 15 * 1024 * 1024 + 1)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['size' => 'Фото больше 15 МБ. Уменьшите его и загрузите снова.']);
        requestUpload(draftOf($user), 'image/jpeg', 15 * 1024 * 1024)->assertCreated();
    });

    it('гостю — 401, чужому — 403', function () {
        $listing = draftOf(photoOwner());

        requestUpload($listing)->assertUnauthorized();

        $this->actingAs(photoOwner());
        requestUpload($listing)->assertForbidden();
    });

    it('не выдаёт URL, когда фото уже 12', function () {
        $user = photoOwner();
        $listing = draftOf($user);
        $this->actingAs($user);
        addPhotos($listing, 12);

        requestUpload($listing)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['photos' => 'Можно добавить не больше 12 фото. Удалите лишнее, чтобы добавить новое.']);
    });
});

describe('S3: подпись PUT', function () {
    function s3Uploads(): S3PresignedUploads
    {
        $client = new S3Client([
            'version' => 'latest',
            'region' => 'us-east-1',
            'endpoint' => 'http://127.0.0.1:9000',
            'use_path_style_endpoint' => true,
            'credentials' => ['key' => 'test-key', 'secret' => 'test-secret'],
        ]);

        return new S3PresignedUploads($client, 'ymuzykant');
    }

    it('подписывает content-length и content-type: другой размер или тип S3 отвергнет', function () {
        $ticket = s3Uploads()->ticket('uploads/listing/abc', 'image/png', 123_456, now()->addMinutes(5));

        expect($ticket)->toBeInstanceOf(UploadTicket::class)
            ->and($ticket->method)->toBe('PUT')
            ->and($ticket->headers)->toBe(['Content-Type' => 'image/png']);

        parse_str((string) parse_url($ticket->url, PHP_URL_QUERY), $query);
        $signedHeaders = $query['X-Amz-SignedHeaders'] ?? '';
        $expires = $query['X-Amz-Expires'] ?? '';
        expect(parse_url($ticket->url, PHP_URL_PATH))->toBe('/ymuzykant/uploads/listing/abc')
            ->and(explode(';', is_string($signedHeaders) ? $signedHeaders : ''))->toContain('content-length', 'content-type', 'host')
            ->and(is_string($expires) ? (int) $expires : 0)->toBeGreaterThan(0)->toBeLessThanOrEqual(300)
            ->and($query)->toHaveKey('X-Amz-Signature');
    });

    it('подпись зависит от размера и типа', function () {
        $expires = now()->addMinutes(5);
        $a = s3Uploads()->ticket('uploads/x', 'image/jpeg', 100, $expires);
        $b = s3Uploads()->ticket('uploads/x', 'image/jpeg', 101, $expires);
        $c = s3Uploads()->ticket('uploads/x', 'image/png', 100, $expires);

        expect($a->url)->not->toBe($b->url)->and($a->url)->not->toBe($c->url);
    });
});

describe('локальный приёмник (тесты и e2e без S3)', function () {
    it('без подписи — 403', function () {
        $user = photoOwner();
        $listing = draftOf($user);
        $ticket = $this->actingAs($user)->postJson("/listings/{$listing->id}/photos/uploads", ['content_type' => 'image/jpeg', 'size' => 10])->json();

        $this->call('PUT', explode('?', (string) $ticket['url'])[0], [], [], [], ['CONTENT_TYPE' => 'image/jpeg'], str_repeat('a', 10))
            ->assertForbidden();
    });

    it('размер или тип не совпали с подписанными — 403, файл не сохранён', function () {
        $user = photoOwner();
        $listing = draftOf($user);
        $ticket = $this->actingAs($user)->postJson("/listings/{$listing->id}/photos/uploads", ['content_type' => 'image/jpeg', 'size' => 10])->json();

        $this->call('PUT', $ticket['url'], [], [], [], ['CONTENT_TYPE' => 'image/jpeg'], str_repeat('a', 11))->assertForbidden();
        $this->call('PUT', $ticket['url'], [], [], [], ['CONTENT_TYPE' => 'image/png'], str_repeat('a', 10))->assertForbidden();

        expect(Storage::disk(config('photos.disk'))->allFiles())->toBe([]);
    });
});

describe('confirm', function () {
    it('создаёт фото в обработке и ставит job перекодирования', function () {
        $user = photoOwner();
        $listing = draftOf($user);
        $this->actingAs($user);

        $response = confirmUpload($listing, uploadBytes($listing, ImageFixtures::jpeg()), serial: true);

        $response->assertCreated()
            ->assertJsonPath('data.is_serial', true)
            ->assertJsonPath('data.position', 0)
            ->assertJsonPath('data.state', 'processing')
            ->assertJsonPath('data.urls', null);
        $photo = ListingPhoto::query()->sole();
        expect($photo->listing_id)->toBe($listing->id);
        Queue::assertPushed(ProcessListingPhoto::class, fn (ProcessListingPhoto $job) => $job->photoId === $photo->id);
    });

    it('PDF с расширением .jpg отклоняется по содержимому, файл удаляется', function () {
        $user = photoOwner();
        $listing = draftOf($user);
        $this->actingAs($user);
        $uploadId = uploadBytes($listing, ImageFixtures::pdf(), 'image/jpeg');

        confirmUpload($listing, $uploadId)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['upload_id' => 'Это не фото. Загрузите файл в формате JPEG, PNG или HEIC.']);

        expect(ListingPhoto::query()->count())->toBe(0)
            ->and(Storage::disk(config('photos.disk'))->allFiles())->toBe([]);
        Queue::assertNothingPushed();
    });

    it('HEIC определяется по содержимому и принимается', function () {
        $user = photoOwner();
        $listing = draftOf($user);
        $this->actingAs($user);

        confirmUpload($listing, uploadBytes($listing, ImageFixtures::heicHeader(), 'image/heic'))->assertCreated();
    });

    it('файл в хранилище больше 15 МБ отклоняется и удаляется', function () {
        $user = photoOwner();
        $listing = draftOf($user);
        $this->actingAs($user);
        $ticket = requestUpload($listing, 'image/jpeg', 1000)->json();
        $key = (string) app(PendingPhotoUploads::class)->find($ticket['upload_id'])?->key;
        Storage::disk(config('photos.disk'))->put($key, ImageFixtures::oversized(15 * 1024 * 1024));

        confirmUpload($listing, $ticket['upload_id'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['upload_id' => 'Фото больше 15 МБ. Уменьшите его и загрузите снова.']);

        expect(Storage::disk(config('photos.disk'))->exists($key))->toBeFalse();
    });

    it('файл не загружен — понятная ошибка', function () {
        $user = photoOwner();
        $listing = draftOf($user);
        $this->actingAs($user);
        $ticket = requestUpload($listing)->json();

        confirmUpload($listing, $ticket['upload_id'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['upload_id' => 'Фото не загрузилось. Попробуйте ещё раз.']);
    });

    it('чужую загрузку подтвердить нельзя', function () {
        $owner = photoOwner();
        $listing = draftOf($owner);
        $this->actingAs($owner);
        $uploadId = uploadBytes($listing, ImageFixtures::jpeg());

        // Та же загрузка к другому черновику того же владельца.
        confirmUpload(draftOf($owner), $uploadId)->assertUnprocessable();

        // Чужой пользователь к этому черновику — 403.
        $this->actingAs(photoOwner());
        confirmUpload($listing, $uploadId)->assertForbidden();
    });

    it('загрузку подтверждают один раз', function () {
        $user = photoOwner();
        $listing = draftOf($user);
        $this->actingAs($user);
        $uploadId = uploadBytes($listing, ImageFixtures::jpeg());

        confirmUpload($listing, $uploadId)->assertCreated();
        confirmUpload($listing, $uploadId)->assertUnprocessable();
        expect(ListingPhoto::query()->count())->toBe(1);
    });

    it('второе фото серийного номера — отказ', function () {
        $user = photoOwner();
        $listing = draftOf($user);
        $this->actingAs($user);
        addPhotos($listing, 1);

        confirmUpload($listing, uploadBytes($listing, ImageFixtures::jpeg()), serial: true)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['serial' => 'Фото серийного номера уже есть. Удалите его, чтобы загрузить другое.']);
    });

    it('тринадцатое фото — отказ', function () {
        $user = photoOwner();
        $listing = draftOf($user);
        $this->actingAs($user);
        $uploadId = uploadBytes($listing, ImageFixtures::jpeg(64, 48));
        addPhotos($listing, 12);

        confirmUpload($listing, $uploadId)->assertUnprocessable()->assertJsonValidationErrors(['photos']);
        expect($listing->photos()->count())->toBe(12);
    });

    it('объявление на проверке или снятое менять нельзя', function (ListingStatus $status) {
        $user = photoOwner();
        $listing = Listing::factory()->for($user)->inStatus($status)->create();
        $this->actingAs($user);

        requestUpload($listing)->assertForbidden();
    })->with([
        'pending' => [ListingStatus::Pending],
        'withdrawn' => [ListingStatus::Withdrawn],
        'rejected' => [ListingStatus::Rejected],
        'expired' => [ListingStatus::Expired],
    ]);

    it('новое фото у опубликованного — существенная правка через машину объявления', function () {
        Event::fake([ListingSubstantiallyEdited::class]);
        $user = photoOwner();
        $listing = Listing::factory()->for($user)->inStatus(ListingStatus::Published)->create();
        $this->actingAs($user);

        confirmUpload($listing, uploadBytes($listing, ImageFixtures::jpeg()))->assertCreated();

        Event::assertDispatched(ListingSubstantiallyEdited::class, fn ($e) => $e->listing->is($listing));
    });
});

describe('порядок и удаление', function () {
    it('список фото владельца: серийное, затем по порядку', function () {
        $user = photoOwner();
        $listing = draftOf($user);
        $this->actingAs($user);
        addPhotos($listing, 3);

        $this->getJson("/listings/{$listing->id}/photos")
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.is_serial', true)
            ->assertJsonPath('data.2.position', 2);

        $this->actingAs(photoOwner());
        $this->getJson("/listings/{$listing->id}/photos")->assertForbidden();
    });

    it('меняет порядок', function () {
        $user = photoOwner();
        $listing = draftOf($user);
        $this->actingAs($user);
        addPhotos($listing, 3);
        [$a, $b, $c] = $listing->photos()->pluck('id')->all();

        $this->putJson("/listings/{$listing->id}/photos/order", ['photos' => [$a, $c, $b]])
            ->assertOk()
            ->assertJsonPath('data.1.id', $c)
            ->assertJsonPath('data.2.id', $b);
        expect($listing->photos()->pluck('id')->all())->toBe([$a, $c, $b]);
    });

    it('порядок — перестановка всех фото объявления, иначе отказ', function () {
        $user = photoOwner();
        $listing = draftOf($user);
        $this->actingAs($user);
        addPhotos($listing, 3);
        [$a, $b] = $listing->photos()->pluck('id')->all();
        $foreign = ListingPhoto::query()->create(['listing_id' => draftOf(photoOwner())->id, 'path' => 'x', 'position' => 0]);

        $this->putJson("/listings/{$listing->id}/photos/order", ['photos' => [$a, $b]])->assertUnprocessable();
        $this->putJson("/listings/{$listing->id}/photos/order", ['photos' => [$a, $b, $foreign->id]])->assertUnprocessable();
    });

    it('удаляет фото и его файлы, порядок без дыр', function () {
        $user = photoOwner();
        $listing = draftOf($user);
        $this->actingAs($user);
        addPhotos($listing, 3);
        $second = $listing->photos()->where('position', 1)->firstOrFail();
        $disk = Storage::disk(config('photos.disk'));
        $disk->put($second->path.'/square.webp', 'x');

        $this->deleteJson("/listings/{$listing->id}/photos/{$second->id}")
            ->assertOk()
            ->assertJsonCount(2, 'data');

        expect($listing->photos()->pluck('position')->all())->toBe([0, 1])
            ->and($disk->exists($second->path.'/square.webp'))->toBeFalse();
    });

    it('у опубликованного: удаление — существенная правка; меньше 3 фото или без серийного — отказ', function () {
        $user = photoOwner();
        $listing = draftOf($user);
        $this->actingAs($user);
        addPhotos($listing, 4);
        // Опубликовать в обход машины: проверяется правка фото, а не публикация (2.1.4).
        $listing = Listing::factory()->for($user)->inStatus(ListingStatus::Published)->create();
        foreach (ListingPhoto::query()->get() as $photo) {
            $photo->update(['listing_id' => $listing->id]);
        }
        [$serial, $second, $third] = $listing->photos()->get()->all();
        Event::fake([ListingSubstantiallyEdited::class]);

        $this->deleteJson("/listings/{$listing->id}/photos/{$serial->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['photos' => 'У опубликованного объявления должно быть фото серийного номера и не меньше 3 фото.']);

        $this->deleteJson("/listings/{$listing->id}/photos/{$second->id}")->assertOk();
        Event::assertDispatched(ListingSubstantiallyEdited::class);

        $this->deleteJson("/listings/{$listing->id}/photos/{$third->id}")->assertUnprocessable();
        expect($listing->photos()->count())->toBe(3);
    });

    it('чужое фото удалить нельзя', function () {
        $user = photoOwner();
        $listing = draftOf($user);
        $this->actingAs($user);
        addPhotos($listing, 1);
        $photo = $listing->photos()->sole();

        $this->actingAs(photoOwner());
        $this->deleteJson("/listings/{$listing->id}/photos/{$photo->id}")->assertForbidden();

        $other = draftOf($user);
        $this->actingAs($user);
        $this->deleteJson("/listings/{$other->id}/photos/{$photo->id}")->assertNotFound();
    });
});
