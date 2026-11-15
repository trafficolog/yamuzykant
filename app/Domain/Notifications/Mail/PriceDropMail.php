<?php

declare(strict_types=1);

namespace App\Domain\Notifications\Mail;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Models\Listing;
use App\Domain\Notifications\Enums\NotificationKind;
use App\Support\Rubles;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;
use Illuminate\Support\Facades\Lang;

/**
 * Письмо о снижении цены объявления из избранного (4.3.1, шаблон 4.4.1). Отправляется из очередного слушателя,
 * сам в очередь не ставится. Без почты продавца и получателя (BR-04): название, новая и прежняя цена, ссылка.
 * `$previousPrice` — цена, с которой получатель добавил объявление в избранное (`null` — не показывать).
 */
final class PriceDropMail extends Mailable
{
    // Закрытые поля: публичные свойства письма Laravel сам отдаёт в шаблон и они перекрыли бы данные `with`.
    public function __construct(
        private readonly User $recipient,
        private readonly Listing $listing,
        private readonly ?int $previousPrice,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: Lang::get('mail.price_drop.subject', ['title' => $this->listing->title]));
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.price-drop',
            with: [
                'title' => $this->listing->title,
                'price' => $this->listing->price === 0 ? Lang::get('mail.price_drop.free') : $this->rubles($this->listing->price),
                'previousPrice' => $this->rubles($this->previousPrice),
                'listingUrl' => route('lot.show', $this->listing),
                'reason' => Lang::get('mail.reasons.price_drop'),
                'unsubscribeUrl' => NotificationKind::PriceDrop->unsubscribeUrl($this->recipient),
            ],
        );
    }

    /** Отписка в один клик в самом почтовом клиенте (RFC 8058). */
    public function headers(): Headers
    {
        return new Headers(text: [
            'List-Unsubscribe' => '<'.NotificationKind::PriceDrop->unsubscribeUrl($this->recipient).'>',
            'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
        ]);
    }

    /** `null` («Договорная») и 0 («Бесплатно») — без суммы (BR-11). */
    private function rubles(?int $amount): ?string
    {
        return $amount === null || $amount <= 0 ? null : Rubles::format($amount);
    }
}
