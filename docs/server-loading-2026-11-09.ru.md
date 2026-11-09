# Ускорение server response и появления вакансий

09.11.2026, HR-20. Этот этап заменяет незавершённую приёмку из public-load-times-2026-11-09.ru.md. Baseline — текущий303bcbb, а не старый11c85c2.

## Реализация

Обычная главная больше не строит React HTML на каждый запрос из-за cookies. Proxy читает только настройку языка и переписывает корневой URL внутрь SSG/en или/he; URL пользователя остаётся прежним. Для обеих версий статически создаётся корректный html lang/dir и metadata. Логотип слева, сохранённая preference и направление digital-head сохранены. Запросы ?job остаются прежним request-time/RLS путём для актуальных sharing metadata. Client portal/review имеют отдельный динамический root; API proxy не затрагивает. Непубличные query URLs и прямые внутренние языковые aliases noindex.

Статический HTML не содержит записей из БД, аккаунтов, токенов или кандидатских данных. Inline script немедленно начинает анонимный no-store запрос к существующему RLS-filtered public_job_catalog, с публичным publishable key; авторизационные cookies/Bearer пользователя не передаются. Потребитель использует seed один раз, очищает глобальную ссылку и при ошибке повторяет обычный запрос. Пагинация500 и исходная сортировка сохранены; отображение проходит unpointedContent. Существующий60s клиентский каталог не получил дополнительного server/CDN data TTL. Закрытие/отзыв публикации по-прежнему определяются БД; данные не встраиваются в SSG. Реальные детали всегда читаются заново.

Счётчики fields/roles/regions считаются одним проходом по jobs вместо повторных scans для каждого option. Словари, правила классификации, порядок и варианты4 фильтров не менялись; differential test сравнивает все карьерные options/counts с прежней семантикой. Мемоизация region matches сохраняет старые residual-term правила. Зарезервирован размер8-card grid на время loading для устранения CLS; готовый дизайн не заменён. Добавлены preload для уже используемых hero atlas/Heebo fonts.

TypeScript include ограничен реальными app/lib/config файлами и текущими Next types; исторические output/work/build snapshots больше не входят в typecheck.

## Критерий допуска, записанный до финальных измерений

5 paired alternating before/after для каждого из1366×900,390×844,820×1180. Нужны ≥10% улучшение медианы TTFB и jobsReady, ≥4/5 paired jobs wins, и отсутствие ухудшения медиан load/LCP более10%. Все samples — visible browser, Hebrew,8 карточек. Это проверка на одном Windows Chromium, не физические телефон/iPad, не Safari и не мобильная CPU/network эмуляция.

Identical расширенный opt-in diagnostics в обеих измерительных сборках фиксирует jobsReady (DOM cards), catalogStart/End и initial/final visibility. Без отправки телеметрии/текста/личных данных. Неполная попытка3 samples более раннего кандидата сохранена отдельно; финальные30 не выбирались по результату. Перед измерениями завершены сборки, assets предварительно посещены; кэш не очищался. LCP/CLS наблюдаются5s после hydration; jobsReady не равен времени end-to-end отклика или изображения каждой карточки.

## Предпубликационный результат

Медианы, ms; n=5 на версию/размер.

| Размер | TTFB до→после | load до→после | jobsReady до→после | LCP до→после | paired jobs wins |
|---|---:|---:|---:|---:|---:|
| Desktop |29→13|235→182|1632→1134|1604→1700|5/5|
| Phone viewport |20→12|215→184|1613→1116|2024→1384|4/5|
| iPad viewport |21→11|226→200|1631→1129|1552→1556|5/5|

Gate PASS во всех3 размерах до публикации. TTFB −40…55%; load −12…23%; cards −30…31%. Это scoped наблюдения в данных условиях, не гарантия процентного улучшения всех визитов. LCP desktop ухудшился на6%, iPad на0.3% (в пределах заранее заданного допуска); не заявлять улучшение каждого показателя. CLS iPad0.1566→0.0001. В одном phone-after jobsReady хуже из-за более долгого public API запроса; этот sample сохранён.

Полные диапазоны,30 raw samples,9 live-before и source SHA-256/build fingerprint зафиксированы [в checkpoint до публикации](performance/server-loading-round2-2026-11-09.json). Live-before не содержит нового jobsReady поля и не смешивается с local paired series. Production before/after сравнивается последовательно, не alternating: доступ к старому deployment отсутствует.

## Проверки и публикация

Production build/TypeScript passed,14 focused tests на новые routing/preload/counting, существующие язык/SEO/ниqqud/cache/geography. Отдельно проверяются sharing,account contact,public catalog и active lifecycle. Preview English после reload: правильные lang/dir,head-facing-card,brand-left; после загрузки8 карточек. Shared job HTTP200/dynamic/no-store с title,client-portal dynamic200,review404,unknown path404,private query noindex. Реальные отклики, сообщения и приватные аккаунты для проверки не создавались.

На момент этого checkpoint публикация ещё не выполнялась. Решение о публикации основано на PASS выше; успешный live rollout,фактические cache headers и последовательные live-after timings фиксируются дополнением. Изменений БД нет.
