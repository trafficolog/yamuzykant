/* Понятные названия вместо брендовых терминов в компонентах дизайн-системы.
   Подключать в <helmet> сразу после _ds_bundle.js. Правит готовый DOM: текст, aria-label, title, placeholder.
   Удалить, когда тексты поменяют в самой системе. */
(function () {
  if (window.__lmPlain) return;
  window.__lmPlain = true;
  var R = [
    ['Ладмастера', 'ЯМузыканта'],
    ['Ладмастере', 'ЯМузыканте'],
    ['Ладмастер', 'ЯМузыкант'],
    ['Ладмира', 'ЯМузыканта'],
    ['Ладмире', 'ЯМузыканте'],
    ['Ладмир', 'ЯМузыкант'],
    ['Сетап', 'Настройка'],
    ['сетап', 'настройка'],
    ['Справочник цен Ля440', 'Справочник цен'],
    ['Выше диапазона Ля440', 'Дороже, чем обычно продают'],
    ['В диапазоне Ля440', 'Обычная цена для такого инструмента'],
    ['Ля440 для б/у: ', 'Б/у обычно продают за '],
    ['Ля440', 'Цены продаж'],
    ['В Фермате ', 'Удерживаем до получения '],
    ['деньги в Фермате', 'деньги удерживаем до получения'],
    ['Деньги из Ферматы', 'Деньги за сделку'],
    ['Только Фермата', 'Только безопасная сделка'],
    ['через Фермату', 'с безопасной сделкой'],
    ['Ферматой', 'безопасной сделкой'],
    ['Фермату', 'безопасную сделку'],
    ['Фермате', 'безопасной сделке'],
    ['Ферматы', 'безопасной сделки'],
    ['Фермата', 'Безопасная сделка'],
    ['Кофр-доставки', 'доставки в защитной упаковке'],
    ['Кофр-доставку', 'доставку в защитной упаковке'],
    ['Кофр-доставка', 'Доставка в защитной упаковке'],
    ['По рукам!', 'Цена согласована'],
    ['Мой гир', 'Мои инструменты'],
    ['Продать гир', 'Продать инструмент'],
    ['проверите гир', 'проверите инструмент'],
    ['гира', 'инструмента'],
    ['гиром', 'инструментом'],
    ['гиру', 'инструменту'],
    ['гир', 'инструмент']
  ];
  var TEST = /[Сс]етап|Ладмаст|Ладмир|Ля440|Фермат|Кофр-доставк|По рукам!|(^|[^а-яё])гир/i;
  var ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
  function fix(s) {
    for (var i = 0; i < R.length; i++) {
      var f = R[i][0];
      if (/^[а-яё]/.test(f)) {
        s = s.replace(new RegExp('(^|[^а-яёА-ЯЁ])' + f + '(?![а-яё])', 'g'), function (m, pre) { return pre + R[i][1]; });
        var F = f[0].toUpperCase() + f.slice(1), T = R[i][1][0].toUpperCase() + R[i][1].slice(1);
        s = s.replace(new RegExp('(^|[^а-яёА-ЯЁ])' + F + '(?![а-яё])', 'g'), function (m, pre) { return pre + T; });
      } else if (s.indexOf(f) !== -1) s = s.split(f).join(R[i][1]);
    }
    return s;
  }
  function fixText(t) {
    var v = t.nodeValue;
    if (v && TEST.test(v)) t.nodeValue = fix(v);
  }
  function fixEl(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = el.getAttribute && el.getAttribute(ATTRS[i]);
      if (a && TEST.test(a)) el.setAttribute(ATTRS[i], fix(a));
    }
  }
  function scan(root) {
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) {
      if (root.tagName === 'SCRIPT' || root.tagName === 'STYLE') return;
      fixEl(root);
    }
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) {
        var p = n.parentNode;
        if (p && (p.tagName === 'SCRIPT' || p.tagName === 'STYLE')) continue;
        fixText(n);
      } else fixEl(n);
    }
  }
  function start() {
    scan(document.body);
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === 'characterData') fixText(m.target);
        else if (m.type === 'attributes') fixEl(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) scan(m.addedNodes[j]);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
