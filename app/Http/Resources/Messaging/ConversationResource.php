<?php

declare(strict_types=1);

namespace App\Http\Resources\Messaging;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Photos\PhotoVariant;
use App\Domain\Listings\Photos\PhotoVisibility;
use App\Domain\Messaging\Models\Conversation;
use App\Http\Resources\Listings\ListingPhotoResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Беседа глазами участника: роль, последнее состояние объявления (id, название, цена, статус, обложка) и
 * собеседник — только имя (BR-04: почта, yandex_id и прочие ПДн не уходят). Удалившийся собеседник — без имени
 * (BR-09). Беседа открыта всегда (BR-10, решение OWNER 08.11.2026), поэтому признака «закрыта» нет.
 *
 * Статус объявления (`listing.status`) — без причины снятия: published, sold, withdrawn, expired, pending,
 * rejected. «Продано» — снято с причиной-продажей; снятое модерацией — просто withdrawn. Обложка (`listing.cover`) —
 * ссылки на версию 1:1 (webp, avif) или null; участнику беседы её отдаёт PhotoVisibility. Нужна загруженная связь
 * `listing.photos` (UserConversations) и `listing.saleRecord`.
 *
 * @mixin Conversation
 */
final class ConversationResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var Conversation $conversation */
        $conversation = $this->resource;
        /** @var User $viewer */
        $viewer = $request->user();
        $buying = $conversation->isBuyer($viewer);
        $counterpart = $buying ? $conversation->seller : $conversation->buyer;
        $listing = $conversation->listing;

        return [
            'id' => $conversation->id,
            'role' => $buying ? 'buying' : 'selling',
            'listing' => [
                'id' => $listing->id,
                'title' => $listing->title,
                'price' => $listing->price,
                'available' => $listing->status === ListingStatus::Published,
                'status' => $this->status($listing),
                'cover' => $this->cover($listing),
            ],
            'counterpart' => [
                'name' => $counterpart === null ? (string) __('messaging.deleted_user') : $counterpart->name,
                'deleted' => $counterpart === null,
            ],
            'last_message_at' => $conversation->last_message_at?->toIso8601ZuluString(),
        ];
    }

    /** Статус для карточки в беседе: без причины снятия; не публикуемое — «на проверке». */
    private function status(Listing $listing): string
    {
        return match ($listing->status) {
            ListingStatus::Published => 'published',
            ListingStatus::Withdrawn => $listing->saleRecord?->reason->isSale() === true ? 'sold' : 'withdrawn',
            ListingStatus::Expired => 'expired',
            ListingStatus::Rejected => 'rejected',
            ListingStatus::Draft, ListingStatus::Pending, ListingStatus::NeedsChanges => 'pending',
        };
    }

    /** @return array{webp: string, avif: string}|null */
    private function cover(Listing $listing): ?array
    {
        $photo = PhotoVisibility::cover($listing);
        if ($photo === null) {
            return null;
        }

        // Зритель — участник беседы, а обложку участнику беседы отдаёт PhotoVisibility: ссылка совпадает с раздачей.
        $urls = ListingPhotoResource::urlsFor($photo)[PhotoVariant::Square->value];

        return ['webp' => $urls['webp'], 'avif' => $urls['avif']];
    }
}
