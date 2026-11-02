function AccountScreen({ go, tab = "overview", setTab }) {
  const { Icon, Button, Alert, Badge, Field, FilterChip, ListingCard, RepairOrderCard, Timeline, PriceTag, ConditionBadge } = window.DesignSystem_b66810;
  const K = window.KIT;
  const tabs = [["overview","layout-grid","Обзор"],["buying","shopping-bag","Покупки"],["selling","tag","Продажи"],["gear","guitar","Мои инструменты"],["messages","message-circle","Сообщения"],["repairs","wrench","Ремонт"],["reviews","star","Отзывы"],["settings","user","Профиль и магазин"]];
  const Empty = ({ icon, text, action, onAction }) => <div className="k-empty"><span className="k-empty__ic"><Icon name={icon} size={40} /></span><p className="type-body ym-muted" style={{ margin:0 }}>{text}</p>{action && <Button variant="outline" size="s" onClick={onAction}>{action}</Button>}</div>;
  const Stat = ({ label, value, note }) => <div className="k-stat"><span className="type-body-s ym-muted">{label}</span><span className="mono-l">{value}</span>{note && <span className="type-caption ym-muted">{note}</span>}</div>;
  let body;
  if (tab === "overview") body = <>
    <h1 className="type-h1 ym-title">Добрый день, Владимир</h1>
    <div className="k-chips" style={{ marginTop:"var(--space-3)" }}><Badge tone="parts" icon="map-pin">Москва</Badge><Badge tone="accent" icon="shield-check">Безопасная сделка подключена</Badge></div>
    <div className="k-stats4"><Stat label="Заказы" value="0" note="за 3 месяца" /><Stat label="Предложения цены" value="2" note="ждут ответа" /><Stat label="Сообщения" value="3" note="непрочитанных" /><Stat label="Сохранили ваши лоты" value="80" /></div>
    <Alert tone="warning" title="Ответьте на предложение" action="Открыть">Покупатель предложил 172 000 ₽ за Fender American Vintage ’57. Предложение действует 48 часов.</Alert>
    <section className="k-block"><h2 className="type-h2 ym-title">Как пройдёт продажа</h2><Timeline steps={[{ label:"Оплачено", meta:"деньги на безопасной сделке" },{ label:"Отправлено", meta:"Доставка с упаковкой" },{ label:"Получено" },{ label:"Проверка", meta:"24 часа" },{ label:"Деньги продавцу", meta:"на карту или счёт" }]} /></section>
  </>;
  if (tab === "buying") body = <>
    <div className="k-toolbar"><h1 className="type-h2 ym-title">Покупки</h1><div className="k-chips">{["Все","Открытые","Завершённые","Споры"].map((x, i) => <FilterChip key={x} radio selected={i === 0}>{x}</FilterChip>)}</div></div>
    <Empty icon="shopping-bag" text="Покупок пока нет. Всё, что купите через безопасную сделку, появится здесь." action="Перейти в Каталог" onAction={() => go("section")} />
  </>;
  if (tab === "selling") body = <>
    <div className="k-toolbar"><h1 className="type-h2 ym-title">Мои лоты · 1</h1><Button icon="plus">Продать гир</Button></div>
    <div className="k-chips" style={{ marginBottom:"var(--space-6)" }}>{["Опубликованы","Черновики","Предложения","Заказы","Проданы"].map((x, i) => <FilterChip key={x} radio selected={i === 0} count={[1,0,2,0,0][i]}>{x}</FilterChip>)}</div>
    <div className="k-grid" {...clickable(go, "lot")}><ListingCard {...K.lots[0]} href="#" /></div>
  </>;
  if (tab === "gear") body = <>
    <div className="k-toolbar"><h1 className="type-h2 ym-title">Мои инструменты</h1><Button variant="inverse" icon="plus">Добавить инструмент</Button></div>
    <div className="k-mygear"><Icon name="guitar" size={20} /><div><p className="type-label" style={{ margin:0 }}>Fender Stratocaster ’79</p><p className="type-body-s ym-muted" style={{ margin:0 }}>S/N <span className="type-mono">S923487</span> · Цены на б/у: 168 000 – 196 000 ₽</p></div><Button variant="ghost" size="s" iconRight="chevron-right" onClick={() => go("model")}>Подобрать детали</Button></div>
    <Empty icon="history" text="Добавьте инструмент по серийному номеру — Паспорт и цена Цены на б/у будут обновляться сами." action="Добавить по серийному номеру" />
  </>;
  if (tab === "messages") body = <>
    <Alert tone="info" title="Общайтесь внутри ЯМузыканта">Так переписка сохранится для безопасной сделки и спора. Не переводите деньги напрямую продавцу.</Alert>
    <div className="k-toolbar" style={{ marginTop:"var(--space-6)" }}><div className="k-chips"><FilterChip radio selected>Все</FilterChip><FilterChip radio count={0}>Непрочитанные</FilterChip></div></div>
    <Empty icon="message-circle" text="Новых сообщений нет." />
  </>;
  if (tab === "repairs") body = <>
    <h1 className="type-h2 ym-title" style={{ marginBottom:"var(--space-6)" }}>Ремонт</h1>
    <div style={{ maxWidth:760 }}><RepairOrderCard number="ЗАКАЗ ЛМ-26-00317" instrument="Gibson Les Paul Studio 2014" work="Перешлифовка ладов и сетап" status="Ремонт" amount={7800} master="А. Воронцов" action="Написать мастеру" steps={[{ label:"Принят", meta:"2 окт", state:"done" },{ label:"Диагностика", meta:"3 окт", state:"done" },{ label:"Смета", meta:"7 800 ₽", state:"done" },{ label:"Ремонт", meta:"до 8 окт", state:"current" },{ label:"Выдача" }]} /></div>
  </>;
  if (tab === "reviews") body = <>
    <div className="k-toolbar"><h1 className="type-h2 ym-title">Отзывы</h1><div className="k-chips"><FilterChip radio selected>Оставленные</FilterChip><FilterChip radio>Полученные</FilterChip></div></div>
    <Empty icon="star" text="Отзывов пока нет. После сделки через безопасную сделку обе стороны оставляют отзыв." />
  </>;
  if (tab === "settings") body = <div className="k-settings">
    {[["Профиль","Имя видно в сообщениях и отзывах. Фото не показываем — вместо него инициалы.",<><Field id="fn" label="Имя" defaultValue="Владимир" /><Field id="ln" label="Фамилия" defaultValue="Ёлкин" hint="Покупатели видят только первую букву" /></>],
      ["Магазин","Название видят покупатели в лотах и в Паспорте инструмента.",<><Field id="shop" label="Название магазина" defaultValue="Гараж Владимира" /><Field id="url" label="Адрес страницы" defaultValue="vladimir-garage" hint="ladmaster.ru/shop/vladimir-garage" /></>],
      ["Регион и доставка","Сейчас ЯМузыкант работает по России. Город нужен для «рядом со мной» и расчёта Кофр-доставки.",<><Field id="country" label="Страна" defaultValue="Россия" disabled hint="Другие страны появятся позже" /><Field id="city" label="Город" defaultValue="Москва" /><Field id="cur" label="Валюта" defaultValue="₽ — российский рубль" disabled /></>],
      ["Выплаты","Деньги с безопасной сделки приходят после подтверждения получения.",<><Field id="inn" label="ИНН" placeholder="12 цифр" hint="Для самозанятых и ИП — чеки формируем сами" /><Field id="card" label="Карта или счёт" placeholder="2200 •••• •••• ••••" /></>]].map(([t, d, f]) =>
      <section key={t} className="k-settings__row"><div><h2 className="type-h3 ym-title">{t}</h2><p className="type-body-s ym-muted" style={{ margin:"var(--space-2) 0 0" }}>{d}</p></div><div className="k-settings__fields">{f}</div></section>)}
    <div style={{ display:"flex", justifyContent:"center", paddingTop:"var(--space-6)" }}><Button variant="inverse">Сохранить</Button></div>
  </div>;
  return <>
    <nav className="k-subnav" aria-label="Кабинет"><div className="k-subnav__in">{tabs.map(([k, ic, l]) => <a key={k} href="#" aria-current={tab === k ? "page" : undefined} onClick={e => { e.preventDefault(); setTab(k); }}><Icon name={ic} size={16} />{l}</a>)}</div></nav>
    <div className="k-page" style={{ paddingTop:"var(--space-8)" }}>{body}</div>
  </>;
}
window.AccountScreen = AccountScreen;