import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Без `globals: true` Testing Library сама размонтирует деревья не умеет: делаем это после каждого теста.
afterEach(cleanup);
