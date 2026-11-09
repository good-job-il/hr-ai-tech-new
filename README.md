# hr-ai.tech / HeadHunter

Публичные вакансии и рабочие пространства агентств/работодателей. Источник требований: docs/project-overview.ru.md, docs/project-documentation.pdf, актуальные задачи Linear и решения владельца. Исторические паспорта не являются текущей приёмкой облака.

## Локальная работа

Node.js 24 и npm, зависимости фиксируются package-lock.json.

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm test
npm run build
npm run dev
```

Скопировать .env.example в .env.local и настроить нужное окружение. NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY доступны браузеру; серверные ключи/пароли не должны иметь NEXT_PUBLIC_ префикс. NEXT_PUBLIC_SITE_URL — точный HTTPS origin. Без Supabase UI собирается offline; это не проверка Auth/Storage.

## CI и Preview

.github/workflows/checks.yml выполняет чистую установку, TypeScript, Node/PGlite tests и build на push main/codex/** и pull_request. CI не получает .env, production secrets или подключение к базе. Проверять результат конкретного SHA в GitHub Actions; локальный PASS его не заменяет.

Preview требует отдельного Supabase-проекта и отдельного URL/переменных. Рабочие данные и привилегированные credentials автоматически не копировать.

```sh
npm run check:preview -- path/to/preview.env
```

Указать PREVIEW_SUPABASE_PROJECT_REF и соответствующие URL/publishable key отдельного проекта, а также NEXT_PUBLIC_SITE_URL или VERCEL_URL Preview. Build с VERCEL_ENV=preview отклоняет рабочие refs, официальный origin и унаследованные привилегированные credentials. PASS этой проверки подтверждает только конфигурацию, не наличие проекта, RLS, защиту URL и облачную работоспособность. HR-14 остаётся открытой до фактической Preview-приёмки. Production build не запускает SQL-миграции.

## Миграции

SQL — supabase/migrations. Пустой тестовой базе нужен проверенный полный порядок, не только001/002. До изменения существующей среды сверить supabase_migrations.schema_migrations с файлами и веткой; не запускать db push вслепую и не переименовывать занятые версии.

Состояние на10.11.2026: рабочее облако содержит059storage_download_permissions,060active-job-lifecycle,062–064агрегаты и065исправление кода импортированного текста,066оптимизация фонда с сохранением RLS; CV061остаётся отдельной заблокированной работой. Историческая059восстановлена из read-only облачного журнала, без повторного применения. Схема источников сверена; отдельный полный cloud bootstrap пока не принят. Чужой local draft059featured не является облачной059. Не включать061до server-only настройки и фактической проверки выдачи PDF (HR-8/12/21). Новые миграции не заменяют проверку облачного применения.

Активные опубликованные вакансии не исчезают по7-day cutoff: docs/active-job-lifecycle-2026-11-09.ru.md. Публичные счётчики дают только агрегаты, не доступ к фондам.

## Приёмка и выпуск

git status/remote/pull, изолированная ветка/worktree, проверки/build, diff без секретов/PII, обычный commit/push; после deployment отдельно проверить URL и записать SHA/результат в Linear. Непроверенный CV-релиз не смешивать с UI. .env*, output, work, сборки и supabase/.temp/.branches не коммитятся.

Для пилота нужны реальные Auth JWT/PostgREST/Storage/UI проверки ролей, полный кандидатский/клиентский путь, отзыв CV, восстановление в отдельный проект и решение владельца. PGlite использует synthetic Auth/Storage и не заменяет облако/CDN. Передача исходного PDF браузеру не гарантирует запрет сохранения байтов. Результаты HR-9/HR-14 фиксируются без контактов, PDF, ключей и токенов.