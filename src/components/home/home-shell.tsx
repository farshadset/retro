'use client'

import { useState } from 'react'

type FooterTab = 'home' | 'puzzle' | 'news'

interface FooterItem {
  id: FooterTab
  label: string
}

const FOOTER_ITEMS: FooterItem[] = [
  { id: 'home', label: 'خانه' },
  { id: 'puzzle', label: 'پازل' },
  { id: 'news', label: 'اخبار' },
]

const HOME_ACTIONS = ['بازی آنلاین', 'بازی با دوست', 'بازی آفلاین']

function HomeContent() {
  return (
    <section className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-5 shadow-lg">
      <h2 className="text-center text-xl font-bold text-slate-100">صفحه خانه</h2>
      <p className="text-center text-sm text-slate-300">برای ادامه یکی از گزینه‌های زیر را انتخاب کنید.</p>
      <div className="space-y-3">
        {HOME_ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            className="w-full rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-base font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
          >
            {action}
          </button>
        ))}
      </div>
    </section>
  )
}

function PlaceholderContent({ title }: { title: string }) {
  return (
    <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/70 p-6 text-center">
      <h2 className="text-xl font-bold text-slate-100">{title}</h2>
      <p className="mt-2 text-sm text-slate-400">این بخش در مرحله بعدی تکمیل می‌شود.</p>
    </section>
  )
}

export function HomeShell() {
  const [activeTab, setActiveTab] = useState<FooterTab>('home')

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100" dir="rtl">
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        {activeTab === 'home' ? <HomeContent /> : null}
        {activeTab === 'puzzle' ? <PlaceholderContent title="پازل" /> : null}
        {activeTab === 'news' ? <PlaceholderContent title="اخبار" /> : null}
      </div>

      <footer className="sticky bottom-0 border-t border-slate-700 bg-slate-950/95 px-3 pb-4 pt-3 backdrop-blur">
        <nav className="mx-auto grid w-full max-w-md grid-cols-3 gap-2">
          {FOOTER_ITEMS.map((item) => {
            const isActive = item.id === activeTab
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={[
                  'rounded-xl px-3 py-3 text-sm font-bold transition',
                  isActive ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700',
                ].join(' ')}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
      </footer>
    </main>
  )
}
