import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useClerk, useUser } from '@clerk/react';
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, ChartNoAxesCombined, ChevronDown,
  CircleHelp, CreditCard, LayoutDashboard, Menu, PiggyBank, Settings2, ShieldCheck, Sparkles,
  Target, Wallet, X,
} from 'lucide-react';

const navigation = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Transactions', href: '/transactions', icon: ArrowUpRight },
  { label: 'Budget', href: '/budget', icon: Wallet },
  { label: 'Savings', href: '/savings', icon: PiggyBank },
  { label: 'Commitments', href: '/commitments', icon: Target },
  { label: 'Subscriptions', href: '/subscriptions', icon: CreditCard },
  { label: 'Simulator', href: '/simulator', icon: Activity },
  { label: 'Insights', href: '/insights', icon: ChartNoAxesCombined },
  { label: 'Notifications', href: '/notifications', icon: Bell },
];

function Logo({ large = false }: { large?: boolean }) {
  return <span className={`flex items-center gap-3 ${large ? '' : ''}`} data-testid="brand-finsync">
    <span className="grid h-10 w-10 place-items-center rounded-[14px] border border-emerald-300/20 bg-emerald-400/10">
      <img src={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/logo.svg`} className="h-7 w-7" alt="" />
    </span>
    <span className="font-display text-[1.12rem] font-extrabold tracking-[-.045em] text-[#eaf6ed]">FIN<span className="text-[#71d494]">Sync</span></span>
  </span>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();
  const activeItem = navigation.find((item) => item.href === location);
  const userName = user?.firstName || 'Your space';
  return <div className="grain min-h-[100dvh] bg-[#0c1711] text-[#e7f1e9]" data-testid="layout-app">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-[#25382c] bg-[#0f1b14] px-4 py-6 lg:flex">
      <Link href="/dashboard" className="mb-9 px-2" data-testid="link-brand-dashboard"><Logo /></Link>
      <p className="eyebrow px-3 pb-3">Your money, in view</p>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Main navigation" data-testid="navigation-main">
        {navigation.map(({ label, href, icon: Icon }) => {
          const active = location === href;
          return <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase()}`}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[.88rem] font-medium transition-colors ${active ? 'border border-emerald-300/10 bg-[#1a3324] text-[#83dda0]' : 'text-[#a4b6a8] hover:bg-[#1b2a20] hover:text-[#eaf6ed]'}`}>
            <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
            {label === 'Simulator' && <span className="ml-auto rounded-full bg-[#254a32] px-2 py-0.5 text-[.62rem] font-bold uppercase tracking-wider text-[#96e2aa]">Try</span>}
          </Link>;
        })}
      </nav>
      <div className="my-4 border-t border-[#25382c]" />
      <Link href="/settings" data-testid="link-nav-settings" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[.88rem] font-medium ${location === '/settings' ? 'bg-[#1a3324] text-[#83dda0]' : 'text-[#a4b6a8] hover:bg-[#1b2a20]'}`}><Settings2 size={17} />Settings</Link>
      <div className="mt-5 rounded-2xl border border-emerald-200/10 bg-gradient-to-br from-[#173824] to-[#14251a] p-4">
        <div className="mb-2 flex items-center gap-2 text-[#a7dcb4]"><ShieldCheck size={15} /><span className="text-xs font-semibold">A private practice space</span></div>
        <p className="text-xs leading-5 text-[#a8b9ab]">Your numbers are estimates you enter. No bank connection, no real payments.</p>
      </div>
      <button onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL || '/' })} data-testid="button-sign-out"
        className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#9daf9f] hover:bg-[#1b2a20] hover:text-white">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#294532] text-xs font-bold text-[#c8efd1]">{userName.slice(0, 1).toUpperCase()}</span>
        <span className="min-w-0 flex-1 truncate text-left">{userName}</span><ChevronDown size={14} />
      </button>
    </aside>

    <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#25382c] bg-[#0c1711]/90 px-4 backdrop-blur-xl sm:px-7 lg:ml-[248px] lg:px-10">
      <div className="flex items-center gap-3">
        <button onClick={() => setMenuOpen(!menuOpen)} data-testid="button-mobile-menu" className="grid h-9 w-9 place-items-center rounded-xl border border-[#2b4032] text-[#b9ccbd] lg:hidden" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}>{menuOpen ? <X size={17} /> : <Menu size={17} />}</button>
        <div className="lg:hidden"><Link href="/dashboard" className="inline-flex" data-testid="link-mobile-brand"><Logo /></Link></div>
        <div className="hidden lg:block"><p className="text-xs text-[#8ba08f]" data-testid="text-breadcrumb">Your space / {activeItem?.label ?? 'Overview'}</p><p className="mt-0.5 font-display text-sm font-semibold text-[#dce9df]" data-testid="text-current-page">{activeItem?.label ?? 'Overview'}</p></div>
      </div>
      <div className="flex items-center gap-2.5">
        <Link href="/notifications" data-testid="link-header-notifications" aria-label="Notifications" className="relative grid h-9 w-9 place-items-center rounded-xl border border-[#293d30] text-[#a9bcae] hover:bg-[#1c3023]"><Bell size={16} /></Link>
        <div className="hidden items-center gap-2 rounded-full border border-[#2b4133] bg-[#14241a] py-1 pl-1 pr-3 sm:flex">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#264a32] text-xs font-bold text-[#a9e4b7]">{userName.slice(0,1).toUpperCase()}</span>
          <span className="max-w-[120px] truncate text-xs font-medium text-[#c5d3c8]" data-testid="text-user-name">{userName}</span>
        </div>
        <button onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL || '/' })} data-testid="button-header-sign-out" className="hidden rounded-lg px-2 py-2 text-xs text-[#95aa9a] hover:text-white sm:block">Sign out</button>
      </div>
    </header>

    {menuOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMenuOpen(false)}>
      <aside className="h-full w-[min(82vw,300px)] border-r border-[#294032] bg-[#0f1b14] p-5" onClick={(event) => event.stopPropagation()}>
        <div className="mb-8 flex items-center justify-between"><Logo /><button onClick={() => setMenuOpen(false)} aria-label="Close navigation" data-testid="button-close-mobile-menu" className="text-[#b6c8b9]"><X size={18} /></button></div>
        <nav className="flex flex-col gap-1">{navigation.map(({ label, href, icon: Icon }) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} data-testid={`mobile-nav-${label.toLowerCase()}`} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${location === href ? 'bg-[#1a3324] text-[#83dda0]' : 'text-[#a4b6a8]'}`}><Icon size={17} />{label}</Link>)}
          <Link href="/settings" onClick={() => setMenuOpen(false)} data-testid="mobile-nav-settings" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#a4b6a8]"><Settings2 size={17} />Settings</Link>
        </nav>
      </aside>
    </div>}

    <main className="mx-auto min-h-[calc(100dvh-68px)] max-w-[1500px] px-4 pb-28 pt-7 sm:px-7 lg:ml-[248px] lg:px-10 lg:pb-12 lg:pt-10" data-testid="main-content">
      {children}
      <footer className="mt-12 border-t border-[#21352a] pt-5 text-xs leading-5 text-[#75897a]" data-testid="text-app-disclaimer">
        FINSync is a planning simulator. Balances and forecasts are estimates based on information you provide; no bank credentials or payment services are connected.
      </footer>
    </main>
    <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-[#2a3e31] bg-[#101d15]/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-xl lg:hidden" data-testid="navigation-mobile-bottom">
      {navigation.slice(0, 5).map(({ label, href, icon: Icon }) => <Link href={href} key={href} data-testid={`bottom-nav-${label.toLowerCase()}`} className={`flex min-w-[58px] flex-col items-center gap-1 rounded-xl py-1.5 text-[.62rem] ${location === href ? 'text-[#7cdb99]' : 'text-[#839789]'}`}><Icon size={18} />{label}</Link>)}
    </nav>
  </div>;
}

export function LandingPage() {
  return <div className="grain min-h-[100dvh] overflow-hidden bg-[#0c1711] text-[#e7f1e9]" data-testid="page-landing">
    <header className="relative z-10 mx-auto flex max-w-[1280px] items-center justify-between px-5 py-5 sm:px-10 lg:px-14">
      <Link href="/" className="inline-flex" data-testid="link-landing-brand"><Logo large /></Link>
      <nav className="hidden items-center gap-8 text-sm text-[#a6b8aa] md:flex" aria-label="Landing navigation" data-testid="navigation-landing"><a href="#how-it-works" data-testid="link-how-it-works" className="hover:text-white">How it works</a><a href="#built-for-real-life" data-testid="link-for-real-life" className="hover:text-white">Made for real life</a><a href="#privacy" data-testid="link-privacy" className="hover:text-white">Privacy first</a></nav>
      <div className="flex items-center gap-3">
        <Link href="/sign-in" data-testid="link-landing-sign-in" className="hidden rounded-xl px-3 py-2 text-sm font-medium text-[#bdd0c1] hover:text-white sm:inline-flex">Sign in</Link>
        <Link href="/sign-up" data-testid="button-landing-get-started" className="rounded-xl bg-[#69d18e] px-4 py-2.5 text-sm font-bold text-[#102016] transition hover:bg-[#85e4a5]">Start your challenge <ArrowRight size={15} className="ml-2" /></Link>
      </div>
    </header>
    <section className="relative mx-auto grid max-w-[1280px] items-center gap-10 px-5 pb-20 pt-12 sm:px-10 md:grid-cols-[1.08fr_.92fr] md:pb-32 md:pt-20 lg:px-14">
      <div className="absolute -left-40 top-10 h-[500px] w-[500px] rounded-full bg-[#1c623c]/15 blur-[100px]" />
      <div className="relative z-10 enter">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#538d63]/30 bg-[#143322]/75 px-3.5 py-2 text-xs font-semibold text-[#a7ddb4]"><span className="h-1.5 w-1.5 rounded-full bg-[#6bd58f]" />Your ₹10,000 / 30-day money challenge</div>
        <h1 className="max-w-[730px] font-display text-[clamp(3.45rem,8vw,6.8rem)] font-semibold leading-[.99] tracking-[-.075em] text-[#f0f7f1]" data-testid="text-landing-headline">A little more<br />room to <span className="text-[#70d392]">choose.</span></h1>
        <p className="mt-7 max-w-[525px] text-[1.08rem] leading-8 text-[#afc0b2]">Make everyday money decisions with a clearer head. Plan your month, explore a what-if, and see what the trade-off might look like — before you decide.</p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Link href="/sign-up" data-testid="button-hero-start-challenge" className="inline-flex items-center rounded-xl bg-[#69d18e] px-5 py-3.5 text-sm font-bold text-[#102016] shadow-[0_12px_30px_rgba(36,142,78,.16)] transition hover:-translate-y-0.5 hover:bg-[#85e4a5]">Start with your numbers <ArrowRight size={16} className="ml-2" /></Link>
          <a href="#how-it-works" data-testid="link-hero-how-it-works" className="rounded-xl px-3 py-3 text-sm font-medium text-[#b9c9bc] hover:text-white">See how it works</a>
        </div>
        <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#829888]"><span className="inline-flex items-center gap-2"><ShieldCheck size={14} className="text-[#76cc8d]" />No bank credentials</span><span className="inline-flex items-center gap-2"><CircleHelp size={14} className="text-[#76cc8d]" />Estimates, not promises</span></div>
      </div>
      <div className="relative mx-auto w-full max-w-[520px] enter [animation-delay:100ms]">
        <div className="absolute -inset-6 rounded-[40px] bg-gradient-to-br from-[#1d6940]/20 via-transparent to-[#426d48]/10 blur-2xl" />
        <div className="panel relative overflow-hidden rounded-[30px] p-5 sm:p-7" data-testid="card-landing-preview">
          <div className="mb-6 flex items-center justify-between"><div><p className="eyebrow">Illustrative plan · example only</p><p className="mt-1 text-xs text-[#83988a]">A preview, not anyone’s account</p></div><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#20452d] text-[#80d99c]"><ChartNoAxesCombined size={18} /></div></div>
          <div className="rounded-2xl border border-[#ffffff0b] bg-[#0d1c13]/65 p-5">
            <div className="flex items-end justify-between"><div><p className="text-xs text-[#92a597]">Plan balance</p><p className="mt-2 font-display text-4xl font-semibold tracking-[-.06em] text-[#eef7ef]">₹10,000</p></div><span className="rounded-full bg-[#23462d] px-2.5 py-1 text-[.67rem] font-semibold text-[#a8e2b6]">30 days</span></div>
            <div className="mt-6 h-[108px] overflow-hidden"><svg viewBox="0 0 420 100" role="img" aria-label="Illustrative rising balance line" className="h-full w-full"><defs><linearGradient id="landingArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#5ac880" stopOpacity=".22" /><stop offset="1" stopColor="#5ac880" stopOpacity="0" /></linearGradient></defs><path d="M0 76 C36 76 48 57 80 63 S126 79 158 58 S205 52 230 57 S265 37 291 46 S337 54 354 27 S395 34 420 10 V100 H0Z" fill="url(#landingArea)" /><path d="M0 76 C36 76 48 57 80 63 S126 79 158 58 S205 52 230 57 S265 37 291 46 S337 54 354 27 S395 34 420 10" fill="none" stroke="#6bd58f" strokeWidth="2.5" strokeLinecap="round" /><circle cx="420" cy="10" r="4" fill="#9aefb2" /></svg></div>
            <div className="mt-3 flex justify-between border-t border-[#ffffff0c] pt-4 text-[.66rem] text-[#778d7e]"><span>Start of month</span><span>Today</span><span>Day 30</span></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="soft-panel rounded-2xl p-4"><div className="flex items-center gap-2 text-xs text-[#9aac9d]"><ArrowDownLeft size={14} className="text-[#7bd696]" />Daily pace</div><p className="mt-2 font-data text-lg font-semibold text-[#e0eee3]">₹333 <span className="text-xs font-normal text-[#829789]">/ day</span></p></div>
            <div className="soft-panel rounded-2xl p-4"><div className="flex items-center gap-2 text-xs text-[#9aac9d]"><Target size={14} className="text-[#a6d8a8]" />Goal in view</div><p className="mt-2 font-data text-lg font-semibold text-[#e0eee3]">Your pace</p></div>
          </div>
          <div className="mt-4 flex gap-3 rounded-2xl border border-[#ffffff0b] bg-[#17281d] p-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#28513a] text-[#91dfa7]"><Sparkles size={15} /></span><div><p className="text-xs font-semibold text-[#cfe4d2]">A calmer way to decide</p><p className="mt-1 text-[.7rem] leading-5 text-[#8da191]">See what changes when you adjust the plan. Nothing moves until you choose.</p></div></div>
        </div>
        <div className="absolute -bottom-5 -left-5 hidden rounded-2xl border border-[#42684a]/40 bg-[#14251a]/95 p-3 shadow-2xl sm:flex sm:items-center sm:gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#24432d] text-[#7ed797]"><Activity size={17} /></span><span><span className="block text-[.65rem] text-[#8fa192]">Small steps count</span><span className="block text-xs font-semibold text-[#d7e8da]">Build your own rhythm</span></span></div>
      </div>
    </section>
    <section id="how-it-works" className="border-y border-[#263a2d] bg-[#101d15] px-5 py-20 sm:px-10 md:py-24 lg:px-14" data-testid="section-how-it-works">
      <div className="mx-auto max-w-[1160px]">
        <div className="grid gap-8 md:grid-cols-[.82fr_1.18fr] md:items-end"><div><p className="eyebrow">A gentler money routine</p><h2 className="mt-4 max-w-[420px] font-display text-4xl font-semibold leading-tight tracking-[-.055em] text-[#eef6ef] sm:text-5xl">Know where you stand. Decide what comes next.</h2></div><p className="max-w-[490px] text-[.95rem] leading-7 text-[#9fb1a2]">Start with the plan you already have. Add the costs you expect, then make space for the things you care about. FINSync is for thinking through money, not moving it.</p></div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[{n:'01',title:'Set your starting point',desc:'Add the amount you want to plan with and how long it needs to last. Your month becomes a clear, personal picture.'},{n:'02',title:'Make room for real life',desc:'List bills, everyday spending, subscriptions and savings goals in language that makes sense to you.'},{n:'03',title:'Try a different path',desc:'Preview a purchase or a change in plans. Compare the estimate, then save or apply only if you choose.'}].map((item) => <article key={item.n} className="panel rounded-[22px] p-6 sm:p-7" data-testid={`card-how-${item.n}`}><p className="font-data text-xs text-[#72ce8d]">{item.n} <span className="ml-2 text-[#526d5a]">/ 03</span></p><h3 className="mt-6 font-display text-xl font-semibold tracking-[-.03em] text-[#e2eee4]">{item.title}</h3><p className="mt-3 text-sm leading-6 text-[#92a595]">{item.desc}</p></article>)}
        </div>
      </div>
    </section>
    <section id="built-for-real-life" className="mx-auto grid max-w-[1160px] gap-10 px-5 py-20 sm:px-10 md:grid-cols-2 md:items-center md:py-28 lg:px-0">
      <div className="relative overflow-hidden rounded-[28px] border border-[#385540] bg-[#14271a] p-7 sm:p-9" data-testid="card-landing-challenge">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#287447]/20 blur-[60px]" />
        <p className="eyebrow relative">A challenge, not a test</p><p className="relative mt-7 font-display text-5xl font-semibold tracking-[-.07em] text-[#f0f6f0]">₹10,000<span className="ml-2 text-2xl text-[#8aba91]">/ 30 days</span></p>
        <div className="relative mt-8 flex items-center gap-2">{Array.from({length: 10}, (_, index) => <span key={index} className={`h-1.5 flex-1 rounded-full ${index < 7 ? 'bg-[#68cf8b]' : 'bg-[#2b4933]'}`} />)}</div>
        <p className="relative mt-3 text-xs text-[#8fa493]">A starting point you can adjust to fit your life.</p>
        <div className="relative mt-8 flex items-center justify-between border-t border-[#ffffff0e] pt-5"><span className="text-xs text-[#91a394]">One day at a time</span><span className="inline-flex items-center gap-2 text-xs font-semibold text-[#a9ddb3]"><Activity size={14} />Plan at your pace</span></div>
      </div>
      <div><p className="eyebrow">Built for student life and first paychecks</p><h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-[-.055em] text-[#edf5ee] sm:text-5xl">Money plans should leave room for being human.</h2><p className="mt-5 max-w-[520px] text-[.95rem] leading-7 text-[#9fb1a2]">An unexpected ride home. A friend’s birthday. A goal that matters more than another delivery. See how the pieces fit without judging yourself for the choices you make.</p><Link href="/sign-up" data-testid="link-real-life-start" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#80d89a] hover:text-[#a6e9b5]">Build a plan that feels like yours <ArrowRight size={15} /></Link></div>
    </section>
    <section id="privacy" className="border-y border-[#263a2d] bg-[#101d15] px-5 py-16 sm:px-10 md:py-20 lg:px-14" data-testid="section-privacy">
      <div className="mx-auto flex max-w-[1160px] flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-[630px]"><p className="eyebrow">Honest by design</p><h2 className="mt-4 font-display text-3xl font-semibold tracking-[-.05em] text-[#edf5ee] sm:text-4xl">Your money stays simulated. Your choices stay yours.</h2><p className="mt-4 text-sm leading-6 text-[#9aada0]">FINSync uses the details you enter to create estimates. It does not connect to a bank, initiate payments, or guarantee an outcome. Treat every projection as a planning aid, not a promise.</p></div>
        <div className="grid max-w-[380px] grid-cols-2 gap-3">
          <div className="soft-panel rounded-2xl p-4"><ShieldCheck size={18} className="text-[#82d699]" /><p className="mt-3 text-xs font-semibold text-[#d5e6d8]">No bank login</p><p className="mt-1 text-[.68rem] leading-5 text-[#8da091]">Your credentials are never requested.</p></div>
          <div className="soft-panel rounded-2xl p-4"><CircleHelp size={18} className="text-[#82d699]" /><p className="mt-3 text-xs font-semibold text-[#d5e6d8]">Estimates only</p><p className="mt-1 text-[.68rem] leading-5 text-[#8da091]">Projections can differ from real life.</p></div>
        </div>
      </div>
    </section>
    <section className="px-5 py-20 text-center sm:px-10 md:py-28" data-testid="section-landing-cta"><p className="eyebrow">Take the next small step</p><h2 className="mx-auto mt-4 max-w-[700px] font-display text-4xl font-semibold tracking-[-.06em] text-[#edf5ee] sm:text-6xl">A clearer month starts with one number.</h2><p className="mx-auto mt-5 max-w-[480px] text-sm leading-6 text-[#9aada0]">Bring your own plan. Change it whenever life changes. See what feels possible.</p><Link href="/sign-up" data-testid="button-bottom-start" className="mt-8 inline-flex items-center rounded-xl bg-[#69d18e] px-5 py-3.5 text-sm font-bold text-[#102016] hover:bg-[#85e4a5]">Start your challenge <ArrowRight size={15} className="ml-2" /></Link></section>
    <footer className="border-t border-[#263a2d] px-5 py-6 text-center text-xs leading-5 text-[#778b7d]" data-testid="footer-landing">FINSync helps you plan with estimates. It does not connect to your bank or move money. <span className="mx-2 text-[#3e5b47]">·</span> Made for thoughtful everyday decisions.</footer>
  </div>;
}
