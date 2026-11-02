function ModelScreen({ go }) {
  const { ModelSummary, OfferList, PriceGuide, AccessoryRail, ServicePicker } = window.DesignSystem_b66810;
  const K = window.KIT;
  return <div className="k-page">
    <Crumbs go={go} items={[["Главная","home"],["Электрогитары","section"],["Fender Player II Stratocaster"]]} />
    <ModelSummary category="Гитары · Электрогитары · Fender" name="Fender Player II Stratocaster" specs={["Ольха","Кленовый гриф","3 × сингл","22 лада"]} newFrom={109990} newCount={4} warranty usedFrom={78000} usedCount={17} guide={{ low:74000, high:92000 }} />
    <div className="k-block" {...clickable(go, "lot")}><OfferList offers={K.offers} /></div>
    <div className="k-block"><PriceGuide low={74000} high={92000} basis="по 17 продажам б/у за 12 месяцев" /></div>
    <div className="k-block"><AccessoryRail title="Аксессуары к Fender Player II Stratocaster" groups={K.accessories} /></div>
    <div className="k-block" style={{ maxWidth:640 }}><ServicePicker id="model-svc" category="Электрогитары" services={["Сетап","Перешлифовка ладов","Электрика","Замена порожка"]} geo="prompt" /></div>
  </div>;
}
window.ModelScreen = ModelScreen;