# Пилот: фактический доступ оператора и облачный recovery

22.11.2026 владелец поручил проверить именно свой доступ к Help и завершить cloud restore с входом и открытием файла; при нехватке доступа дать Reuven точные действия по-русски. Орену ничего не отправлять. [Обезличенный журнал](pilot-access-gaps-2026-11-22.json).

## Help: подтверждённое ограничение текущего аккаунта

В существующей www-сессии открыты профиль и Help: личность владельца сверена, организация תעסוקה טובה, роль org_admin, форма только «הפניות שלי / My requests». Общего User requests/status UI нет. Read-only SQL рабочего проекта подтвердил отсутствие platform_admin и effective is_platform_admin=false. На момент проверки support_tickets пустая:0своих и0чужих обращений. Отсутствие строк не выдаётся за отрицательный тест с настоящим обращением; вывод о доступе основан на действующей политике, effective role и UI.

Политики014 разрешают читать только собственные tickets либо platform_admin; менять статус может только platform_admin. Предыдущий synthetic admin PASS не подтверждает доступ владельца. Операционная ответственность, утверждённая17.11, не добавляла ему глобальных прав. Новые права не выдавались, тестовая реальная отправка не выполнялась.

Reuven назначена **HR-39**: обеспечить минимальный согласованный доступ к обращениям участников пилота и последующую реальную UI/API-проверку чтения, ответа, статуса/reload и outsider denial. Автоматическое назначение глобального platform_admin не предлагается как обход. HR-16 остаётся In Progress; остальные бизнес-решения сохраняются.

## Recovery: старый target доступен и возобновлён

Ранее утверждённый отдельный target hegfwnvxfrorvbknusej / headhunter-recovery-check был paused. Через существующий FREE Dashboard выполнен Resume; затем фактически увиден Healthy. Это возобновление старого проекта, не импорт свежей копии и не проверка восстановленного входа.

В target выполнен существующий read-only SELECT:43application tables/43RLS tables,3Auth accounts/3identities,330stored jobs/328published,0Storage objects. Приватная staging-схема старого импорта отсутствует. Строка RECOVERY_VERIFIED в SELECT — литерал; она не доказывает новый restore. Target не пустой, текущая копия22.11 содержит75таблиц/23Auth accounts/65миграций и13Storage inventory objects.

Рабочий source Dashboard rnstsczayhzrxzcstzpr по-прежнему перенаправляет к Organizations; текущая сессия его не открывает. В root .env и указанном HR-31 локальном .env.local server key отсутствует; recovery connection variables также отсутствуют в проверенных файлах. Прямой SQL source уже работает и не заменяет Auth/Storage service доступ.

Reuven назначена **HR-38**: закончить source server-key prerequisite HR-31, дать соответствующий Auth/Storage доступ, обеспечить безопасную изолированную пустую цель/согласованный план сохранения старого target и локальные секретные параметры target-подключения. Не менять Production, старый preview, DNS, billing; не отключать empty-target/RLS guards и не перезаписывать старую recovery-копию. Старый prepare-cloud-recovery.mjs для preview/3accounts/0files нельзя применять к текущему snapshot без отдельной адаптации.

## Принято только выполненное

Приняты read-only проверка текущего доступа, возобновление отдельного FREE target и проверка его прежних агрегатов. Свежий cloud restore, actual restored-account login и открытие восстановленного PDF **не выполнены**, доступа для этого недостаточно. HR-13/HR-16 не закрыты; HR-38/HR-39 — конкретные access prerequisites Reuven. Нет писем Орену, реальных referrals, изменения прав владельца или Production deployment.
