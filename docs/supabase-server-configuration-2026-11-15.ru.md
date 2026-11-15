# HR-21: серверная конфигурация Supabase — 15.11.2026

## Объём

По поручению владельца ключи Vercel устанавливает владелец. Репозиторий содержит безопасную операторскую проверку конфигурации и действующего secret key. Команда не создаёт публичного diagnostic endpoint, не меняет RLS, миграции, пользователей, реальные CV и клиентскую выдачу документов. Успех этой проверки не является приёмкой отзыва доступа HR-8/HR-12.

Рабочий Supabase: `hr-ai-tech-new`, ref `rnstsczayhzrxzcstzpr`. Vercel должен обслуживать `www.hr-ai.tech` из `good-job-il/hr-ai-tech-new`.

15.11.2026 фактически открыт [Vercel project](https://vercel.com/hr-ai-tech/hr-ai-tech-new): team **HR-AI Tech**, project **hr-ai-tech-new**, репозиторий `good-job-il/hr-ai-tech-new`, домен `www.hr-ai.tech`. Dashboard показывает Production **Ready**, source **main**, SHA `90d1b66e5721bc22f0336904a8652815807ede0d`, deployment `Dyg7E6kxCH1pbE8Qh3qsc8paKWkt`. Исторический блокер403 не описывает текущий UI-доступ. Наличие этих данных не подтверждает настройку нового server secret и не является проверкой приватного фонда.

В доступном браузере Supabase URL рабочего проекта возвращает форму Sign in; доступ к его Dashboard ещё не подтверждён. Локальный `--config .env.local` отказывает: `SUPABASE_SECRET_KEY` отсутствует/не является secret key, site origin не соответствует Production. Значения не выведены, конфигурация пользователя не переписана, сетевой probe не запускался.

## Настройка владельцем

1. Открыть правильный проект Supabase → Settings → API Keys и получить действующий `sb_secret_…`. Не использовать publishable key, PostgreSQL password или JWT signing secret вместо него.
2. В Vercel проверить team, Project → Settings → Git (репозиторий и Production branch `main`) и Domains (`www.hr-ai.tech`). Если проекта нет, восстановить доступ через владельца команды.
3. В Settings → Environment Variables установить `SUPABASE_SECRET_KEY` только для **Production**, тип **Secret**. Существующие `NEXT_PUBLIC_SUPABASE_URL=https://rnstsczayhzrxzcstzpr.supabase.co`, публичный `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` и `NEXT_PUBLIC_SITE_URL=https://www.hr-ai.tech` должны соответствовать этому окружению. Не помещать секрет в публичные переменные, next.config env, Git, чат, Linear, URL или логи.
4. Для локальной проверки отдельно безопасно сохранить secret в Git-ignored `.env` текущей рабочей копии `/Users/reuvenyanturin/Projects/hr-ai.tech`. Ключ, сохранённый как Secret в Vercel, не предполагается доступным для скачивания обратно. Не передавать значение в аргументах командной строки. Не копировать рабочие привилегированные ключи в Preview: существующая защита Preview остаётся включённой.

`.env.example` содержит только пустое имя переменной. Приложение не получает новый доступ к CV от одного добавления ключа.

## Проверки

Только форма конфигурации, без сетевых запросов:

```sh
npm run check:supabase -- --config .env
```

Проверка действующего ключа с записью исключительно временных искусственных PDF:

```sh
npm run check:supabase -- --config .env --probe
```

Переменные процесса имеют приоритет над явно указанным env-файлом. Не запускать из shell с чужой унаследованной конфигурацией. Без `--config` команда использует только окружение процесса (для Vercel). Node должен поддерживать `process.loadEnvFile` (Node 22+).

Проверка отказывает при другом ref/origin, Vercel Preview/Development, несовпадении доступных Git metadata или привилегированном ключе в `NEXT_PUBLIC_*`. Это проверка конфигурации, а не доказательство членства пользователя в нужной Vercel team или привязки домена.

С `--probe` команда проверяет приватность обоих buckets (`candidate-cvs`, `organization-cvs`), загружает уникальный `hr-21-configuration-qa/<uuid>.pdf` без upsert, скачивает только этот новый файл, сверяет байты и удаляет его. Документ содержит только фиксированную QA-метку; ни одна карточка/запись отклика не создаётся. Нет listing существующих файлов и доступа к реальным CV. Запросы ограничены 15 секундами каждый, без автоматических retries и переходов HTTP redirect. Очистка выполняется и при ошибке/неопределённом результате upload. Ошибка или неподтверждённая очистка означает FAIL; `cleanupPath` указывает исключительно новый искусственный объект для ручного удаления. После разрыва процесса или неопределённого сетевого результата оператор дополнительно проверяет QA-префикс, поскольку удалённый запрос мог завершиться позже.

Для проверки ключа непосредственно в окружении сборки Vercel можно **временно**, только для правильного Production deployment, задать Build Command:

```sh
npm run check:supabase -- --probe && npm run build
```

Сначала выполнить обычные проверки исходников. После проверки, включая отказ, вернуть исходную настройку Build Command: в этом проекте это **Override OFF** (автоматическая команда framework). Такой probe подтверждает build environment, не serverless runtime. Не использовать команду в Preview. Сохранить deployment URL, Git SHA, оба `passed:true`/`cleanup:true` и подтверждённые team/project/domain без ключей. Для применения изменённых env нужен новый deployment. Публикация main допустима отдельно от неподтверждённой CV061; в текущем main этой миграции и нового CV UI нет.

## Фактическая попытка Production-проверки 15.11.2026

Владелец сохранил `SUPABASE_SECRET_KEY`: в Vercel подтверждены имя, тип **Secret** и окружение **Production**, значение не открывалось. После отдельного разрешения владельца временно настроена команда с probe только при `VERCEL_ENV=production`; Preview выполняет обычную сборку. Владелец самостоятельно подтвердил Vercel email verification.

Одна согласованная пересборка [ACxbcNq4ENCWf7unUv4GHz9u7wPf](https://vercel.com/hr-ai-tech/hr-ai-tech-new/ACxbcNq4ENCWf7unUv4GHz9u7wPf), source `main7e524ce6a494133930d7b34f0eb4b0d83870e38c`, остановилась за12с с `FAIL: NEXT_PUBLIC_SITE_URL must be https://www.hr-ai.tech.`. Проверка конфигурации выполняется до создания Supabase client: **Storage запросов не было, QA-файлы не создавались, ключ ещё не проверен**. Эта сборка не стала рабочей публикацией.

В Vercel Project environment variables поиск `NEXT_PUBLIC_SITE_URL` вернул No Results Found. Недостающая публичная переменная добавлена как **Config**, только **Production**, со значением `https://www.hr-ai.tech`. Это документированный официальный origin; Preview не менялся. Изменение начинает действовать при следующей сборке.

Временная команда удалена: **Override Build Command OFF**, Save выполнен; состояние подтверждено повторным открытием страницы. Probe не включён в будущие автоматические сборки. Для новой попытки QA-проверки требуется ещё одна согласованная временная сборка; успешность ключа по одному наличию переменной не заявляется.

## Что остаётся до закрытия

- Ключ сохранён в Vercel, но фактические локальная и Production Storage проверки ещё не прошли. Наличие кода/зелёные mock tests их не заменяет.
- Доступ к правильным Supabase/Vercel и серверный runtime должны быть подтверждены отдельно. В main нет подготовленного `POST /api/cv`, поэтому нельзя проверить будущую выдачу через несуществующий endpoint.
- Упомянутые в тикете `codex/cv-access-revocation`, `ba55179` и `docs/cv-access-revocation-2026-11-09.ru.md` отсутствуют в текущем checkout и доступных remote heads на 15.11.2026. Потребуется восстановить исходную работу с компьютера автора и сверить её с main. Не подменять восстановление вымышленным успешным cherry-pick.
- Не применять 061 и не включать CV UI до приёмки HR-8/HR-12: сохранение байтов/ссылок при смене путей, старые authenticated/signed URL, CDN, права обеих групп файлов и браузерный PDF на desktop/phone/iPad.
- HR-9/HR-28 требуют своей проверки опубликованного UI; HR-29 требует отдельного действующего AI grant, запрета auto-reload, трёх серверных AI-переменных и consented synthetic проверки четырёх инструментов. Эти требования не закрываются Supabase probe.

## Проверки исходников 15.11.2026

11 целевых tests PASS (server check, Preview isolation, Hebrew regression). В чистой временной копии текущих исходников без `.env*` и старого `.next`: TypeScript PASS, полная suite **100/100 PASS**, production build PASS. Это локальные проверки, не приёмка Supabase/Vercel.

В основном checkout обычные typecheck/build упёрлись в существующий `.next/dev/types/validator.ts` от04.11, ссылающийся на отсутствующие `app/page.js`/`app/layout.js`. Чужие build/dev артефакты не удалены; автоматически изменённый сборкой `next-env.d.ts` возвращён к исходному состоянию и не включается в коммит задачи. Проверка исходников в чистой копии устраняет влияние этого старого cache, не скрывая локальное ограничение.

Официальные руководства: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Storage upload](https://supabase.com/docs/reference/javascript/file-buckets-upload), [Vercel Secret type](https://vercel.com/changelog/environment-variables-now-use-config-and-secret-types), [применение env и redeploy](https://vercel.com/docs/environment-variables/managing-environment-variables). Для Next.js прочитано локальное руководство `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md` установленной версии.
