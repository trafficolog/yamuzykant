function SectionScreen({ go, view = "catalog" }) {
  const { CatalogSwitch, FilterChip, Field, ListingCard, Button, ConditionBadge } = window.DesignSystem_b66810;
  const K = window.KIT;
  const flea = view === "flea";
  const [sel, setSel] = React.useState(flea ? ["Безопасная сделка"] : []);
  const [sort, setSort] = React.useState("Популярные");
  const toggle = c => setSel(s => s.includes(c) ? s.filter(x => x !== c) : [...s, c]);
  const chips = flea ? ["Безопасная сделка","Проверено мастером","Рядом со мной","Fender","Gibson"] : ["Новинки","Fender","Gibson","Ibanez","До 100 000 ₽"];
  const sorts = flea ? ["Сначала свежие","Ближе ко мне","Дешевле","Дороже"] : ["Популярные","Дешевле","Дороже","С высоким рейтингом"];
  const list = flea ? K.flea.map(l => ({ ...l }))
    : K.lots.concat(K.flea).slice(0, 10).map((l, i) => ({ ...l, partner:true, condition:"new", distance:undefined, posted:undefined, city:undefined, rating:[4.9,4.8,4.7,4.8,4.6][i % 5], reviews:[1240,312,86,58,421][i % 5], delivery:["Завтра","Сегодня","2–3 дня"][i % 3] }));
  const brands = ["Fender","Gibson","Ibanez","Squier","Yamaha","PRS"];
  return <div className="k-page">
    <Crumbs go={go} items={[["Главная","home"],["Гитары","section"],["Электрогитары"]]} />
    <div className="k-titlebar"><h1 className="type-h1 ym-title">Электрогитары</h1><span className="type-body ym-muted">{flea ? "18 760 лотов" : "3 412 товаров"}</span></div>
    <CatalogSwitch value={view} counts={{ catalog: 3412, flea: 18760 }} onChange={v => go(v === "flea" ? "flea" : "section")} />
    <div className="k-section">
      <aside className="k-filters" aria-label="Фильтры">
        <div className="k-fgroup"><span className="type-label">Цена, ₽</span><div className="k-f2"><Field id="pmin" label="от" placeholder="0" /><Field id="pmax" label="до" placeholder="200 000" /></div></div>
        {flea ? <div className="k-fgroup"><span className="type-label">Состояние</span><div className="k-chips">{["mint","excellent","very-good","good","fair"].map(c => <ConditionBadge key={c} condition={c} />)}</div></div>
          : <div className="k-fgroup"><FilterChip selected={sel.includes("Оригинал")} onChange={() => toggle("Оригинал")} icon="badge-check">Оригинал</FilterChip><FilterChip selected={sel.includes("Завтра")} onChange={() => toggle("Завтра")} icon="truck">Доставка завтра</FilterChip></div>}
        <div className="k-fgroup"><span className="type-label">Бренд</span><div className="k-chips">{brands.map(b => <FilterChip key={b} selected={sel.includes(b)} onChange={() => toggle(b)}>{b}</FilterChip>)}</div></div>
        <Field id="city" label="Город" defaultValue="Москва" />
        <Button variant="muted" size="s" block onClick={() => setSel([])}>Сбросить фильтры</Button>
      </aside>
      <div>
        <div className="k-chips" style={{ marginBottom:"var(--space-4)" }}>{chips.map(c => <FilterChip key={c} selected={sel.includes(c)} removable={sel.includes(c)} onChange={() => toggle(c)}>{c}</FilterChip>)}</div>
        <div className="k-sort" role="radiogroup" aria-label="Сортировка">{sorts.map(s => <button key={s} role="radio" aria-checked={(sort === s) || (!sorts.includes(sort) && s === sorts[0])} onClick={() => setSort(s)}>{s}</button>)}</div>
        <div className="k-grid k-grid--dense" {...clickable(go, flea ? "lot" : "product")}>{list.map(l => <ListingCard key={l.id} {...l} href="#" />)}</div>
      </div>
    </div>
  </div>;
}
window.SectionScreen = SectionScreen;
