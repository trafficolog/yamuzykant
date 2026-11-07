/** Полный переход на адрес (с перезагрузкой): после выхода страница и токен CSRF должны быть новыми. */
export function hardNavigate(url: string): void {
    window.location.assign(url);
}
