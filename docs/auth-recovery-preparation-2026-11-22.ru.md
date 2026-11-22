# HR-7 / HR-38: текущая Auth API приёмка и подготовка recovery

22.11.2026 владелец поручил продолжить доступные проверки HR-7 и подготовку HR-38, без сообщений Орену. Прочитаны актуальные задачи/комментарии, документ Linear «HR-7 — матрица Auth и ролей,08.11.2026», обзор проекта и PDFстр6/14. Исторические пять browser-ролей08.11 не выдаются за текущий повторный прогон. [Обезличенный отчёт](auth-recovery-preparation-2026-11-22.json).

## HR-7: реально выполненные облачные API-проверки

Четыре существующих синтетических аккаунта из приватного QA manifest вошли через действующий Supabase Auth API с publishable key и обычными credentials. Для каждого подтверждены точная собственная identity, email confirmation, getUser, отсутствие platform_admin, личный membership-контекст, local logout и отказ refresh после logout. QA org_admin имеет org_admin, recruiter — recruitment_coordinator, остальные два аккаунта — без memberships. Новых ролей и portal grants не добавлялось; сам факт входа QA client не является приёмкой нового клиентского портала.

Дополнительно одна неправильная попытка пароля только QA user отклонена invalid_credentials; анонимный SELECT candidates отклонён42501, приватных строк0. Пароли/JWT/refresh tokens/email/UUID не сохранены в публикуемых результатах. Проверочные Auth-сессии завершены local logout; пользовательская сессия владельца не использовалась. Access JWT может оставаться действительным до истечения срока — мгновенный отзыв JWT не заявляется.

Не выполнялись signup/recovery email, изменение пароля владельца, вход владельца-платформенного администратора и browser recovery/redirect/logout/reload. HR-7 остаётся In Progress до предусмотренной полной приёмки; доступ к обычному Auth API не заменяет Dashboard SMTP/configuration доступ.

## HR-38: подготовка текущего формата snapshot

Старый prepare-cloud-recovery.mjs для preview/3accounts/0files не изменялся и не запускался. Добавлен отдельный offline planner lib/pilot-recovery-preflight.mjs и stdin CLI scripts/check-pilot-recovery-preflight.mjs. Он принимает текущий формат hr-ai-private-snapshot-v1, требует правильный source ref и migration statements, собирает только агрегаты и план стадий. При неподтверждённом/неразрешённом/непустом target и отсутствии file bytes выдаёт blockers. Семь meaningful regression tests PASS: production/preview/unknown target, nonempty application/Auth/Storage, historical evidence, missing bytes, legacy/malformed source и отсутствие приватных значений в отчёте.

Фактически расшифрована в памяти текущая копия22.11 17:02:32UTC после проверки encrypted SHA256 и передана planner через stdin, без plaintext-файла. Подтверждены75таблиц/1 090 962строки/23Auth accounts/65миграций/13Storage inventory objects. Для последнего известного target43tables/3Auth users/0files, явно помеченного historical, получены ровно три blockers: CURRENT_TARGET_READBACK_REQUIRED, EMPTY_TARGET_REQUIRED, STORAGE_FILE_BYTES_REQUIRED. CLI exit2 означает ожидаемую остановку, а не successful restore; exit1 — ошибка формата, exit0 — пройдены лишь проверки подготовки.

Planner не соединяется с БД, не генерирует исполняемый полный cloud restore, не выполняет SQL/Auth/Storage mutations и не даёт права на них. Переданный caller descriptor/boolean не является фактическим server readback или доказательством наличия bytes; будущий executor обязан получить эти подтверждения самостоятельно. Полный current-format cloud executor/совместимость Auth схемы и восстановление файлов остаются отдельной незавершённой работой после безопасного target/source доступа.

Локальный вызов: расшифрованный snapshot передаётся только по stdin в `node scripts/check-pilot-recovery-preflight.mjs <target-descriptor.json>`. Descriptor содержит projectRef, liveEvidence и числовые applicationTables/authAccounts/storageObjects; никаких ключей. Реальный target никогда не объявлять пустым путём ручной подстановки нулей. Не печатать snapshot и не сохранять plaintext ради CLI. Подробные секретные операции не публикуются.

## Осталось

HR-38 остаётся Backlog у Reuven по access-scope; подготовка не закрывает её критерии. Нужны source Storage/Auth доступ, согласованный пустой изолированный target и защищённое подключение. Фактический cloud restore, восстановленный вход и открытие восстановленного файла не выполнялись. Production, старый target, роли владельца, billing, DNS и реальные кандидаты не менялись; Орену ничего не отправлено.
