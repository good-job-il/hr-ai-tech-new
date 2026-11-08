# Утверждённый логотип hr-ai.tech

Дата: 8 ноября 2026 года. Связанная задача: HR-17.

Владелец явно выбрал предложение 2 второго раунда: глянцевая сине-фиолетовая монограмма **HR** в скруглённом квадрате, рядом **hr-ai.tech** и подпись **HR-Tech**. Затем дал прямое указание заменить логотип. Это решение заменяет историческое описание H/HeadHunter на странице 4 PDF и прежнее состояние «логотип не выбран» в Linear; остальные продуктовые требования им не меняются.

Символ подготовлен из выбранной иллюстрации output/logo-proposals-v2/02-hr.png встроенным ImageGen. Production-файл: public/brand-hr-v1.png. Исходная неиспользуемая эмблема public/brand-icon.jpg сохранена. В сайт не встраивается презентация с макетом навигации. Текст hr-ai.tech и подпись HR-Tech выводятся средствами интерфейса для чёткости в разных размерах. BrandIcon использует next/image для оптимизации размера загружаемого изображения. PNG имеет белый фон, как прежний JPG; варианты с шумом по прозрачному краю отброшены.

Обновлены видимые названия в приложении и вспомогательных текстах, публичная шапка и footer, боковая панель, загрузка аккаунта, страница вакансии и иллюстрация работодателя, favicon/apple icon и изображение Open Graph. Служебные идентификаторы, ключи localStorage, имена файлов импорта/экспорта, старые URL и UID событий не переименовываются автоматически. Дизайн и бизнес-процессы не меняются; фонды и настройки облака этим релизом не затрагиваются.

Новый PNG имеет отдельный versioned URL для обновления кэша. Публичный интерфейс проверяется на desktop, 390×844 и 768×1024, в Hebrew RTL и English LTR. Размеры экрана эмулируются в браузере; это не физические устройства. Прямой доступ к приватным аккаунтам для проверки логотипа не требуется.

Перед публикацией: TypeScript, production build, связанные существующие тесты и diff. После push main отдельно подтвердить файл и видимый результат на www.hr-ai.tech; SHA, результаты и ограничения записать в HR-17. Не считать весь MVP принятым по результату изменения бренда.

## Финальный промпт подготовки символа

Инструмент: встроенный ImageGen, referenced_image_paths — выбранная иллюстрация 02-hr.png, transparent_background=false.

> Extract the approved large HR icon in the upper-left of this reference into a clean square production asset. Preserve the glossy rounded-square purple-blue tile and connected sculpted HR letterforms exactly as approved. Output only this single HR square icon centered on a PURE WHITE (#ffffff) square background, tight 2% white margin. NO transparency, all pixels opaque. Absolutely clean smooth rounded tile edges: no stray colored pixels, no glow or external shadows, no speckles. No wordmark, no subtitle, no lower website header, no other content. Keep the soft glass highlights and exact purple-to-blue color scheme and HR shape. This is a faithful extraction, not a redesign.
