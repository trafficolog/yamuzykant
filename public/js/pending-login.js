/*
 * Клик по «Войти» (или вкладке «Кабинет» гостя) до гидратации: JS-бандл ещё грузится, обработчика нет.
 * Запоминаем клик; LoginDialogHost откроет окно входа, когда страница оживёт (html[data-hydrated]).
 * Файл статический: подключается через <script src> и проходит CSP script-src 'self' без nonce.
 */
document.addEventListener('click', function (event) {
    var target = event.target;
    if (document.documentElement.dataset.hydrated === 'true' || !(target instanceof Element)) return;
    if (target.closest('[data-login-trigger]')) {
        event.preventDefault();
        window.__ymLoginPending = true;
    }
});
