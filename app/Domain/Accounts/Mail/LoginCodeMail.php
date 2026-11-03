<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Lang;

/**
 * Письмо с кодом входа. Уходит через очередь с высоким приоритетом; задание шифруется
 * (ShouldBeEncrypted), чтобы код не лежал открытым текстом в Redis и failed_jobs.
 * Код — только в теле письма, не в теме: тема видна в превью и журналах почтовых систем.
 */
final class LoginCodeMail extends Mailable implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public function __construct(public readonly string $code)
    {
        $this->onQueue(Config::string('login.mail_queue'));
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: Lang::get('login.mail.subject'));
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.login-code',
            with: [
                'code' => $this->code,
                'minutes' => intdiv(Config::integer('login.code_ttl'), 60),
            ],
        );
    }
}
