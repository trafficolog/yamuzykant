function ProductScreen({ go }) {
  const { Icon, Rating, PriceTag, Button, FavoriteButton, Badge, OfferList, AccessoryRail, ServicePicker } = window.DesignSystem_b66810;
  const K = window.KIT;
  const [ph, setPh] = React.useState(0);
  const [inCart, setInCart] = React.useState(false);
  const offers = K.offers || [];
  return <div className="k-page">
    <Crumbs go={go} items={[["Главная","home"],["Электрогитары","section"],["Yamaha Pacifica 112V"]]} />
    <div className="k-lot">
      <div>
        <div className="k-gallery"><Icon name="guitar" size={64} /></div>
        <div className="k-thumbs">{[0,1,2,3].map(i => <button key={i} aria-pressed={ph === i} aria-label={"Фото " + (i + 1)} onClick={() => setPh(i)}><Icon name={i ? "camera" : "guitar"} size={24} /></button>)}</div>
      </div>
      <div className="k-buy">
        <div className="k-chips"><Badge icon="badge-check">Оригинал</Badge><Badge tone="sale">Скидка</Badge></div>
        <h1 className="type-h1 ym-title">Электрогитара Yamaha Pacifica 112V, Sonic Blue</h1>
        <a href="#reviews" className="k-link"><Rating value={4.8} count={2104} /></a>
        <PriceTag price={32990} oldPrice={35990} size="pdp" />
        <div className="k-delivery"><Icon name="truck" size={20} /><span><b>Завтра</b> курьером · бесплатно</span></div>
        <Button variant="primary" size="l" block icon="message-circle" onClick={() => go("account")}>Написать продавцу</Button>
        <div className="k-buy__row"><Button variant="outline" icon="handshake" onClick={() => go("offer")}>Предложить цену</Button><FavoriteButton /></div>
        <span className="type-body-s ym-muted">Покупка на сайте появится позже — пока договоритесь с продавцом в чате.</span>
        <span className="type-body-s ym-muted">Продаёт «Музторг Партнёр» · гарантия производителя 1 год</span>
      </div>
    </div>
    {offers.length > 0 && <div className="k-block"><h2 className="type-h2 ym-title">Предложения других магазинов</h2><OfferList id="p-offers" offers={offers} /></div>}
    <div className="k-block"><AccessoryRail title="Аксессуары к Yamaha Pacifica" groups={K.accessories} /></div>
    <div className="k-block" style={{ maxWidth:640 }}><ServicePicker id="p-svc" category="Электрогитары" services={["Сетап","Электрика","Замена порожка"]} geo="granted" place="Москва, Таганская" masters={K.near} /></div>
    <div className="k-block"><h2 className="type-h2 ym-title">Характеристики</h2><table className="k-specs"><tbody>{[["Корпус","Ольха"],["Гриф","Клён, болтовое крепление"],["Накладка","Палисандр"],["Звукосниматели","HSS"],["Лады","22"],["Мензура","648 мм"]].map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table></div>
  </div>;
}
window.ProductScreen = ProductScreen;
