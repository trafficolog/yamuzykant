<?php

declare(strict_types=1);

return [
    // Ответ 429 на POST предложений модели после суточного лимита (config/catalog.php, suggestions_per_day).
    'suggestions_daily_limit' => 'Сегодня уже отправлено много предложений. Попробуйте завтра.',
];
