function KitFooter() {
  const { Footer } = window.DesignSystem_b66810;
  return <div style={{ marginTop:"var(--space-16)" }}><Footer copyright="© 2026 ЯМузыкант. Цифры на этой странице — примеры." /></div>;
}
function Crumbs({ items, go }) {
  return <nav className="k-crumbs" aria-label="Хлебные крошки">{items.map((it, i) => <React.Fragment key={i}>{i > 0 && <span aria-hidden="true">/</span>}{it[1] ? <a href="#" onClick={e => { e.preventDefault(); go(it[1]); }}>{it[0]}</a> : <span>{it[0]}</span>}</React.Fragment>)}</nav>;
}
function Rail({ title, link, onLink, children }) {
  return <section className="k-rail"><div className="k-rail__head"><h2 className="type-h2 ym-title">{title}</h2>{link && <a href="#" className="type-label" style={{ color:"var(--accent)" }} onClick={e => { e.preventDefault(); onLink && onLink(); }}>{link}</a>}</div>{children}</section>;
}
function clickable(go, to) { return { onClickCapture: e => { if (e.target.closest("a")) { e.preventDefault(); go(to); } } }; }
Object.assign(window, { KitFooter, Crumbs, Rail, clickable });