<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Models;

use App\Domain\Accounts\EmailLogin\EmailAddress;
use App\Domain\Catalog\Models\City;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;

/**
 * Пользователь. Почта — идентификатор аккаунта; паролей и телефона нет (SPEC UC-A1, BR-04).
 *
 * @property int $id
 * @property string $email
 * @property string|null $yandex_id
 * @property string $name
 * @property int|null $city_id
 * @property array<string, mixed>|null $notification_prefs
 * @property string|null $consent_version
 * @property Carbon|null $consented_at
 * @property Carbon|null $last_login_at
 * @property int $session_version
 * @property-read City|null $city
 */
#[UseFactory(UserFactory::class)]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /** @var list<string> */
    protected $fillable = [
        'email',
        'yandex_id',
        'name',
        'city_id',
        'notification_prefs',
        'consent_version',
        'consented_at',
        'last_login_at',
    ];

    /**
     * Почта и yandex_id не уходят наружу при сериализации (BR-04): данные на фронт —
     * только явным списком полей.
     *
     * @var list<string>
     */
    protected $hidden = [
        'email',
        'yandex_id',
        'remember_token',
        'session_version',
    ];

    /** @var array<string, mixed> */
    protected $attributes = [
        'session_version' => 0,
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'city_id' => 'integer',
            'notification_prefs' => 'array',
            'consented_at' => 'datetime',
            'last_login_at' => 'datetime',
            'session_version' => 'integer',
        ];
    }

    /** @return Attribute<string, string> */
    protected function email(): Attribute
    {
        return Attribute::make(set: fn (string $value): string => EmailAddress::from($value)->value);
    }

    /** @return BelongsTo<City, $this> */
    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }
}
