# HR-42: единый вид выбора региона и города

Поручение владельца22.11.2026: проверить, почему «כל האזורים» отличается от «כל הערים». Причина подтверждена кодом: регион был native select, город — LocationInput с собственной locationMenu.

В HeroSearch и JobsCatalog регион заменён на RegionPicker с теми же классами locationAutocomplete/locationMenu, что город. Сохранён порядок field → keyword/role → region → city, все9регионов с прежними ключами, zero-count варианты и исходные regionOptions counts. Опция «Все регионы» снимает фильтр. Изменение выбранного ключа по-прежнему очищает город; существующие regionMatches/locationMatches не меняются. Работают поиск по HE/EN названиям независимо от текущей локали, клавиатура ArrowUp/Down/Enter/Escape/Tab, выбор pointer и закрытие при уходе фокуса. Поисковая строка не становится вымышленным region key.

Проверки: новый option suite проверяет оба языка, исходные ключи/порядок/счётчики, zero-job regions, bilingual search и пересечение region/city; существующие geography/location/Hebrew tests выполняются вместе с ним. TypeScript/build и итоговый SHA фиксируются в HR-42.

Локальный итог23.11.2026:8/8 targeted tests PASS; TypeScript PASS; повторная последовательная production build PASS, без повторов prerender (compile4.7s, TypeScript3.5s, static pages927ms). Это проверка сборки, а не UI-замер скорости или подтверждение мобильного отображения.

Владелец предпочёл новую вкладку внутри Codex; open_in_codex принял URL https://www.hr-ai.tech/#positions. Это не доказывает визуальную/интерактивную проверку: текущего инструмента управления вкладкой нет, Chrome control отклонён. Desktop/phone/iPad UI acceptance пока не подтверждена. Ветка/push не означают публикацию; release blocker HR-35 сохраняется. CV/OCR HR-41 ведётся отдельно и не входит в этот diff.
