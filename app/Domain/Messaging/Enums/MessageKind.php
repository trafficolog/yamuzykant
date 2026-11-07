<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Enums;

/**
 * Вид сообщения (SPEC §7 MESSAGE). В G1 пишутся только text; system — служебные строки беседы,
 * offer — предложения цены (4.2.x, гейт G2).
 */
enum MessageKind: string
{
    case Text = 'text';
    case System = 'system';
    case Offer = 'offer';
}
