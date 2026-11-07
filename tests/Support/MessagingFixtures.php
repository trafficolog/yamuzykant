<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Messaging\Models\Conversation;
use Illuminate\Broadcasting\BroadcastManager;

/**
 * Данные тестов сообщений (4.1.1): опубликованное объявление продавца и беседа покупателя по нему.
 */
final class MessagingFixtures
{
    public static function listing(ListingStatus $status = ListingStatus::Published): Listing
    {
        return Listing::factory()->inStatus($status)->create();
    }

    /** Беседа покупателя по объявлению; продавец — владелец объявления. */
    public static function conversation(?Listing $listing = null, ?User $buyer = null): Conversation
    {
        $listing ??= self::listing();
        $buyer ??= User::factory()->create(['name' => 'Покупатель']);

        $conversation = new Conversation;
        $conversation->listing_id = $listing->id;
        $conversation->buyer_id = $buyer->id;
        $conversation->seller_id = $listing->user_id;
        $conversation->save();

        return $conversation;
    }

    /**
     * Вещатель Reverb с тестовыми ключами: подпись авторизации канала считается локально, сервер не нужен.
     * Каналы регистрируются на вещателе по умолчанию при загрузке приложения (там — null), поэтому
     * после смены вещателя routes/channels.php подключается заново.
     */
    public static function useReverbBroadcaster(): void
    {
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'test-key',
            'broadcasting.connections.reverb.secret' => 'test-secret',
            'broadcasting.connections.reverb.app_id' => 'test-app',
            'broadcasting.connections.reverb.options.host' => '127.0.0.1',
            'broadcasting.connections.reverb.options.port' => 8080,
            'broadcasting.connections.reverb.options.scheme' => 'http',
            'broadcasting.connections.reverb.options.useTLS' => false,
        ]);

        app(BroadcastManager::class)->forgetDrivers();
        require base_path('routes/channels.php');
    }
}
