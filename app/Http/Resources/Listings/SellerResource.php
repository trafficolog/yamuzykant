<?php

declare(strict_types=1);

namespace App\Http\Resources\Listings;

use App\Domain\Accounts\Models\User;
use App\Support\MemberSince;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Шапка страницы продавца (UC-V2): явный список полей. Почта, yandex_id, телефон и дата входа наружу не уходят
 * (BR-04); id — только для адреса страницы. Нужна связь `city`.
 *
 * @mixin User
 */
final class SellerResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'city' => $this->city === null ? null : ['type' => $this->city->settlement_type, 'name' => $this->city->name],
            'since' => MemberSince::month($this->created_at),
        ];
    }
}
