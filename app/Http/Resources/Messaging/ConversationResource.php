<?php

declare(strict_types=1);

namespace App\Http\Resources\Messaging;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Messaging\Models\Conversation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Беседа глазами участника: роль, объявление (id, название, цена, открыто ли для сообщений) и собеседник —
 * только имя (BR-04: почта, yandex_id и прочие ПДн не уходят). Удалившийся собеседник — без имени (BR-09).
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
            ],
            'counterpart' => [
                'name' => $counterpart === null ? (string) __('messaging.deleted_user') : $counterpart->name,
                'deleted' => $counterpart === null,
            ],
            'last_message_at' => $conversation->last_message_at?->toIso8601ZuluString(),
        ];
    }
}
