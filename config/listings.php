<?php

declare(strict_types=1);

return [
    // Через сколько дней после публикации объявление уходит в expired (SPEC §6.1). Значение «уточнить» у OWNER.
    'expire_after_days' => 60,

    // Лимит активных объявлений частного лица (BR-06): published + pending + needs_changes. Значение «уточнить» у OWNER.
    'active_limit' => 10,
];
