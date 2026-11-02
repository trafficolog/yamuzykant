function CartScreen({ go }) {
  const { Icon, PriceTag, IconButton, FavoriteButton, Badge, Button, ConditionBadge } = window.DesignSystem_b66810;
  const fmt = v => new Intl.NumberFormat("ru-RU").format(v) + "\u00a0₽";
  const [items, setItems] = React.useState([
    { id:"a", group:"Музторг Партнёр", title:"Yamaha Pacifica 112V, Sonic Blue", price:32990, old:35990, qty:1, icon:"guitar", note:"Завтра" },
    { id:"b", group:"Музторг Партнёр", title:"Струны Ernie Ball 2221 Regular Slinky 10–46", price:790, qty:2, icon:"cable", note:"Завтра" },
    { id:"c", group:"Б/у · безопасная сделка", title:"Boss RC-30 Loop Station", price:12000, qty:1, icon:"cable", used:"very-good", note:"Москва · 1,8 км" }
  ]);
  const setQty = (id, d) => setItems(xs => xs.flatMap(x => x.id !== id ? [x] : x.qty + d <= 0 ? [] : [{ ...x, qty: x.qty + d }]));
  const sum = items.reduce((s, x) => s + x.price * x.qty, 0), disc = items.reduce((s, x) => s + ((x.old || x.price) - x.price) * x.qty, 0);
  const groups = [...new Set(items.map(x => x.group))];
  return <div className="k-page">
    <Crumbs go={go} items={[["Главная","home"],["Корзина"]]} />
    <div className="k-titlebar"><h1 className="type-h1 ym-title">Корзина</h1><span className="type-body ym-muted">{items.length} товара</span></div>
    {items.length === 0 ? <div className="k-empty"><div className="k-empty__ic"><Icon name="shopping-bag" size={40} /></div><h2 className="type-h2 ym-title">В корзине пусто</h2><Button variant="primary" onClick={() => go("home")}>На главную</Button></div> :
    <div className="k-cart">
      <div className="k-cart__list">{groups.map(g => <section key={g} className="k-cart__group">
        <div className="k-cart__ghead"><h3 className="type-h3 ym-title">{g}</h3>{g.startsWith("Б/у") && <Badge tone="accent" icon="shield-check">Безопасная сделка</Badge>}</div>
        {items.filter(x => x.group === g).map(x => <div key={x.id} className="k-cart__row">
          <div className="k-cart__img"><Icon name={x.icon} size={32} /></div>
          <div className="k-cart__info"><span className="type-body">{x.title}</span>{x.used && <ConditionBadge condition={x.used} />}<span className="type-body-s ym-muted">{x.note}</span></div>
          <div className="k-qty"><button type="button" className="k-ibtn" aria-label="Меньше" onClick={() => setQty(x.id, -1)}><Icon name="minus" size={16} /></button><span className="type-label ym-num">{x.qty}</span><button type="button" className="k-ibtn" aria-label="Больше" disabled={!!x.used} onClick={() => setQty(x.id, 1)}><Icon name="plus" size={16} /></button></div>
          <div className="k-cart__price"><PriceTag price={x.price * x.qty} oldPrice={x.old ? x.old * x.qty : undefined} /><div className="k-cart__acts"><FavoriteButton /><button type="button" className="k-ibtn" aria-label="Удалить" onClick={() => setQty(x.id, -x.qty)}><Icon name="x" size={16} /></button></div></div>
        </div>)}
      </section>)}</div>
      <aside className="k-summary">
        <div className="k-summary__row"><span>Товары</span><span className="ym-num">{fmt(sum + disc)}</span></div>
        {disc > 0 && <div className="k-summary__row"><span>Скидка</span><span className="ym-num" style={{ color:"var(--sale, var(--danger-text))" }}>−{fmt(disc)}</span></div>}
        <div className="k-summary__row"><span>Доставка</span><span>Бесплатно</span></div>
        <div className="k-summary__total"><span className="type-h3">Итого</span><span className="type-price-xl ym-num">{fmt(sum)}</span></div>
        <Button variant="primary" size="l" block onClick={() => go("checkout")}>Перейти к оформлению</Button>
        <span className="type-body-s ym-muted">Деньги за б/у лот ждут на безопасной сделке, пока вы не проверите инструмент.</span>
      </aside>
    </div>}
  </div>;
}
function CheckoutScreen({ go }) {
  const { Field, FilterChip, Button, Timeline, Alert, Badge } = window.DesignSystem_b66810;
  const [ship, setShip] = React.useState("Курьер");
  const [pay, setPay] = React.useState("СБП");
  const [done, setDone] = React.useState(false);
  const steps = [{ label:"Оплачено", state:"done" },{ label:"Отправлено", state:"current" },{ label:"Получено" },{ label:"Проверка" },{ label:"Деньги продавцу" }];
  return <div className="k-page">
    <Crumbs go={go} items={[["Корзина","cart"],["Оформление"]]} />
    <h1 className="type-h1 ym-title" style={{ marginBottom:"var(--space-6)" }}>Оформление заказа</h1>
    {done ? <div style={{ display:"grid", gap:"var(--space-6)", maxWidth:760 }}><Alert tone="success" title="Заказ оформлен">Новые товары приедут завтра. Деньги за Boss RC-30 ждут на безопасной сделке.</Alert><Timeline steps={steps} /><Button variant="outline" onClick={() => go("account")}>Мои заказы</Button></div> :
    <div className="k-cart">
      <div className="k-cart__list">
        <section className="k-cart__group"><h3 className="type-h3 ym-title">Адрес</h3><div className="k-f2"><Field id="c-city" label="Город" defaultValue="Москва" /><Field id="c-addr" label="Улица и дом" placeholder="Таганская, 24" /></div><Field id="c-name" label="Получатель" defaultValue="Алексей Смирнов" /></section>
        <section className="k-cart__group"><h3 className="type-h3 ym-title">Способ доставки</h3><div className="k-chips" role="radiogroup">{["Курьер","Пункт выдачи","Доставка с упаковкой"].map(s => <FilterChip key={s} radio selected={ship === s} onChange={() => setShip(s)}>{s}</FilterChip>)}</div><span className="type-body-s ym-muted">{ship === "Доставка с упаковкой" ? "Жёсткая упаковка и страховка на полную стоимость — для инструментов." : ship === "Курьер" ? "Завтра, 10:00–18:00 · бесплатно" : "Ближайший пункт — 600 м"}</span></section>
        <section className="k-cart__group"><h3 className="type-h3 ym-title">Оплата</h3><div className="k-chips" role="radiogroup">{["СБП","Картой онлайн"].map(s => <FilterChip key={s} radio selected={pay === s} onChange={() => setPay(s)}>{s}</FilterChip>)}</div></section>
        <section className="k-cart__group"><div className="k-cart__ghead"><h3 className="type-h3 ym-title">Безопасная сделка для б/у</h3><Badge tone="accent" icon="shield-check">Boss RC-30</Badge></div><Timeline steps={steps.map(s => ({ label:s.label }))} /></section>
      </div>
      <aside className="k-summary">
        <div className="k-summary__total"><span className="type-h3">К оплате</span><span className="type-price-xl ym-num">46{"\u00a0"}570{"\u00a0"}₽</span></div>
        <Button variant="primary" size="l" block onClick={() => setDone(true)}>Оплатить</Button>
        <span className="type-body-s ym-muted">Нажимая «Оплатить», вы соглашаетесь с условиями безопасной сделки.</span>
      </aside>
    </div>}
  </div>;
}
Object.assign(window, { CartScreen, CheckoutScreen });
