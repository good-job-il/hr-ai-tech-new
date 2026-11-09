# HR-14: CI и безопасный Preview — 10.11.2026

Исходный main8e6cc0b. Добавлены GitHub Actions push main/codex/** и pull_request: Node24, npm ci по lock, typecheck, все tests, production build. Actions закреплены SHA официальных v7. CI не получает .env/ключи/рабочую БД.

Чистый архив исходников плюс текущий diff, без .env и без наследования node_modules: npm12.2.2, Node24.22.1, npm ci установил256пакетов. На этом snapshot успешно прошли typecheck,85/85tests и production build. Итог CI конкретного коммита фиксируется в Linear после push.

Из облачного read-only журнала восстановлена отсутствовавшая059_storage_download_permissions.sql. Она уже применена в облаке, повторный SQL не выполнялся. Это обнаружило устаревшее ожидание RLS-теста: recruiter без cv.download не должен видеть Storage. Тест теперь сначала доказывает отказ, потом выдаёт только synthetic fixture явную cv.download и проверяет доступ. Рабочие grants не менялись.

README актуализирован: запуск, env, ledger, CV061 отдельно, приёмка и ограничения. output/work/performance, supabase/.temp/.branches исключены из новых коммитов.

Preview build отклоняет два известных рабочих Supabase refs, отсутствие/несовпадение объявленного тестового проекта, официальный origin и наследование DB password/service/secret key. Проверка read-only; значений ключей в ошибках нет. Production build эту проверку не запускает и миграции автоматически не применяет. Negative check существующего рабочего .env правильно отказал. Unit tests доказывают позитивный синтетический config и негативные варианты; это не доказательство наличия работающей отдельной БД.

HR-14 остаётся In Progress до реальной изолированной Preview-приёмки: отдельный Supabase проект, preview URL и проверенные Auth/RLS/Storage. Подключение к рабочей БД ради зелёного Preview запрещено. HR-21 остаётся разработчику.
