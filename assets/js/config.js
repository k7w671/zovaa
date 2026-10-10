/* =====================================================================
   ZOVA store settings — edit these values before going live.
   كل الإعدادات هنا: عدّليها قبل الإطلاق.
   ===================================================================== */
window.ZOVA_CONFIG = {
  // Demo mode: shows a notice at checkout that orders are not charged.
  // وضع العرض التجريبي: اجعليه false بعد ربط بوابة الدفع الحقيقية.
  demo: true,

  currency: 'ر.س',
  vatRate: 0.15,              // prices already include VAT / الأسعار شاملة الضريبة
  freeShippingOver: 299,      // free standard shipping threshold (SAR)
  shipping: {
    standard: { label: 'توصيل عادي', days: '3–5 أيام عمل', price: 25 },
    express:  { label: 'توصيل سريع', days: '1–2 يوم عمل للمدن الرئيسية', price: 45 }
  },
  codFee: 15,                 // cash on delivery fee
  returnsDays: 14,

  // WhatsApp number in international format without + (e.g. '9665XXXXXXXX').
  // Leave empty to hide the "send order on WhatsApp" button.
  // رقم واتساب المتجر بالصيغة الدولية بدون + (اتركيه فارغاً لإخفاء زر واتساب)
  whatsapp: '',
  // Contact details shown on the contact page (examples — replace them).
  contact: {
    phone: '+966 5X XXX XXXX',
    email: 'hello@zova.sa',
    hours: 'يومياً 10 صباحاً – 11 مساءً'
  },

  // Seasonal sale: the countdown hides itself after this date.
  saleEndsAt: '2026-10-31T23:59:59+03:00',
  saleTitle: 'عرض زوفا',

  // Discount codes (demo). type: 'percent' | 'amount'
  coupons: {
    ZOVA10: { type: 'percent', value: 10, label: 'خصم 10% على طلبكِ الأول' }
  },

  cities: ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الظهران', 'الطائف', 'تبوك', 'بريدة', 'أبها', 'خميس مشيط', 'حائل', 'نجران', 'جازان', 'الجبيل', 'الأحساء', 'ينبع', 'القطيف', 'عنيزة', 'الباحة', 'عرعر', 'سكاكا', 'أخرى']
};
