# hr-ai.tech

אתר משרות ומערכת גיוס קיימת: Next.js 16.4.3, React 19.2, TypeScript ו־Supabase (PostgreSQL, Auth, Storage). הממשק בעברית ובאנגלית. שם HeadHunter בתיעוד היסטורי אינו שם המותג הנוכחי.

## מקורות וסטטוס

- [מסמך האב מ־08.11.2026](docs/master-project-prompt.he.md): הדרישות החדשות, MVP וגבולות הפרסום.
- [מפת פערים וראיות בדיקה](docs/mvp-readiness-2026-11-08.he.md): מצב הבדיקה הנוכחי, פערים ותוכנית פיילוט.
- `docs/project-overview.ru.md` ו־`docs/project-documentation.pdf`: תמונות מצב היסטוריות, לא אישור להפעלת הענן כיום.
- Linear: HR-17 מרכז את מסמך האב; HR-14 מרכז CI/Preview; HR-7/HR-8/HR-12 כוללים חסמי קבלה. אין לסמן את ה־MVP כמוכן לפי בדיקות מקומיות בלבד.

## הפעלה מקומית

Node.js 24 ו־npm, ואז:

```sh
npm ci
npm run dev -- --port 3100
```

אם משתמשים בפורט 3100, יש להגדיר `NEXT_PUBLIC_SITE_URL=http://localhost:3100` בהגדרות המקומיות לפני ההרצה, כדי שגם metadata יפנה לפורט הנכון. ברירת המחדל של פיתוח בלי origin מפורש היא localhost:3000.

Next.js קורא `.env` ו־`.env.local` אוטומטית. בדוק את יעד החיבור לפני כל שינוי נתונים. הקובץ המקומי הנוכחי מצביע על מסד העבודה; הוא אינו אישור לבצע בו בדיקות כתיבה. לצורך פיתוח מבודד נדרש פרויקט Supabase נפרד. אין להעתיק נתוני מועמדים אמיתיים למסד בדיקות כברירת מחדל.

| משתנה | מטרה |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | כתובת פרויקט Supabase של הסביבה |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | מפתח ציבורי לאותו פרויקט, עם אכיפת RLS |
| `NEXT_PUBLIC_SITE_URL` | Origin של הסביבה: HTTPS, ללא נתיב; localhost HTTP מותר רק בפיתוח |
| `PREVIEW_SUPABASE_PROJECT_REF` | מזהה מסד הבדיקות הנפרד, חובה ב־Vercel Preview |
| `HH_BUILD_DIR` | תיקיית בנייה נפרדת, למשל `.next-pilot` |

ב־Vercel Preview, אם לא הוגדר `NEXT_PUBLIC_SITE_URL`, ה־origin נגזר מ־`VERCEL_URL` של הפריסה. Production משתמש ב־origin המפורש או ב־`https://www.hr-ai.tech`. מחוץ ל־Vercel ברירת המחדל לבניית release היא `https://www.hr-ai.tech`; פריסות אחרות חייבות להגדיר origin מפורש. קישורי שיתוף בדפדפן משתמשים בכתובת הסביבה הנוכחית. קישורי localhost שימושיים רק במחשב המקומי.

משתני `NEXT_PUBLIC_*` נכנסים לחבילת הדפדפן בזמן בנייה. לעולם לא להוסיף להם סיסמאות, service-role, מפתחות AI או אסימוני פריסה. `.env*` נשארים מחוץ ל־Git; `.env.example` מכיל שמות בלבד. כתיבת הודעות עסקיות ושליחת WhatsApp אינן חלק מהבדיקות המקומיות.

## בדיקות

```sh
npm run typecheck
npm test
npm run build
npm run check:preview -- .env.preview.local
```

`npm test` מריץ Node test runner ו־PGlite עם עד שני תהליכי בדיקה במקביל כדי להגביל צריכת זיכרון. הוא בונה מסד מקומי בזיכרון; הוא אינו משתמש ב־Supabase הענני. תרחישי SQL בשמות cloud עדיין מורצים מקומית במבחנים אלה. אין להריץ ידנית את scripts הישנים נגד ענן בלי לקרוא אותם ולוודא את יעדם.

`.github/workflows/checks.yml` מגדיר `npm ci`, typecheck, tests, build על PR ועל main/codex branches. ה־CI אינו מקבל סודות, אינו נפרס ואינו מחובר למסד עבודה. בנייה ללא Supabase אינה בדיקת תהליכי גיוס. ריצה מוצלחת בענן GitHub צריכה להיקרא בנפרד; עצם קיום הקובץ אינו תוצאה.

## Preview בטוח

1. לעבוד בענף `codex/...`; לא לדחוף ל־main כדי לבדוק שינוי באתר הרשמי.
2. להכין פרויקט Supabase נפרד, schema תואם ונתוני בדיקה מורשים בלבד; לא לייבא Auth או מועמדים מהמסד העובד אוטומטית.
3. ב־Vercel להגדיר משתני Preview בלבד: URL, publishable key, ref נפרד ו־origin. לא להוריש `SUPABASE_SERVICE_ROLE_KEY` או `NEXT_SUPABASE_DB_PASS`. האינטגרציות החיצוניות נשארות כבויות.
4. להריץ `npm run check:preview -- <private-env-file>`. הבדיקה קוראת הגדרות בלבד, אינה מתחברת לרשת ואינה מדפיסה ערכי סודות. מעבר אינו מוכיח שהמפתח שייך לפרויקט או שהענן עובד.
5. גם `next.config.ts` עוצר Vercel Preview אם חסר ref נפרד, נעשה שימוש במסד העבודה הידוע, הוגדר origin רשמי או הועברו הרשאות DB מיותרות. יש לבדוק בנפרד שלא הוגדרו סודות אחרים שהכלי אינו מכיר.
6. לפרסם Preview בלבד; לבדוק את URL הפריסה, SHA, יעד Supabase, Auth redirects ו־Storage. לא לשנות DNS, domain aliases או Production env. Git push בענף אינו הוכחה ל־Preview מוצלח.

הפס העליון מופיע רק ב־development/Preview ומציין את גרסת הבדיקה, ללא טענה שאין נתוני עבודה. ה־footer אינו טוען שהמסד מבודד. Production אינו מציג פס פיתוח. המיתוג הזמני הוא שם טקסטואלי `hr-ai.tech`; לא נבחר לוגו סופי מתוך שלוש ההצעות.

## מסד נתונים ומיגרציות

המקור הנוכחי כולל `001` עד `058`, לפי סדר שמות הקבצים ב־`supabase/migrations/`. הן כוללות ארגונים ותפקידים, RLS, מועמדים ומסמכים, ייבוא, לקוחות ופורטל, תגמולים וחשבונות מסחריים. אין להסתפק ב־001 ו־002.

לפני שינוי ענן יש לקרוא את היסטוריית המיגרציות המרוחקת, להשוות למקור ולבצע גיבוי. אין להחיל את כל הקבצים מחדש על מסד קיים. **פער ידוע:** Linear HR-8 מדווח על `059_storage_download_permissions.sql` בענן, אבל הקובץ אינו נמצא בענף main שסונכרן בחלון עבודה זה. יש להשיג את המקור המדויק וליישב את היסטוריית המיגרציות לפני `db push`. לא להחליף אותו במיגרציה משוערת בעלת אותו מספר.

בדיקות תפקוד ו־RLS מקומיות אינן מכסות JWT, PostgREST, קישורים חתומים, קאש Storage או מייל אמיתי. תיעוד HR-8 כולל כשל פתוח של גישה ל־CV דרך URL שהיה מורשה לפני ביטול הגישה. תנאי ביטול הגישה ובדיקת שחזור מבודד נדרשים לפני פיילוט.

## מפת מקור

- `app/home.tsx`, `landing.tsx`, `public-header.tsx`: האתר הציבורי וניווט החשבון.
- `app/organization-*.tsx`, `workspace.tsx`: סביבת הארגון וההרשאות.
- `app/candidate-*.tsx`: מאגר, CV, מיזוג ופרטי מועמד.
- `app/agency-clients.tsx`, `app/client-portal/`: לקוחות ופורטל מוגבל.
- `app/recruitment-partnerships.tsx`: רישום קשרים; אין לראות בו פורטל ספק מלא.
- `supabase/migrations/`: לוגיקה עסקית ואכיפה במסד, לצד קוד השרת.
- `tests/`: בדיקות מקומיות. `public/design-reference.png`: תמונת הייחוס הקיימת, עם שם ומספרים היסטוריים שאין להעתיק כנתוני מוצר.

קבצי DB, dumps, תוצרים, `supabase/.temp/`, `supabase/.branches/` וסודות אינם נכללים בקומיטים חדשים. יש לבדוק diff לפני commit/push. הוראות העבודה המחייבות נמצאות ב־AGENTS.md.
