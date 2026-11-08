# Точное сопоставление главной с reference01

09.11.2026, Asia/Jerusalem; HR-17. Прямое поручение владельца: довести размеры/positions/spacing/fonts/icons до рисунка01, оставить4filters/8jobs, показать сравнение до объявления завершения.

## База измерения

Reference: `output/design-comparison-v1/01-original-tech-new-logo.png`, 862×1824. Сравнивается фактическая ширина CONTENT862, а не outer viewport с15px scrollbar. Browser full-page capture может скрывать scrollbar: geometry записывается после capture и clientWidth проверяется. На desktop все размеры задаются одной единицей `--u` от container width, с пределом1240px; mobile сохраняет responsive layout. Источник `app/landing-precision.css`, scoped landingPrecision, импорт после прежних scoped base styles.

| Область | Reference при862 | Actual при862 |
|---|---|---|
| Header | y0,h61 | y0,h61 |
| Hero | y61,h392 | y61,h392 |
| Profile | x50,y90,205×338 | x50,y90,205×338 |
| Benefits cards | y515,h163 | y515,h163 |
| Search container | x32,y709,798×165 | x32,y709,798×165 |
| Search row | y769,h42 | y769,h42,4настоящих поля |
| Career center | y907,h206 | y907+J,h206 |
| Metrics | y1135,h142 | y1135+J,h142 |
| Steps cards | y1355,h132 | y1355+J,h132 |
| CTA | y1508,h102 | y1508+J,h102 |
| Footer | y1618,h206 | y1618+J,h206 |

J — фактический добавленный блок8вакансий с отступом. Его высота зависит от содержимого; он не вырезан из настоящего сайта. В сравнивающем HTML регионы выровнены по собственным anchors, а8jobs показаны отдельно с явной подписью. Это устраняет ложное вертикальное расхождение последующих блоков и не объявляется идентичностью всей длинной страницы.

Heebo остаётся локальным шрифтом. Для главного Hebrew heading подобраны size44.5/weight850/spacing-1.45; raster dark-ink bounds reference и actual совпали: x557..798,y152..193. Gradient второй строки уточнён по sampled colours/position. Заголовки других секций, pill/buttons/profile labels/footer имеют отдельные измеренные размеры и line-height.

## Точные исходные графические элементы

`public/landing-reference-atlas.png` — побайтовая копия выбранного PNG, без ImageGen/перерисовки/изменения исходного bitmap. `ReferenceIcon` использует CSS background sprites для benefits/tools/metrics/steps, сохраняя фактические strokes/colours. Head и portraits — CSS crops того же source; весь сайт/текст НЕ заменён скриншотом: headings/cards/forms/navigation остаются HTML. Direction отражает только head graphic; отдельный AI overlay исправляет буквы в LTR. Card/logo/text не зеркалятся.

Filter labels обёрнуты в span.filterName; на desktop визуально скрыты стандартным clipping, оставаясь accessible names. Mobile показывает названия. Dictionaries, handlers, значения/options, область→role→region→city и8jobs slice не менялись. Проверена видимость21field options сfont13px и переходkeyword נתניה в каталог. Ссылка Forgot password остаётся только в auth, не footer. Header language switch в варианте tech убран, как в reference; настоящий переключатель доступен в footer, saved preference/defaultEnglish сохранены.

## Сравнение до завершения

`output/precision-comparison.html`: standalone offline HTML со встроенными source/actual screenshots, side-by-side, overlay/opacity и zoom; `http://localhost:3101/` — локальный read-only viewer. Области: header/hero,benefits,search,career,metrics,steps,CTA,footer;8jobs отдельным блоком. Before screenshot сохранён как output/precision-before-862.png, actual — precision-after-862.png, measurements — precision-measurements.json. HTML и screenshots — служебные review artifacts, не Git. Сравнение было открыто пользователю и screenshot показан в сообщении ДО финального результата.

Содержательные ограничения из landing-tech-reference сохраняются: неизвестные метрики—, illustrativeCV вместо95%, plannedAI, disabled непубликованные legal/blog/social destinations. Не переносить неподтверждённые рекламные цифры ради similarity. Нельзя выдавать совпадение anchors/bounds за доказательство совпадения каждого пикселя raster-rendering во всех браузерах.

## Уточнения измеряемого этапа

Desktop orbital illustration и footer social/globe icons тоже используют неизменённый reference atlas, включая исходные orbit paths/звёзды/portrait pixels. Неподтверждённые тексты/score/метрики в crop не включаются. Настоящая карточка с labels/CV и все блоки интерфейса остаются HTML. На mobile head crop получает explicit aspect-ratio, чтобы переход с intrinsic Image на CSS graphic не схлопывал высоту. Это найдено и исправлено в реальном390px QA, не объявлено пройденным до проверки.

Проверены реальные viewport390 (he/en),768 (he/en),1280 (en),content862 (he): 8jobs, no horizontal overflow, RTL/LTR face orientation, FAQ4, Forgot password внутри Signin и переносkeyword נתניה в каталог. Listbox показал21field options сfont13px. Comparison overlay переключается; screenshot сравнения показан владельцу в commentary до завершения. Productionbuild/18targetedtests прошли; финальная публикация фиксируется в HR-17.
