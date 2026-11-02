# Документация

| Раздел | Файл |
|---|---|
| Продукт и use cases | 00-product/SPEC.md, GLOSSARY.md |
| Архитектура и стек | 01-architecture/ARCHITECTURE.md |
| Как выполняется задача | 02-process/SDD-TDD.md |
| Какая модель что делает | 02-process/MODELS.md |
| Ревью | 02-process/REVIEW.md |
| Гейты и релиз | 02-process/RELEASE-GATES.md |
| CI/CD и GitHub | 02-process/CI-CD.md |
| Дизайн-система в коде | 03-design/DESIGN-SYSTEM.md |
| Экраны, состояния, флаги | 03-design/SCREENS.md |
| Роадмап | ROADMAP.md |
| Фазы → эпики → задачи | phases/, epics/, tasks/ |
| Статус (генерируется) | operations/status/ROLLUP.md, NEXT.md |
| Гейты (подписи) | operations/gates/G0…G3.md |

Иерархия: фаза `N` → эпик `N.M` → задача `N.M.K`. Статусы задачи: `todo → ready → in_progress → review → done` (+ `blocked`, `cancelled`). Поля карточки: `gate`, `risk`, `model_impl`, `model_review`, `roles`, `depends_on`, `uc`, `prototype`, `screens`, `issue`.

```bash
node tools/docs-ops.mjs check      # структура и зависимости
node tools/docs-ops.mjs next       # что можно брать
node tools/docs-ops.mjs set 0.1.1 done
node tools/docs-ops.mjs refresh    # статусы эпиков, фаз, ROLLUP, NEXT
```
