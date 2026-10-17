import type { Dictionary } from "./en";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };

const ar: DeepPartial<Dictionary> = {
  app: { tagline: "تدرّب بذكاء. تحرّك أفضل. ابنِ لمدى الحياة." },
  nav: {
    today: "اليوم",
    coach: "المدرب الذكي",
    plans: "الخطط",
    academy: "الأكاديمية",
    exercises: "التمارين",
    nutrition: "التغذية",
    activity: "النشاط",
    progress: "التقدم",
    recovery: "الاستشفاء",
    formCheck: "تحليل الأداء",
    challenges: "التحديات",
    community: "المجتمع",
    sports: "الرياضات",
    profile: "الملف الشخصي",
    more: "المزيد",
    pricing: "الاشتراكات",
    logout: "تسجيل الخروج",
    notifications: "الإشعارات",
  },
  common: { save: "حفظ", cancel: "إلغاء", delete: "حذف", edit: "تعديل", add: "إضافة", close: "إغلاق", back: "رجوع", next: "التالي", skip: "تخطي", done: "تم", start: "ابدأ", loading: "جارٍ التحميل…", retry: "حاول مجددًا", search: "بحث", today: "اليوم" },
  auth: { login: "تسجيل الدخول", register: "إنشاء حساب", email: "البريد الإلكتروني", password: "كلمة المرور", welcomeBack: "مرحبًا بعودتك", startJourney: "ابدأ رحلتك" },
  today: { greeting: "جاهز يا {name}؟", todaysSession: "حصة اليوم", startWorkout: "ابدأ التمرين", resume: "استئناف", restDay: "يوم راحة مخطط", weekly: "هذا الأسبوع", streak: "سلسلة الأيام" },
  workout: { warmup: "الإحماء", main: "التمرين الرئيسي", cooldown: "التهدئة", sets: "مجموعات", reps: "تكرارات", rest: "راحة", pause: "إيقاف مؤقت", resume: "استئناف", finish: "إنهاء التمرين" },
};
export default ar;
