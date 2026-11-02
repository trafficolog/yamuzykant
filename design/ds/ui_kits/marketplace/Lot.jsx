function LotScreen({ go }) {
  const { Icon, ConditionBadge, PriceTag, Button, FavoriteButton, PriceGuide, SellerCard, Alert, PassportCard, AccessoryRail, ServicePicker, Badge } = window.DesignSystem_b66810;
  const K = window.KIT;
  const [ph, setPh] = React.useState(0);
  const [bought, setBought] = React.useState(false);
  return <div className="k-page">
    <Crumbs go={go} items={[["Главная","home"],["Электрогитары","section"],["Fender American Vintage ’57 Stratocaster"]]} />
    <div className="k-lot">
      <div>
        <div className="k-gallery"><Icon name={["guitar","scan-barcode","camera","camera"][ph]} size={64} /></div>
        <div className="k-thumbs">{["guitar","scan-barcode","camera","camera"].map((ic, i) => <button key={i} aria-pressed={ph === i} aria-label={"Фото " + (i + 1)} onClick={() => setPh(i)}><Icon name={ic} size={24} /></button>)}</div>
      </div>
      <div className="k-buy">
        <h1 className="type-h1 ym-title">Fender American Vintage ’57 Stratocaster 2009, Sunburst</h1>
        <div className="k-chips"><ConditionBadge condition="excellent" /><Badge tone="service" icon="badge-check">Проверено мастером</Badge></div>
        <PriceTag price={184500} shipping={0} size="pdp" />
        {bought ? <Alert tone="success" title="Сообщение отправлено">Продавец ответит в «Сообщениях». Обычно отвечают в течение часа.</Alert>
          : <Button variant="primary" size="l" block icon="message-circle" onClick={() => setBought(true)}>Написать продавцу</Button>}
        <div className="k-buy__row"><Button variant="outline" icon="handshake" onClick={() => go("offer")}>Предложить цену</Button><FavoriteButton count={80} /></div>
        <div className="k-chips"><Badge tone="accent" icon="shield-check">Безопасная сделка</Badge><span className="type-body-s ym-muted">Б/у · Москва</span></div>
        <div className="k-stats"><span>Выставлен 3 дня назад</span><span>Просмотров 1 310</span><span>Сохранили 80</span><span>Предложений 2</span></div>
        <a href="#" className="type-label" style={{ color:"var(--accent)" }} onClick={e => { e.preventDefault(); go("model"); }}>Все предложения модели</a>
      </div>
    </div>
    <div className="k-block"><PriceGuide low={168000} high={196000} price={184500} basis="по 41 продаже за 12 месяцев" /></div>
    <div className="k-block k-cols3" style={{ alignItems:"start" }}>
      <SellerCard name="Гитарный угол" rating={4.9} reviews={432} city="Москва" since="2025" badges={[{ label:"Быстро отправляет", tone:"accent", icon:"truck" },{ label:"Магазин", tone:"parts" }]} />
      <Alert tone="service" title="Проверка перед покупкой — 1 900 ₽" action="Заказать">Мастер посмотрит инструмент до отправки и сверит серийный номер.</Alert>
    </div>
    <div className="k-block"><h3 className="type-h3 ym-title">Описание</h3><p className="type-body-l" style={{ margin:0, maxWidth:760 }}>Гриф шлифовали один раз, лады в отличном состоянии. Оригинальные звукосниматели, родной твидовый кейс. Отправлю доставкой с упаковкой или встреча в Москве.</p></div>
    <div className="k-block"><h3 className="type-h3 ym-title">Характеристики</h3><table className="k-specs"><tbody>{[["Бренд","Fender"],["Модель","American Vintage ’57 Stratocaster"],["Год","2009"],["Страна","США"],["Корпус","Ольха"],["Накладка грифа","Клён"],["Звукосниматели","3 × сингл, оригинал"],["Лады","21"]].map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table></div>
    <div className="k-block" style={{ maxWidth:760 }}><PassportCard instrument="Fender American Vintage ’57 Stratocaster" serial="V091187" year="2009" owners={3} verified events={K.passport} /></div>
    <div className="k-block"><AccessoryRail title="Аксессуары к Fender Stratocaster" groups={K.accessories} /></div>
    <div className="k-block" style={{ maxWidth:640 }}><ServicePicker id="lot-svc" category="Электрогитары" services={["Сетап","Перешлифовка ладов","Электрика","Замена порожка"]} geo="granted" place="Москва, Таганская" masters={K.near} /></div>
  </div>;
}
window.LotScreen = LotScreen;