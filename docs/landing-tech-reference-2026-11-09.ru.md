# Публичная главная: утверждённый tech reference 01

09.11.2026, Asia/Jerusalem; HR-17. Прямое исправление владельца: выбран `output/design-comparison-v1/01-original-tech-new-logo.png` (862×1824), с цифровой головой, а не предложенный агентом combined03. Этот документ заменяет решения о composition/content главной в `landing-combined-2026-11-09.ru.md`. Нельзя снова брать вариант03 за основу.

## Что реализовано

- Белый компактный header с оригинальной последовательностью Jobs → Career AI → How → About → Blog → Resources; регистрация gradient, вход outline. Language toggle и role-based account navigation сохранены.
- White/lavender hero: исходный нейтральный head asset, белые орбитальные кольца/точки/звёзды, отдельные немиррорящиеся буквы AI на чипе, детальная декоративная карточка Daniel Cohen из рисунка, CV band/skills/experience/education и ряд портретов из исходного design-reference. Никакие данные реального кандидата для иллюстрации не запрашиваются. Карточка подписана как пример.
- Пять benefits справа налево в Hebrew: robot violet, bolt orange, shield green, bell blue, career chart coral; heading с действующим брендом.
- Поиск в том же визуальном контейнере с обязательным исключением владельца: все четыре настоящих фильтра в существующем порядке и с прежними options/handlers. HeroSearch, public-discovery, taxonomy/geography не изменены этим исправлением. Восемь реальных jobs сохранены после поиска; desktop4×2, tablet/mobile уменьшают число колонок.
- Career center intro слева в Hebrew + четыре полноценные карточки: insights orange, interview green, matching violet, CV violet, описания/действия в существующий CareerCenter. Новый сервис AI не подключался.
- Четыре metrics в исходной композиции; четыре исходных steps с person-plus/brain/send/rocket; gradientCTA и расширенный тёмный footer с brand description, пятью колонками, social silhouettes и переключением языка.

## Явные ограничения содержимого рисунка

Рисунок содержит неподтверждённые 15 000+, 1 200+, 8 500+,98%, тысячные отзывы и score95%. Требования PDF стр.5 запрещают выдуманные цифры/score и выдачу rules за подключённый AI. Реальный jobCount показан как доступные вакансии; остальные метрики — «—» с доступной подписью «Figure not published yet». В декоративном progress ring — CV, не выдуманный score. Вместо thousands-success в hero/CTA — нейтральный текст. Career tools и AI benefit обозначены Coming soon; eyebrow не заявляет активный AI. Это документированные содержательные отличия от рисунка, не произвольная замена visual structure.

Непубликованные Blog/analytics/careers/media/legal/guides/status и social destinations не превращены в фиктивные страницы или ссылки: aria-disabled/tooltip. Существующий FAQ открывается из footer в native dialog. Tool buttons ведут в реальный CareerCenter с его planned состоянием; существующие employer/candidate handlers сохранены. Recovery по-прежнему только в Sign in после password, не под footer.

## Direction и область

Root берёт direction из siteLanguageCopy; DOM head → profile и logical grid ставят profile слева в RTL и справа в LTR. Только bitmap отражается через :dir(ltr); AI overlay — отдельный текст с зеркальным положением, а не зеркальными буквами. Логотип, портреты и текст не отражаются. Дополнительные языки требуют регистрации переводов/direction, после чего art наследует это автоматически.

`app/landing-tech.css` scoped к landingTech и импортируется после прежней base landing-v2. Стили кабинетов/каталога вне главной не переопределяются. Avatar/community portraits используют CSS background из существующего public/design-reference.png: новых внешних face URLs, генерации/добавления чужих данных нет. Оригинальные изображения не менялись.

## Проверки

Production build, TypeScript и 18 целевых tests Hebrew/language/account-help/taxonomy/regions/location/sharing passed. Браузерные проверки и live-публикация фиксируются ниже и в HR-17. БД/Auth/DNS и реальные пароли не изменяются; email/отклики не отправляются для этой визуальной проверки.

Браузер localhost: width862 (точный размер reference), 1307 desktop, 390×844 phone и768×1024 iPad he/en; no horizontal overflow; 5 benefits,4 tools,4 metrics,8 jobs, head RTL identity/card слева и LTR reflected/card справа. Текст AI overlay читаемый в обоих направлениях. Keyword נתניה переносится в существующий каталог, FAQ открывает4вопроса и закрывается, Forgot password видим только в auth dialog. Публикация проверяется отдельно; без исходящих сообщений и записи тестовых данных.
