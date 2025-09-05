# راهنمای دیپلوی وب‌سایت RETRO

## 🚀 روش‌های دیپلوی

### 1. دیپلوی خودکار (پیشنهادی)
```bash
npm run deploy
```
این دستور تمام مراحل را به صورت خودکار انجام می‌دهد:
- پاک کردن build های قبلی
- نصب dependencies
- اجرای linting
- بهینه‌سازی عملکرد
- ساخت پروژه
- دیپلوی به Vercel

### 2. دیپلوی دستی به Vercel
```bash
# نصب Vercel CLI (اگر نصب نیست)
npm install -g vercel

# دیپلوی production
npm run deploy:vercel

# یا دیپلوی preview
npm run deploy:preview
```

### 3. دیپلوی محلی برای تست
```bash
npm run preview
```

## 📋 پیش‌نیازها

### 1. نصب Vercel CLI
```bash
npm install -g vercel
```

### 2. ورود به Vercel
```bash
vercel login
```

### 3. تنظیم پروژه
```bash
vercel link
```

## ⚙️ تنظیمات دیپلوی

### فایل vercel.json
```json
{
  "buildCommand": "npm run build:optimized",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["cdg1"],
  "functions": {
    "src/app/api/**/*.js": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

## 🔧 بهینه‌سازی‌های اعمال شده

### 1. Mobile-First Design
- حداکثر عرض 483px برای موبایل
- عناصر 3 برابر کوچک‌تر از دسکتاپ
- واحدهای انعطاف‌پذیر (%, vh, vw, rem)

### 2. Material Design
- پالت رنگی استاندارد
- تایپوگرافی مقیاس‌پذیر
- سیستم 8dp grid
- کامپوننت‌های استاندارد

### 3. Accessibility
- Alt attributes برای تصاویر
- ARIA labels
- پشتیبانی از keyboard navigation
- نسبت کنتراست مناسب

### 4. Performance
- Lazy loading تصاویر
- بهینه‌سازی CSS
- کاهش انیمیشن‌ها در موبایل
- فشرده‌سازی فایل‌ها

## 📱 تست پس از دیپلوی

### 1. تست موبایل
- [ ] عرض حداکثر 483px
- [ ] عناصر 3 برابر کوچک‌تر
- [ ] Touch targets حداقل 44px
- [ ] اسکرول افقی navigation

### 2. تست دسکتاپ
- [ ] طراحی بدون تغییر
- [ ] عملکرد کامل
- [ ] انیمیشن‌های نرم

### 3. تست عملکرد
- [ ] زمان بارگذاری زیر 3 ثانیه
- [ ] تصاویر lazy load
- [ ] انیمیشن‌های روان

## 🐛 عیب‌یابی

### مشکلات رایج
1. **خطای build**: بررسی dependencies
2. **خطای Vercel**: بررسی vercel.json
3. **مشکل responsive**: بررسی CSS breakpoints

### دستورات مفید
```bash
# بررسی وضعیت Vercel
vercel ls

# مشاهده لاگ‌ها
vercel logs

# حذف deployment
vercel remove
```

## 📊 مانیتورینگ

### 1. Vercel Dashboard
- عملکرد سایت
- ترافیک
- خطاها

### 2. Google PageSpeed Insights
- سرعت بارگذاری
- بهینه‌سازی موبایل
- نمره عملکرد

### 3. Lighthouse
- Accessibility
- Performance
- Best Practices

## 🔄 به‌روزرسانی

### 1. تغییرات کد
```bash
git add .
git commit -m "Update: description"
git push
```

### 2. دیپلوی مجدد
```bash
npm run deploy
```

## 📞 پشتیبانی

در صورت بروز مشکل:
1. بررسی لاگ‌های Vercel
2. تست محلی با `npm run preview`
3. بررسی تنظیمات vercel.json

---

**نکته**: پس از دیپلوی، حتماً سایت را در دستگاه‌های مختلف تست کنید تا از عملکرد صحیح responsive design اطمینان حاصل کنید.
