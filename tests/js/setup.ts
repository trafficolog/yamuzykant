import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import { resetCityCache } from '@/Components/CityPicker';

// Без `globals: true` Testing Library сама размонтирует деревья не умеет: делаем это после каждого теста.
afterEach(() => {
    cleanup();
    // Справочник городов кэшируется на время страницы: тесты не должны видеть чужие ответы.
    resetCityCache();
});
