function MastersScreen({ go }) {
  const { SearchBar, FilterChip, MasterCard, RepairOrderCard } = window.DesignSystem_b66810;
  const K = window.KIT;
  const works = ["Перешлифовка ладов","Сетап","Электрика","Ламповые усилители","Педали"];
  const [w, setW] = React.useState("Сетап");
  const list = K.masters.filter(m => m.specialties.includes(w));
  return <div className="k-page">
    <Crumbs go={go} items={[["Главная","home"],["Мастера"]]} />
    <h1 className="display-l ym-title">Мастера рядом</h1>
    <div className="k-masters-q">
      <SearchBar id="masters-q" scope="Мастера" placeholder="Опишите, что случилось с инструментом" />
      <div className="k-chips" role="radiogroup" aria-label="Работа">{works.map(x => <FilterChip key={x} radio selected={x === w} onChange={() => setW(x)}>{x}</FilterChip>)}</div>
    </div>
    <Rail title={"Мастера: " + w.toLowerCase()}><div className="k-cols3">{(list.length ? list : K.masters).map(m => <MasterCard key={m.name} {...m} />)}</div></Rail>
    <Rail title="Ваш заказ ремонта"><div style={{ maxWidth:760 }}><RepairOrderCard number="ЗАКАЗ ЛМ-26-00317" instrument="Gibson Les Paul Studio 2014" work="Перешлифовка ладов и сетап" status="Ремонт" amount={7800} master="А. Воронцов" action="Написать мастеру" steps={[{ label:"Принят", meta:"2 окт", state:"done" },{ label:"Диагностика", meta:"3 окт", state:"done" },{ label:"Смета", meta:"7 800 ₽", state:"done" },{ label:"Ремонт", meta:"до 8 окт", state:"current" },{ label:"Выдача" }]} /></div></Rail>
  </div>;
}
window.MastersScreen = MastersScreen;