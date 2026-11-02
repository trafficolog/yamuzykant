function OfferScreen({ go }) {
  const { Field, PriceGuide, Button, Timeline, Icon, PriceTag } = window.DesignSystem_b66810;
  const [v, setV] = React.useState("172 000");
  const [stage, setStage] = React.useState(0);
  const num = Number(String(v).replace(/\D/g, "")) || 0;
  return <div className="k-modal-bg" onClick={e => { if (e.target === e.currentTarget) go("lot"); }}>
    <div className="k-modal" role="dialog" aria-modal="true" aria-labelledby="offer-t">
      <button type="button" className="k-ibtn k-modal__x" aria-label="Закрыть" onClick={() => go("lot")}><Icon name="x" size={20} /></button>
      {stage === 0 ? <>
        <h2 id="offer-t" className="type-h2 ym-title">Предложить цену</h2>
        <div className="k-mini"><div className="k-cart__img" style={{ width:64 }}><Icon name="guitar" size={28} /></div><div><span className="type-body">Fender American Vintage ’57 Stratocaster 2009</span><PriceTag price={184500} /></div></div>
        <Field id="offer-v" label="Ваша цена" suffix="₽" value={v} onChange={e => setV(e.target.value)} hint="По «Ценам на б/у» такие инструменты продают за 168 000 – 196 000 ₽" />
        <PriceGuide low={168000} high={196000} price={num} basis="по 41 продаже за 12 месяцев" />
        <Button variant="primary" size="l" block disabled={!num} onClick={() => setStage(1)}>Отправить предложение</Button>
        <span className="type-body-s ym-muted">Продавец ответит в течение 24 часов. Предложение ни к чему вас не обязывает.</span>
      </> : <>
        <h2 id="offer-t" className="type-h1 ym-title">Предложение принято</h2>
        <span className="type-price-xl ym-num">{new Intl.NumberFormat("ru-RU").format(num)}{"\u00a0"}₽</span>
        <p className="type-body ym-muted" style={{ margin:0 }}>Продавец согласился. Договоритесь о передаче в чате — оплата на сайте появится позже.</p>
        <Timeline steps={[{ label:"Предложение", state:"done" },{ label:"Договорились", state:"current" },{ label:"Передача" },{ label:"Отзыв" }]} />
        <Button variant="primary" size="l" block icon="message-circle" onClick={() => go("account")}>Написать продавцу</Button>
      </>}
    </div>
  </div>;
}
function SellScreen({ go }) {
  const { Field, Button, Icon, ConditionBadge, PriceGuide, ListingCard, SearchBar, Alert } = window.DesignSystem_b66810;
  const [step, setStep] = React.useState(0);
  const [cond, setCond] = React.useState("excellent");
  const [photos, setPhotos] = React.useState(1);
  const [price, setPrice] = React.useState("82 000");
  const [done, setDone] = React.useState(false);
  const num = Number(String(price).replace(/\D/g, "")) || 0;
  const steps = ["Модель","Фото","Состояние","Цена"];
  const conds = [["mint","Без следов использования, полная комплектация"],["excellent","Мелкие следы, на звук и игру не влияют"],["very-good","Заметные потёртости, всё работает"],["good","Следы активной игры, возможна настройка"],["fair","Нужен ремонт или замена деталей"]];
  const next = <div className="k-sell__nav">{step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Назад</Button>}<Button variant="primary" onClick={() => step < 3 ? setStep(step + 1) : setDone(true)} disabled={step === 1 && photos < 3}>{step < 3 ? "Дальше" : "Опубликовать"}</Button></div>;
  if (done) return <div className="k-page"><div className="k-empty"><div className="k-empty__ic" style={{ color:"var(--accent-text)", background:"var(--accent-soft)" }}><Icon name="circle-check" size={40} /></div><h1 className="type-h1 ym-title">Объявление опубликовано</h1><p className="type-body ym-muted" style={{ margin:0 }}>Покупатели будут писать вам в «Сообщения».</p><div className="k-buy__row"><Button variant="primary" onClick={() => go("lot")}>Открыть объявление</Button><Button variant="outline" onClick={() => go("home")}>На главную</Button></div></div></div>;
  return <div className="k-page">
    <Crumbs go={go} items={[["Главная","home"],["Продать инструмент"]]} />
    <h1 className="type-h1 ym-title">Продать инструмент</h1>
    <ol className="k-steps">{steps.map((s, i) => <li key={s} aria-current={i === step ? "step" : undefined} data-done={i < step || undefined}><span className="ym-num">{i < step ? "✓" : i + 1}</span>{s}</li>)}</ol>
    <div className="k-sell">
      <div className="k-sell__main">
        {step === 0 && <><SearchBar id="sell-q" placeholder="Бренд и модель, например Fender Player Stratocaster" /><div className="k-cart__group"><span className="type-label">Нашли в каталоге</span><span className="type-h3">Fender Player Stratocaster 2019</span><table className="k-specs"><tbody>{[["Корпус","Ольха"],["Звукосниматели","SSS"],["Страна","Мексика"]].map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table><span className="type-body-s ym-muted">Характеристики заполнили из каталога — проверьте и поправьте, если что-то отличается.</span></div></>}
        {step === 1 && <><p className="type-body" style={{ margin:0 }}>Минимум 3 фото. Одно — обязательно с серийным номером: так покупатель доверяет больше.</p><div className="k-photos">{[0,1,2,3,4,5].map(i => i < photos ? <div key={i} className="k-photo"><Icon name={i === 0 ? "scan-barcode" : "camera"} size={28} /><span className="type-body-s">{i === 0 ? "Серийный номер" : "Фото " + (i + 1)}</span></div> : i === photos ? <button key={i} type="button" className="k-photo k-photo--add" onClick={() => setPhotos(photos + 1)}><Icon name="plus" size={28} /><span className="type-body-s">Добавить</span></button> : null)}</div>{photos < 3 && <Alert tone="info" title={"Ещё " + (3 - photos) + " фото"}>Добавьте общий вид спереди и сзади.</Alert>}</>}
        {step === 2 && <div className="k-conds" role="radiogroup" aria-label="Состояние">{conds.map(([c, t]) => <button key={c} type="button" role="radio" aria-checked={cond === c} className="k-cond" onClick={() => setCond(c)}><ConditionBadge condition={c} /><span className="type-body-s ym-muted">{t}</span></button>)}</div>}
        {step === 3 && <><Field id="sell-p" label="Цена" suffix="₽" value={price} onChange={e => setPrice(e.target.value)} /><PriceGuide low={68000} high={92000} price={num} basis="по 57 продажам за 12 месяцев" /></>}
        {next}
      </div>
      {step === 3 && <aside className="k-sell__prev"><span className="type-label">Так увидят покупатели</span><ListingCard title="Fender Player Stratocaster 2019, Polar White" price={num} condition={cond} city="Москва" posted="только что" cta={false} /></aside>}
    </div>
  </div>;
}
Object.assign(window, { OfferScreen, SellScreen });
