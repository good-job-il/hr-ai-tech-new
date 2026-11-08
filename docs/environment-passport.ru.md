# HR-5 / S1-01: паспорт среды

Первичная проверка 6 ноября, сверка Vercel, исправление Auth и браузерная QA-проверка завершены 7 ноября 2026 года (Asia/Jerusalem). Статус: **S1-01 выполнена для целевой Production-среды**. По прямому запросу владельца исправлены два свойства Supabase Auth и создан один согласованный синтетический аккаунт кандидата. Рабочие данные, deploy и миграции не изменялись. Отдельный Preview ещё не настроен для приёмки; это зафиксированный результат сверки, а не подтверждение его работоспособности.

## Подтверждённые привязки

| Параметр | Значение и источник |
|---|---|
| Целевой домен | https://www.hr-ai.tech/ — подтверждён владельцем в чате |
| Репозиторий | git@github.com:good-job-il/hr-ai-tech-new.git — локальный origin и Git repository в Vercel совпадают |
| Проверяемый локальный SHA | `aba33d59ce0d9879c0c7a13e6badd999dcb017a6` |
| Исходная ветка | `main`; рабочая ветка аудита `codex/hr-5-environment-passport` |
| SHA и ветка deployment | Production: `main`, `aba33d59ce0d9879c0c7a13e6badd999dcb017a6` — подтверждены в Vercel Overview, совпадают с локальным HEAD |
| Vercel team/project | `hr-ai-tech/hr-ai-tech-new`, https://vercel.com/hr-ai-tech/hr-ai-tech-new — ссылка владельца, проверена в авторизованном браузере |
| Production deployment | Ready; https://hr-ai-tech-c5yl9bb91-hr-ai-tech.vercel.app, detail ID `fEVNPDkidHXTBkxJD9EBQSYxvp2o` |
| Production aliases | `www.hr-ai.tech`, `hr-ai-tech-new.vercel.app` — Overview |
| Новый Supabase | `hr-ai-tech-new`, ref `rnstsczayhzrxzcstzpr`, https://rnstsczayhzrxzcstzpr.supabase.co |
| Состояние Supabase | `ACTIVE_HEALTHY`, регион `ap-northeast-1`, PostgreSQL `17.11.0.011` — `supabase projects list` |
| Миграции | CLI history: локальные и remote версии `001–058` совпадают без пропусков. Это проверка журнала, не полноты схемы/данных (HR-6) |
| Фактическая клиентская привязка | HTML и 12 JS-файлов главной страницы содержат только новый Supabase ref; соответствует `.env.local` и linked CLI project |
| Linear | `reuven.yaron.me@gmail.com`, workspace `hr-ai-tech`, задача HR-5 — `whoami` |

Supabase CLI авторизован как `reuven.yanturin@gmail.com`; Vercel CLI — `reuven-yanturin`, команда `reuven-yanturins-projects`. Это отдельные подключения; выбор профиля Linear их не меняет.

## Vercel: подтверждённый проект и ограничения доступа

Локальная `.vercel/project.json` содержит историческую привязку `headhunter-preview`, project ID `prj_6cnDGz0wDmTDbz1BRMxVjGjayXPq`, team ID `team_b3hVLHa8N1sY31BdcKu3eSMI`. Это **не подтверждение текущего deployment**.

Первичная проверка CLI не нашла `headhunter-preview` и deployment в старой команде. 7 ноября владелец указал фактический проект `hr-ai-tech/hr-ai-tech-new`; через существующую сессию Arc (`reuvenyaron-3486`) подтверждены домен, Ready deployment, Git repository/branch/SHA. CLI-аутентификация остаётся другой; локальную `.vercel` не перепривязывали.

В Project Environment Variables при фильтре All Environments видны 16 записей, все с областью Production: `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Project-переменные для Preview и `NEXT_PUBLIC_SITE_URL` отсутствуют. В Shared при фильтре `NEXT_PUBLIC_` получено No Results Found; полный список непубличных Shared не сверялся.

Владелец сообщил о завершении дополнительной email-проверки Vercel. Через Reveal Value прочитан публичный `NEXT_PUBLIC_SUPABASE_URL` для Production: `https://rnstsczayhzrxzcstzpr.supabase.co` — совпадает с новым проектом, локальной настройкой и live bundle. Клиентский publishable key функционально проверен успешными Auth-запросами и браузерным входом на этом проекте; его значение в отчёте не публикуется. Секретные ключи Vercel не раскрывались и не копировались. Зашифрованные серверные Supabase/DB credentials не сверены по значениям: это ограничение аудита интеграций, не доказательство их валидности. Текущий клиент приложения использует `NEXT_PUBLIC_SUPABASE_*`. Отдельный Preview deployment с нужными параметрами пока не принят; перенос Production-секретов в Preview не выполнялся.

До исправления Auth ссылался на `https://hr-ai-tech-new-hr-ai-tech.vercel.app/`. Теперь Site URL — `https://www.hr-ai.tech/`. Старые redirect entries сохранены, поскольку их использование ещё не исключено.

## Переменные без значений секретов

| Имя | Назначение / состояние проверки |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Публичный endpoint. Локально, в сохранённом Production env Vercel и initial browser bundle — новый Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Публичный клиентский ключ. Значение в отчёте не публикуется; live Auth settings с ним вернули HTTP 200 |
| `NEXT_PUBLIC_SITE_URL` | Origin для metadata и ссылок вакансий. Есть в коде, отсутствует локально и в Project Variables Vercel; fallback указывает на старый `headhunter-preview.vercel.app`. Shared `NEXT_PUBLIC_` не найдены. Исправление перед следующим релизом — HR-14 |
| `NEXT_SUPABASE_DB_PASS` | Локальная служебная переменная, значение не публикуется; не должна попадать в клиент |
| `VERCEL_OIDC_TOKEN` | Локальная служебная переменная, значение не публикуется; не должна попадать в клиент |
| `SUPABASE_SERVICE_ROLE_KEY` | В Vercel присутствует как Secret, только Production; значение и принадлежность к проекту не проверены. В браузерном bundle недопустим |
| `WHATSAPP_APP_SECRET`, `WHATSAPP_CONNECTIONS_JSON`, `WHATSAPP_GRAPH_VERSION`, `WHATSAPP_VERIFY_TOKEN` | Серверные настройки интеграции из route handlers; работоспособность интеграции HR-5 не подтверждает |

Production и Preview проверять отдельно, включая branch overrides. Для `NEXT_PUBLIC_*` важны значения на момент build: обновление настройки без пересборки не меняет существующий bundle. Значения секретов в Git/Linear не копировать.

## Auth: исправление применено

Источник: повторное чтение `supabase config pull --remote=rnstsczayhzrxzcstzpr --dry-run` до и после исправления, временные локальные configs в `/tmp`. По прямому запросу владельца выполнен `config push` с двумя явно объявленными свойствами: `auth.site_url`, `auth.additional_redirect_urls`. Предварительный diff проверен; readback подтвердил сохранение. Остальные девять наблюдаемых отличий конфигурации не изменились.

Текущие настройки:

- Site URL: `https://www.hr-ai.tech/`.
- Additional redirect URLs:
  - `https://hr-ai-tech-new-hr-ai-tech.vercel.app/`
  - `https://hr-ai-tech-new-hr-ai-tech.vercel.app/**`
  - `https://hr-*-ai-tech-new-hr-ai-tech.vercel.app`
  - `https://hr-*-ai-tech-new-hr-ai-tech.vercel.app/**`
  - `https://www.hr-ai.tech`
  - `https://www.hr-ai.tech/`
- Email confirmations: включены; public settings: email provider включён, signup разрешён, `mailer_autoconfirm=false`.

**Ранее найденное расхождение устранено:** основной домен теперь указан в Site URL и allowlist. Точные origin/root адреса соответствуют текущему `resetPasswordForEmail(..., {redirectTo: window.location.origin})`; signup использует Site URL по умолчанию. Wildcard для нового домена не добавлялся.

Read-only запрос `/auth/v1/verify` с заведомо недействительным signup-токеном и `redirect_to=https://www.hr-ai.tech` вернул HTTP 303 на ожидаемый origin с ошибкой недействительного токена. В этом запросе письма не отправлялись, аккаунты не изменялись. Дополнительно выполнен успешный браузерный вход QA-кандидата, см. ниже. Доставка письма, дополнительные deep links для recovery/invites и точные Preview URLs не проверены; старые aliases не удалялись.

## Проверенные сценарии

| Сценарий | Результат |
|---|---|
| HTTPS GET главной страницы и 12 initial scripts | HTTP 200, конечный адрес `https://www.hr-ai.tech/` |
| Анонимный браузер, Hebrew → English | Страница интерактивна; загрузились вакансии, индикатор `Open jobs from a connected database`; нет предупреждения об отсутствующей конфигурации |
| Открытие Sign in | Форма доступна; вход заранее подтверждённого QA-кандидата через email/password успешен |
| Консоль браузера после загрузки | Error/warn записи не обнаружены в доступном журнале |
| Новый Supabase в live bundle | Только `rnstsczayhzrxzcstzpr`, совпадает с local config |
| Журнал миграций | `001–058` совпадают локально и remote |
| Auth URL readback после исправления | Site URL `https://www.hr-ai.tech/`, два точных www redirect entries сохранены, остальные наблюдаемые настройки не изменились |
| Auth возврат с недействительным токеном | HTTP 303 на `https://www.hr-ai.tech` с ожидаемой ошибкой; письма и аккаунты не затронуты |
| Секреты в текущих tracked-файлах и initial live scripts | Эвристический scan: совпадений нет |
| Авторизованный браузер | QA-кандидат вошёл на www, открыл My account; отображаются Candidate и No affiliation |
| Сессия после перезагрузки | Пользователь остаётся авторизованным, My account доступен; аккаунт загружается с прежним именем |
| Выход и повторная перезагрузка | Возврат в анонимный интерфейс Sign in, личный кабинет QA не отображается |
| Vercel repository/branch/deployment SHA | Подтверждены через авторизованный Overview; SHA совпадает с локальным |
| Vercel Production/Preview env | Production публичный URL совпадает с новым ref; publishable key функционально валиден. Project Preview-переменных нет; Shared `NEXT_PUBLIC_` не найдены. Preview пока не считается средой приёмки |

Scan ищет `sb_secret_`, service-role JWT, private keys, PostgreSQL URI с паролем и точные значения локальных непубличных credentials. Не является полным аудитом: git history, lazy chunks, server bundle и облачные env не охвачены. Публичный publishable key не считается секретом. Приложение ещё показывает исторические подписи staging/Preview/no production data; они не доказывают отсутствие рабочих записей.

## Рабочие и приёмочные данные

Новый Supabase считать рабочим: существующие записи не объявлены одноразовыми. Владелец разрешил только отдельный синтетический QA-аккаунт **без организации и реальных данных**. Разрешение не распространяется на создание QA-организаций или изменение рабочих записей.

QA run: `HR-5-20261107-v8k3`; Auth user ID: `905ea90b-2718-4afa-9906-ad7d34bde110`; технический email `qa-hr5-20261107-v8k3@example.invalid`. Создан через Auth Admin API с `email_confirm=true`, metadata `account_type=candidate`, `full_name=QA HR-5 synthetic`. Это заранее подтверждённая техническая fixture: обычный signup/email verification не выдаются за проверенные. Настройки подтверждения email для остальных пользователей не менялись. Триггер создал `account_settings`; сервисная проверка показала ровно 0 memberships. Организации, отклики, CV, Storage objects и реальные контакты не создавались. QA-пользователь вышел, аккаунт пока сохранён для повторной проверки.

Очистка ограничена этим точным UUID: перед удалением повторно проверить, что аккаунт не получил memberships, applications, candidate_profiles, saved jobs, собственных файлов или других зависимостей; затем уполномоченный оператор удаляет только этот Auth user через Auth Admin API. `account_settings` удаляется по FK cascade. Если появились дополнительные связанные записи, сначала сверить их с QA-манифестом и политикой хранения. Не удалять пользователей по префиксу email, не чистить рабочие таблицы массово. Пароль и служебный ключ в паспорт/Linear не включены.

## Воспроизведение и дальнейшие задачи

- `node scripts/audit-environment.mjs https://www.hr-ai.tech/` — read-only HTTP/bundle scan, выдаёт JSON без значений ключей. Нужны `.env.local`, Git и доступ к сети. Exit 1 при сетевом сбое, HTTP не 200, несовпадении ref или находке секретов.
- `supabase migration list --remote=rnstsczayhzrxzcstzpr` — только сверка журнала; не запускать `db push` для повторного применения `001–058`.
- `scripts/preview-read-load-check.mjs` содержит исторический старый Supabase ref `ruejyiromtthygqtpcsy` и старый preview URL. Не использовать для приёмки новой среды; runtime-код главной страницы использует новый ref.
- Vercel team/project и Production SHA установлены; используемые клиентом Production URL/key проверены. В HR-14 определить безопасное отдельное Preview-подключение, настроить его переменные и проверить перед использованием. Наличие custom domain не делает Production средой для произвольных тестовых записей.
- Auth URLs исправлены и проверены readback/HTTP redirect; вход, сохранение сессии и выход QA-кандидата проверены. В HR-14 задать `NEXT_PUBLIC_SITE_URL` для нового домена перед следующей сборкой и проверить metadata/ссылки: старый fallback ещё есть в коде и не исправлялся этим аудитом.
- Область QA ограничена согласованным Auth UUID без организации; способ очистки описан. Приёмка signup/email delivery остаётся отдельной работой HR-7.

Критерии HR-5 подтверждены в указанном объёме: анонимный и авторизованный браузеры работают на целевом домене; клиент подключён к новому Supabase; в проверенных tracked-файлах и initial bundle секретов не найдено; согласованная область QA и точный порядок очистки записаны. HR-5 можно закрыть. Это не разрешение на пилот и не приёмка всех ролей, email delivery, резервирования, серверных интеграций или Preview: они остаются в соответствующих задачах спринта.
