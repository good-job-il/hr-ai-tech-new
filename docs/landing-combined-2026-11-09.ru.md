# Комбинированная публичная главная и направление головы

Дата: 09.11.2026, Asia/Jerusalem. Задача HR-17. Источник — прямое разрешение владельца «выполнить» после трёх макетов с новым брендом, с обязательным уточнением: цифровая голова всегда смотрит на карточку кандидата, Hebrew — влево, English — вправо; тот же принцип для будущих языков. Владелец разрешил улучшить весь публичный экран и спросил, что в макете потеряно относительно реализации.

Решение: внедрён комбинированный вариант 3 (структура/светлая палитра 2, глубина/сине-фиолетовые акценты и тёмный footer 1), дополненный цифровой головой из 1. Текущий утверждённый HR + hr-ai.tech сохранён. Это изменение представления главной, не приёмка полного MVP или новых AI-функций.

## Сохранённое поведение относительно макета

| Чего не было или было упрощено в рисунке | Реализация |
|---|---|
| Реальные featured jobs и переход в полный каталог | Сохранены существующие компоненты/обработчики |
| Сохранение, sharing, подробности и подача | Сохранены существующие onSave/onShare/onOpen/auth маршруты; записи не создавались для проверки |
| Field → role/keyword → region → city | Сохранены все 4 поля и текущие dictionaries/filters |
| Навигация по реальным профессиональным областям | JobFields сохранён |
| FAQ | Все 4 актуальных вопроса сохранены; удалённый AI-вопрос не возвращён |
| Компании | Сохранено условие published profile + реальные связанные вакансии; пустой блок не фабрикуется |
| Вошедший пользователь | Сохранён выбор кабинета/действий существующим PublicHeader и onAuth; не переадресуется с главной автоматически |
| Язык и SEO | Default English, saved preference, lang/dir/title, no-niqqud и public/private indexing не изменены |

Нет фиктивных 95%/15 000/98%, активного AI или клиентов из рисунков. Карточка декоративная, без персональных данных; видимая подпись об иллюстрации. Карьерные инструменты по-прежнему явно planned. Счётчик вакансий использует переданный jobCount, неизвестное значение отображается как «—». Удалены ложные подписи Preview/no production data с status/footer. Добавлен рабочий footer anchor #questions и год copyright.

## Правило направления

`CareerHeroArt` наследует direction от Landing, который получает его из `siteLanguageCopy(lang).direction`. Порядок DOM: голова, затем карточка. Logical CSS grid автоматически размещает карточку слева от головы в RTL и справа в LTR. Базовый asset смотрит влево; `.careerHeroArt:dir(ltr) .careerOrbImage` применяет scaleX(-1). Текст карточки и интерфейса не отражается. Для нового языка достаточно подключить переводы и корректный direction в общем языковом слое: отдельных проверок he/en и отдельных картинок в иллюстрации нет. Это не означает, что новые языки уже доступны.

Правило сохраняется и в mobile/tablet layout: голова и карточка остаются рядом, а hero copy переносится выше. Декоративный asset без букв на чипе, поэтому при отражении нет перевёрнутой надписи AI. Глобальный логотип не отражается.

## Активы и область стилей

- `app/career-hero-art.tsx`: независимое иллюстративное представление.
- `app/landing-v2.css`: стили только внутри `.landingV2`, не меняют кабинеты и карточку вакансии.
- `public/career-head-v2.png`: новый alpha-PNG, подготовлен встроенным ImageGen из существующего public/ai-head.jpg. Оригиналы не изменялись. Используется next/image, CSS управляет ориентацией.

Финальный prompt подготовки asset:

> Precise production asset edit. Reference is the EXISTING circular blue-violet digital head used in the owner's approved recruitment website mockup. Preserve this exact neutral wireframe human head, LEFT-facing profile (nose points LEFT), fine circuit lines, electric blue and violet circular glass halo, composition and premium finish. Remove the black exterior background completely to genuine alpha transparency outside the circular halo. Also remove ONLY the letters "AI" from the chip at the temple, leaving an attractive blank chip or simple symmetric circuit symbol with no letters, so this whole illustration can be mirrored in RTL/LTR without backwards writing. No text, logos, numbers, arrows, white rectangular backdrop, new UI or extra objects. Keep complete round halo with clean edges, no cropping, balanced square canvas and tight clean transparent margin. This is a faithful isolated asset, not a website screenshot.

## Проверка

TypeScript и production build; 10 целевых тестов (no-niqqud, language/title, sharing, navigation/help). Браузер localhost: desktop 1307px, phone 390×844, iPad 768×1024, he/en; измерены direction, image transform и относительные центры card/head. RTL: identity/card слева, LTR: scaleX(-1)/card справа. Во всех размерах horizontal overflow отсутствует. Форма входа открывается/закрывается; Search jobs с keyword נתניה открывает существующий каталог с введённым фильтром. Глобальные style/семантика header и auth permissions не переписывались.

Облако и авторизованные сценарии не принимаются по этим локальным проверкам. После push main отдельно проверяются live-HTML/asset, he/en direction и видимый экран; SHA/результат фиксируются в Linear. Мокап содержит и другие планируемые элементы, но их внешняя похожесть не объявляется готовой бизнес-функцией. БД/Auth/DNS не меняются.

## Уточнение владельца: точное соответствие рисунку (09.11.2026)

Этот раздел заменяет прежнее решение сохранять все блоки старой главной. Владелец требует весь экран по утверждённому `output/design-comparison-v1/03-combined-recommended.png`: композиция, цвет, тексты и порядок разделов. Обязательные исключения — цифровая голова, смотрящая на карточку по direction, неизменные четыре фильтра со всеми опциями и **8 горячих вакансий**.

Внедрены плоский светлый header, компактный hero, четыре карточки преимуществ без добавленного заголовка, поиск, восемь реальных вакансий, intro + три planned career tools, три информационные карточки, четыре шага, CTA и тёмный footer. Отдельные JobFields/companies/FAQ секции удалены из потока главной; каталоги продолжают работать. Четыре актуальных FAQ доступны из footer в native dialog. Подпись иллюстрации доступна assistive technology без дополнительной строки в макете. Счётчики и выдуманные показатели не используются.

HeroSearch, FieldPicker, RoleInput, LocationInput, taxonomy и geography не менялись: field → role/keyword → region → city, прежние опции и логика. FeaturedJobs отображает первые 8 записей переданного публичного каталога в прежнем порядке; слово «горячие» не вводит недокументированный рейтинг.

Blog, Terms и Privacy из рисунка пока не имеют опубликованных страниц: отображаются как aria-disabled с подписью «Not published yet», без пустых ссылок или выдуманных юридических документов. Career tools явно Coming soon. Это ограничения готовности содержимого, а не активные функции.

Проверки уточнения: production build и TypeScript успешны; 19 существующих тестов no-niqqud, языка, sharing, help/account navigation, городов/регионов, словарей и поиска прошли. Браузер: 1024px desktop, phone 390×844, iPad 768×1024, he/en, 8 карточек, отсутствие horizontal overflow, направление головы. FAQ открывает 4 вопроса и закрывается. Публикация и live-проверка фиксируются отдельно в HR-17.

Дополнительная live-проверка desktop 1307px выявила унаследованный grid старых benefit cards, отсутствующий на 1024px: текст сжимался в 48px. Scoped display:block в новых карточках устраняет конфликт; проверены все типы карточек на широком экране. Это исправление CSS, фильтры/данные не затронуты.

## Повторный визуальный аудит и Forgot password (09.11.2026)

Владелец справедливо уточнил, совпадают ли также иконки/цвета и уместен ли Forgot password под footer. Предыдущая проверка не подтверждала pixel-perfect: аналогичные иконки person/calendar/chart, серый body copy и упрощённые детали карточки расходились с рисунком. Заявление о полном совпадении было чрезмерным.

Уточнены SVG-силуэты (person-plus, calendar-check, trending, graduation, location, team), общий необязательный brand-gradient у UiIcon, navy secondary copy, skeleton avatar/profile, стрелки mini cards и тонкие SVG-волны CTA. Иконки фильтров декоративные (aria-hidden/pointer-events:none), введены без изменения их значений, словарей, порядка и обработчиков. 8 вакансий и порядок остальных секций сохранены. Все raster-изображения и утверждённый логотип сохранены.

Recovery больше не показывает глобальный Forgot password под страницей. Кнопка type=button находится непосредственно после password в существующей auth form. Она закрывает Sign in и открывает отдельный доступный recovery dialog с единственной email form; close/backdrop/Escape закрывают окно. Постоянный PASSWORD_RECOVERY listener остаётся смонтированным, существующие Supabase resetPasswordForEmail/updateUser и redirect/minimum не менялись. Это проверка UI, recovery email/смена реального пароля не выполнялись. Business/candidate auth flow не переписывался.

Ограничения совпадения: raster mockup — визуальная спецификация, не исходный файл иконок/шрифта/точных color tokens; нельзя обещать идентичность каждого пикселя. Прямо согласованные отличия — digital head по direction, 4 действующих фильтра со всеми options, 8 реальных jobs, language switch; dynamic содержимое вакансий и локализация меняют высоту. Blog/legal labels ещё disabled, planned tools Coming soon.

Проверки повторного аудита: TypeScript, production build и 14 целевых тестов прошли. В браузере he/en phone390, iPad768, desktop1024/1307: 8 jobs, 4 filters, no horizontal overflow, корректный head transform. Sign in содержит Forgot password непосредственно после password; вне dialog кнопки нет. Открытие отдельного recovery dialog и закрытие кнопкой/Escape проверены без отправки email. Статус после завершения reset сохранён. Снимки и live SHA фиксируются в HR-17 после публикации.
