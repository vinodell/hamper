# Главная страница «Хампер»

Главная переработана по предоставленному визуальному референсу: светлая бумажная
палитра, зелёные кнопки, крупная антиква, панорамный природный hero, два проекта,
секция «О компании» с каруселью справа и компактные контакты. Существующий SVG-логотип
и название «Хампер» сохранены. Hero Ойнеловских далей получил отдельную панораму.
Маршруты проектов, API и схема базы не менялись.

После уточнения макет уплотнён: уменьшены межсекционные и внутренние отступы,
заголовки и высота фото в проектах, компании и контактах. Вводные подписи
«Наши проекты», дублирующая «О компании» и «Давайте познакомимся» убраны;
основные заголовки и навигационные якоря сохранены.

## Завершённые проекты

Данные карусели находятся в `src/data/completedProjects.ts`. По просьбе владельца
пока оставлены три явно обозначенных места для материалов; вымышленные названия,
локации, даты и показатели продаж не добавлялись. Карусель переключается вручную
кнопками, доступна с клавиатуры и сообщает номер слайда через live region.

Чтобы заполнить карточку, замените её название и добавьте собственную фотографию
в `public/images/completed/`, затем укажите относительный путь:

```ts
{
  id: "01",
  title: "Утверждённое название проекта",
  image: "images/completed/project-01.webp",
  location: "Утверждённая локация",
  description: "Короткое описание реализованного проекта",
}
```

Для неподготовленных полей оставьте `null`: они не показываются. После изменения
данных или фото пересоберите приложение и обновите статическую сборку.

## Контакты и заявка

Два контакта берутся из существующих публичных переменных `VITE_PHONE_MAKS`,
`VITE_PHONE_VLAD`, `VITE_PHONE_HREF`, `VITE_WHATSAPP_MAKS`, `VITE_WHATSAPP_VLAD`,
`VITE_TELEGRAM_MAKS`, `VITE_TELEGRAM_VLAD`. Номера и имена аккаунтов из референса
не копируются. Общий список контактов используется и главной, и прежней формой.

В нижнем блоке оставлены два номера с отдельными WhatsApp и Telegram: без кнопки
заявки, описания, часов работы и почты. Области нажатия мессенджеров — 44×44 px.
Кнопка «Оставить заявку» в шапке открывает существующую модалку с формой. Обязательное
согласие на обработку данных, сохранение заявки и отправка Telegram не изменялись.
Контакты и файлы примера не содержат серверных секретов. Изменение публичных
контактов требует новой клиентской сборки.

## Природные изображения

Созданы встроенным инструментом `image_gen` по визуальному направлению референса.
Это иллюстративные пейзажи, а не документальные фотографии конкретного посёлка.
Реальные фотографии территории подключены к галерее отдельно; актуальный каталог
и параметры сжатия описаны в `docs/gallery-and-cleanup.md`.

Финальные файлы:

- `public/images/nature/home-1920.webp` — главная, 1920×768;
- `public/images/nature/home-960.webp` — мобильная главная и карточка, 960×384;
- `public/images/nature/oinelovo-meadow-1920.webp` — hero Ойнеловских далей без водоёмов, 1920×768;
- `public/images/nature/oinelovo-meadow-960.webp` — его мобильная версия и карточка проекта на главной, 960×384;
- `public/images/nature/oinelovo-960.webp` — прежний пейзаж для контактов на главной.

Ниже — итоговые prompts, использованные во встроенном режиме. Для WebP выполнены
только уменьшение размера и сжатие; композиция не редактировалась.

### Главная

> Use case: photorealistic-natural. Asset type: cinematic ultra-wide landscape photograph for a premium Russian countryside property website hero. Create an original natural editorial aerial photograph, not a website mockup. A peaceful northern European landscape like the Leningrad region: a wide shimmering lake in the upper right and distance, rich mixed pine and birch forest filling most of the frame, a few discreet country cottages and a gently curving gravel lane among meadow clearings in the middle right. Warm late-summer sunset sunlight enters from the right, natural olive greens, warm golden highlights, hazy distant horizon. Elevated drone view, believable photographic detail, quiet and refined, no excessive orange color grading. Landscape aspect ratio about 2.5:1, wide enough for a 1920px website; composition with darker forest in the left half for white text overlays that will be added separately in HTML. No text, no letters, no logos, no UI, no border, no collage, no mountains, no tropical foliage, no large developments. The lake, forest and golden light are the main subjects.

### Ойнеловские дали: первоначальный пейзаж

> Use case: photorealistic-natural. Asset type: original cinematic panoramic nature photograph for the hero of a countryside village website. A tranquil northern European lake surrounded by tall pine and birch trees, as in the Leningrad region of Russia, viewed from a gently elevated forest edge in soft golden late-afternoon sunlight. Dense green forest in foreground left and along the opposite shore, shimmering water in center and right, several meadow clearings, distant soft tree-covered horizon under pale warm sky. Beautiful realistic natural textures, refined calm editorial landscape photography, tasteful warm sunlight, natural forest greens. Ultra-wide landscape composition roughly 2.5:1, high resolution for a 1920px banner; leave naturally shaded forest in the left third for separate HTML heading overlay. No text, no logos, no UI, no border, no mountains, no tropical plants, no identifiable real development or houses.

### Ойнеловские дали: hero без водоёмов

По просьбе владельца hero заменён на лес и луга в вечернем свете. Изображение
создано встроенным `image_gen`, без CLI/API-ключа, и подключено к странице
проекта и его карточке на главной. Для адаптивной загрузки подготовлены WebP 1920×768 и 960×384
(quality 82, method 6, без метаданных). Размеры файлов — 392 120 и 117 434 байт.
Новые имена файлов позволяют браузеру загрузить обновлённый пейзаж при публикации.

Итоговый prompt:

> Use case: photorealistic-natural. Asset type: ultra-wide background image for the hero of a Russian countryside village real estate website, Ойнеловские дали. Generate a realistic, beautiful editorial landscape photo in the northwestern Russian countryside, with a dense mixed pine and birch forest bordering rolling open grassy meadows. Late summer, natural lush green and soft golden foliage, warm golden hour sunlight from upper right, soft long shadows, distant low forest ridges and a calm warm sky. Elevated viewpoint, spacious layered landscape with restrained natural colors and rich authentic forest textures, same premium tranquil countryside feel as a forest-and-lake landscape but completely land-based. Wide panoramic composition approx 5:2 aspect ratio, suitable for a 1920x768 website hero crop: darker forest and foliage at the left for legible white headline overlay, beautiful sunlit meadow, scattered birch trees and forest views toward the center and right; central area should also read well in a narrow mobile crop. No buildings, no houses, no people, no text, no logo, no watermark. Absolutely no water bodies anywhere: no lake, no river, no pond, no sea, no streams, no reflective blue patches or water-like clearings. Photographic realism, not painting, not 3D render, no dramatic mountains.

## Технические границы

Стили главной ограничены `.home-page` и префиксом `home-`. Шапка и подвал получили
вариант `landing`, прежние страницы используют вариант по умолчанию. Используется
уже подключённый Tailwind, React и CSS, без новых зависимостей браузерной сборки.
Лишнего autoplay, WebGL и постоянных циклов анимации нет; reduced motion отключает
переходы. Все фотографии и шрифты обслуживаются локально.

Браузерные проверки используют синтетические контакты и локальные заявки;
внешние запросы и реальные уведомления не отправляются.

## Проверка результата

- `npm test`: 197 проверок, все прошли.
- `npm run build`: TypeScript, клиентская и серверная production-сборки прошли.
- `npm run test:browser`: 88 сценариев, ошибок JavaScript нет. Проверены ширины
  375, 768, 1440 и 1920 px, навигация, карусель и сохранение клавиатурного фокуса,
  контакты, согласие и отправка заявки, карта, админка и Journal.
- Отдельно проверены загрузка и внешний вид новых обложек на четырёх ширинах.
- Standards review: найдены и исправлены потеря фокуса карусели и недостаточный
  контраст текста заглушки. Итог повторного ревью — 0 замечаний.
- Spec review: итог — 0 замечаний.
- После уплотнения повторно прошли сборка, 197 тестов и 88 браузерных сценариев;
  review точечных правок — без замечаний. На контрольных снимках полная высота
  страницы уменьшилась с 2324 до 1908 px при ширине 1440 px и с 3250 до 2657 px
  при ширине 375 px; hero сохранён.

Актуальные снимки для просмотра находятся в `release/review/`. Телефоны на них
синтетические: сборка для хостинга использует обычную конфигурацию проекта.

## Обновление существующего сайта на Hostland

Архив `release/hamper-public-update_YYYY-MM-DD_HH-mm-ss_MSK.zip` содержит папку `public` с новой
клиентской сборкой. Он предназначен для уже работающего Node.js-приложения.
Дата и время в имени указаны по Москве. Точные имена актуальных архивов —
в `release/README.md`, время создания и SHA-256 — в `release/verification.json`.

1. Сохраните резервную копию текущей папки `public` вне публичного каталога сайта.
2. Распакуйте архив локально и замените папку `public` целиком, включая `.htaccess`,
   чтобы не оставлять старые файлы JS/CSS. По возможности подготовьте новую папку
   рядом и переключите её переименованием; для отката верните сохранённую копию.
   Для основного домена ожидаемый путь — `hamper-village.ru/projects/hamper/public/`;
   ориентируйтесь на каталог реально работающего Node.js-приложения в панели.
3. Обновите страницу без кэша. Проверьте главную, страницу Ойнеловских далей и
   открытие заявки. Данные участков продолжают поступать из существующего API.

Папки `private`, `tmp`, серверные файлы и `.env.server` для обновления дизайна
заменять не требуется. Импорт JSON или миграция базы для этих изменений не нужны.
Полный архив приложения создаётся как
`release/hamper-hostland_YYYY-MM-DD_HH-mm-ss_MSK.zip`.

Изменения оставлены для локального review; commit, push и публикация не выполнялись.
