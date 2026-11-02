function HomeScreen({ go }) {
  const { Icon, ListingCard, TrustStrip, MasterCard } = window.DesignSystem_b66810;
  const K = window.KIT;
  const tiles = [["Гитары","guitar"],["Педали и усилители","speaker"],["Клавишные","piano"],["Ударные","drum"],["Студия","mic"],["DJ","headphones"]];
  const deals = K.lots.filter(l => l.oldPrice).concat(K.flea.filter(l => l.oldPrice)).map(l => ({ ...l, delivery:"Завтра" }));
  const hits = K.lots.map((l, i) => ({ ...l, rating:[4.9,4.8,4.7,4.9,4.8,4.6][i % 6], reviews:[1240,312,86,58,2104,421][i % 6], delivery:["Завтра","2–3 дня","Сегодня"][i % 3] }));
  const fresh = K.flea.map(l => ({ ...l }));
  return <div className="k-page">
    <section className="k-tiles" {...clickable(go, "section")}>
      {tiles.map(([t, ic]) => <a key={t} href="#" className="k-tile"><span className="type-title-card">{t}</span><Icon name={ic} size={40} /></a>)}
      <a href="#" className="k-tile k-tile--flea" onClick={e => { e.preventDefault(); e.stopPropagation(); go("flea"); }}><span className="type-title-card">Барахолка</span><span className="type-body-s">б/у рядом с вами</span><Icon name="boxes" size={40} /></a>
    </section>
    <Rail title="Скидки недели" link="Все скидки" onLink={() => go("section")}><div className="k-grid" {...clickable(go, "lot")}>{deals.map(l => <ListingCard key={l.id} {...l} href="#" />)}</div></Rail>
    <Rail title="Хиты продаж" link="Все хиты" onLink={() => go("section")}><div className="k-grid" {...clickable(go, "product")}>{hits.slice(0, 5).map(l => <ListingCard key={l.id} {...l} href="#" />)}</div></Rail>
    <div className="k-rail"><TrustStrip /></div>
    <Rail title="Свежее на барахолке" link="Вся барахолка" onLink={() => go("flea")}><div className="k-grid" {...clickable(go, "lot")}>{fresh.map(l => <ListingCard key={l.id} {...l} href="#" />)}</div></Rail>
    <Rail title="Мастера рядом" link="Все мастера" onLink={() => go("masters")}><div className="k-cols3">{K.masters.map(m => <MasterCard key={m.name} {...m} />)}</div></Rail>
  </div>;
}
window.HomeScreen = HomeScreen;
