import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Home from '@/Pages/Home';

describe('Home', () => {
    it('показывает название «ЯМузыкант» в заголовке первого уровня', () => {
        render(<Home />);

        expect(screen.getByRole('heading', { level: 1, name: 'ЯМузыкант' })).toBeInTheDocument();
    });
});
