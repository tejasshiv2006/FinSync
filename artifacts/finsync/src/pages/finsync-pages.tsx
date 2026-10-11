import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  getGetDashboardQueryKey, getGetProfileQueryKey, getListBudgetCategoriesQueryKey, getListCommitmentsQueryKey,
  getListNotificationsQueryKey, getListSavingsGoalsQueryKey, getListScenariosQueryKey,
  getListSubscriptionsQueryKey, getListTransactionsQueryKey, getExportFinancialDataQueryKey,
  useApplyScenario, useCreateBudgetCategory, useCreateCommitment, useCreateSavingsContribution,
  useCreateSavingsGoal, useCreateSubscription, useCreateTransaction, useDeleteBudgetCategory,
  useDeleteScenario, useDeleteTransaction, useExportFinancialData, useGetDashboard, useGetProfile,
  useListBudgetCategories, useListCommitments, useListNotifications, useListSavingsGoals,
  useListScenarios, useListSubscriptions, useListTransactions, useMarkNotificationRead,
  usePayCommitment, useSaveScenario, useSimulateScenario, useUpdateBudgetCategory,
  useUpdateCommitment, useUpdateProfile, useUpdateSavingsGoal, useUpdateScenario,
  useUpdateSubscription, useUpdateTransaction,
  type BudgetCategory, type Commitment, type FinancialSnapshot, type Scenario, type ScenarioInput, type Transaction,
} from '@workspace/api-client-react';
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check, CheckCircle2,
  ChevronRight, CircleAlert, CreditCard, Download, FileDown, HeartPulse, Info, Lightbulb, LoaderCircle,
  Plus, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Sparkles, Target, Trash2, Wallet, X,
} from 'lucide-react';

const rupees = (paise: number | null | undefined) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0,
}).format((paise ?? 0) / 100);
const rupeesToPaise = (value: FormDataEntryValue | null) => Math.round(Number(value ?? 0) * 100);
const today = () => new Date().toISOString().slice(0, 10);
const niceDate = (date?: string | null) => date ? new Date(`${date.slice(0,10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date set';
const pct = (value: number) => `${Math.max(0, Math.min(100, value)).toFixed(0)}%`;

function ScreenHeader({ kicker, title, subtitle, action }: { kicker: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end" data-testid="section-page-header">
    <div><p className="eyebrow" data-testid="text-page-kicker">{kicker}</p><h1 className="mt-2 font-display text-[2rem] font-semibold leading-tight tracking-[-.055em] text-[#edf5ee] sm:text-[2.5rem]" data-testid="text-page-title">{title}</h1><p className="mt-2 max-w-[660px] text-sm leading-6 text-[#99ad9e]" data-testid="text-page-subtitle">{subtitle}</p></div>
    {action}
  </div>;
}
function Button({ children, onClick, testId, variant = 'primary', type = 'button', disabled = false }: { children: ReactNode; onClick?: () => void; testId: string; variant?: 'primary' | 'quiet' | 'danger'; type?: 'button' | 'submit'; disabled?: boolean }) {
  const color = variant === 'primary' ? 'bg-[#69d18e] text-[#0e2015] hover:bg-[#83dfa0]' : variant === 'danger' ? 'border border-rose-400/20 bg-rose-400/10 text-rose-200 hover:bg-rose-400/15' : 'border border-[#344c3b] bg-[#19291f] text-[#c1d2c5] hover:bg-[#203428]';
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${color}`}>{children}</button>;
}
function Surface({ children, className = '', testId }: { children: ReactNode; className?: string; testId: string }) {
  return <section className={`panel rounded-[22px] ${className}`} data-testid={testId}>{children}</section>;
}
function Feedback({ message, kind = 'success', onDismiss }: { message: string; kind?: 'success' | 'error' | 'info'; onDismiss?: () => void }) {
  const colors = kind === 'error' ? 'border-rose-300/20 bg-rose-950/30 text-rose-200' : kind === 'info' ? 'border-emerald-200/15 bg-emerald-950/20 text-emerald-100' : 'border-emerald-200/20 bg-emerald-950/30 text-emerald-100';
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${colors}`} data-testid={`status-${kind}`}>{kind === 'error' ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}<span className="flex-1">{message}</span>{onDismiss && <button onClick={onDismiss} data-testid="button-dismiss-feedback" aria-label="Dismiss message"><X size={14} /></button>}</div>;
}
function LoadingBlock({ label = 'Loading your information' }: { label?: string }) {
  return <div className="panel rounded-[22px] p-6" role="status" data-testid="state-loading"><div className="mb-5 h-3 w-36 animate-pulse rounded bg-[#294333]" /><div className="h-8 w-56 animate-pulse rounded-lg bg-[#294333]" /><div className="mt-5 h-24 animate-pulse rounded-2xl bg-[#1b3022]" /><span className="sr-only">{label}</span></div>;
}
function StateError({ message = 'We could not load this just now.', retry }: { message?: string; retry: () => void }) {
  return <div className="rounded-[22px] border border-rose-300/15 bg-rose-950/15 p-7 text-center" data-testid="state-error"><CircleAlert className="mx-auto text-rose-300" size={23} /><p className="mt-3 text-sm font-semibold text-[#f0dedb]">{message}</p><Button onClick={retry} testId="button-retry" variant="quiet"><RefreshCw size={14} />Try again</Button></div>;
}
function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-[#385341] bg-[#15241a]/50 px-6 py-10 text-center" data-testid="state-empty"><div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#25432e] text-[#89d99d]"><Sparkles size={19} /></div><h3 className="mt-4 font-display text-base font-semibold text-[#dceadd]" data-testid="text-empty-title">{title}</h3><p className="mx-auto mt-2 max-w-[360px] text-sm leading-6 text-[#8fa293]" data-testid="text-empty-description">{body}</p>{action && <div className="mt-5">{action}</div>}</div>;
}
function Modal({ title, description, children, onClose, onSubmit, submitLabel = 'Save', pending = false, testId = 'dialog-form' }: { title: string; description: string; children: ReactNode; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; submitLabel?: string; pending?: boolean; testId?: string }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form onSubmit={onSubmit} className="max-h-[90dvh] w-full overflow-auto rounded-t-[26px] border border-[#365140] bg-[#122219] p-5 shadow-2xl sm:max-w-[530px] sm:rounded-[26px] sm:p-7" role="dialog" aria-modal="true" aria-label={title} data-testid={testId}>
      <div className="mb-6 flex items-start justify-between gap-4"><div><p className="eyebrow">Your plan, your call</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-.04em] text-[#ecf5ed]">{title}</h2><p className="mt-2 text-sm leading-5 text-[#92a698]">{description}</p></div><button type="button" onClick={onClose} data-testid="button-close-dialog" aria-label="Close dialog" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#35503e] text-[#aebfb1] hover:bg-[#213628]"><X size={16} /></button></div>
      <div className="space-y-4">{children}</div>
      <div className="mt-7 flex justify-end gap-2"><Button onClick={onClose} testId="button-cancel-dialog" variant="quiet">Cancel</Button><Button type="submit" testId="button-submit-form" disabled={pending}>{pending && <LoaderCircle size={15} className="animate-spin" />}{submitLabel}</Button></div>
    </form>
  </div>;
}
function Field({ label, name, defaultValue, type = 'text', required = true, min, max, step, placeholder }: { label: string; name: string; defaultValue?: string | number; type?: string; required?: boolean; min?: string | number; max?: string | number; step?: string | number; placeholder?: string }) {
  return <label className="block text-xs font-medium text-[#b7c9ba]" data-testid={`label-${name}`}>{label}<input name={name} type={type} defaultValue={defaultValue} required={required} min={min} max={max} step={step} placeholder={placeholder} data-testid={`input-${name}`} className="mt-2 h-11 w-full rounded-xl border border-[#36503e] bg-[#0e1c13] px-3.5 text-sm text-[#e9f2ea] outline-none transition placeholder:text-[#6f8375] focus:border-[#69d18e] focus:ring-2 focus:ring-[#69d18e]/15" /></label>;
}
function SelectField({ label, name, options, defaultValue, required = false, onChange }: { label: string; name: string; options: Array<[string, string]>; defaultValue?: string; required?: boolean; onChange?: (value: string) => void }) {
  return <label className="block text-xs font-medium text-[#b7c9ba]" data-testid={`label-${name}`}>{label}<select name={name} required={required} onChange={onChange ? (event) => onChange(event.target.value) : undefined} defaultValue={defaultValue ?? options[0]?.[0]} data-testid={`select-${name}`} className="mt-2 h-11 w-full rounded-xl border border-[#36503e] bg-[#0e1c13] px-3.5 text-sm text-[#e9f2ea] outline-none focus:border-[#69d18e]">{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
}
function CheckField({ label, name, defaultChecked = false }: { label: string; name: string; defaultChecked?: boolean }) {
  return <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[#304839] bg-[#17281d] px-3.5 text-sm text-[#c5d5c8]" data-testid={`label-${name}`}><input name={name} type="checkbox" defaultChecked={defaultChecked} data-testid={`input-${name}`} className="h-4 w-4 accent-[#69d18e]" />{label}</label>;
}
const getForm = (event: FormEvent<HTMLFormElement>) => new FormData(event.currentTarget);
const isChecked = (data: FormData, name: string) => data.get(name) === 'on';
function PageMessage({ message, setMessage }: { message: { text: string; kind: 'success' | 'error' } | null; setMessage: (value: null) => void }) {
  return message ? <Feedback message={message.text} kind={message.kind} onDismiss={() => setMessage(null)} /> : null;
}
function ProgressBar({ percent, tone = 'green', testId }: { percent: number; tone?: 'green' | 'amber' | 'red'; testId: string }) {
  return <div className="h-2 overflow-hidden rounded-full bg-[#26392b]" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} data-testid={testId}><div className={`h-full rounded-full transition-[width] duration-500 ${tone === 'green' ? 'bg-[#6bd28e]' : tone === 'amber' ? 'bg-[#dbb76c]' : 'bg-[#dc776d]'}`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div>;
}
function InfoNote({ children, testId = 'note-estimate' }: { children: ReactNode; testId?: string }) {
  return <div className="flex gap-2 rounded-xl border border-[#36503e] bg-[#17281d] px-3.5 py-3 text-xs leading-5 text-[#9caf9f]" data-testid={testId}><Info size={15} className="mt-0.5 shrink-0 text-[#84ce93]" />{children}</div>;
}
function PageTopAction({ children, onClick, testId }: { children: ReactNode; onClick: () => void; testId: string }) {
  return <Button onClick={onClick} testId={testId}><Plus size={16} />{children}</Button>;
}

export function DashboardPage() {
  const query = useGetDashboard();
  const profileQuery = useGetProfile();
  const data = query.data;
  if (query.isLoading || profileQuery.isLoading) return <><ScreenHeader kicker="Your overview" title="A clear view of your month" subtitle="Your own numbers, gathered in one calm place." /><LoadingBlock /></>;
  if (query.isError || profileQuery.isError || !data) return <><ScreenHeader kicker="Your overview" title="A clear view of your month" subtitle="Your own numbers, gathered in one calm place." /><StateError retry={() => { void query.refetch(); void profileQuery.refetch(); }} /></>;
  const snapshot = data.snapshot;
  const savingsTarget = data.savingsTargetPaise || data.profile.savingsGoalPaise;
  const savingsPct = savingsTarget > 0 ? Math.min(100, snapshot.savingsProgressPaise / savingsTarget * 100) : 0;
  const initial = data.profile.displayName?.trim().split(/\s+/)[0] || 'there';
  return <div className="enter" data-testid="page-dashboard">
    <ScreenHeader kicker="Your overview" title={`Good to see you, ${initial}.`} subtitle={`Day ${Math.max(1, data.profile.challengeDurationDays - data.daysRemaining)} of your ${data.profile.challengeDurationDays}-day plan. No perfect month required.`}
      action={<div className="rounded-xl border border-[#3b5742] bg-[#17291d] px-4 py-2.5 text-xs text-[#a8bbab]" data-testid="status-challenge-days"><CalendarDays size={14} className="mr-2 inline text-[#86d499]" />{data.daysRemaining} days to go</div>} />
    {!data.profile.onboardingCompleted && <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#59865e]/30 bg-[#183420]/60 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="notice-onboarding"><div><p className="text-sm font-semibold text-[#d7edd9]">Make this plan yours</p><p className="mt-1 text-xs text-[#9cb49f]">A few details in settings will help shape your personal challenge.</p></div><Link href="/settings" data-testid="link-complete-profile" className="text-sm font-semibold text-[#89dda0]">Set up your plan <ArrowRight size={14} className="ml-1 inline" /></Link></div>}
    <div className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
      <Surface testId="card-balance-overview" className="relative overflow-hidden p-6 sm:p-8">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#267b46]/12 blur-[65px]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Money left in your plan</p><p className="mt-3 font-display text-[2.8rem] font-semibold tracking-[-.07em] text-[#edf6ee] sm:text-[3.5rem]" data-testid="value-current-balance">{rupees(snapshot.currentBalancePaise)}</p><p className="mt-1 text-sm text-[#95aa99]">Current estimated balance</p></div><div className="rounded-2xl border border-[#45815a]/25 bg-[#1c3a26]/60 p-3.5"><Wallet size={23} className="text-[#8ce0a2]" /></div></div>
        <div className="relative mt-7 grid grid-cols-2 gap-3 border-t border-[#ffffff0c] pt-5 sm:grid-cols-3"><Metric label="Spendable balance" amount={rupees(snapshot.spendableBalancePaise)} note="After planned costs" testId="metric-spendable" /><Metric label="Daily allowance" amount={rupees(snapshot.dailyAllowancePaise)} note="A steady daily pace" testId="metric-daily" /><div className="col-span-2 sm:col-span-1"><Metric label="Projected month end" amount={rupees(snapshot.projectedMonthEndBalancePaise)} note="An estimate, not a promise" testId="metric-projection" /></div></div>
      </Surface>
      <Surface testId="card-financial-health" className="p-6 sm:p-7">
        <div className="flex items-center justify-between"><div><p className="eyebrow">Plan check-in</p><h2 className="mt-1 font-display text-lg font-semibold text-[#e1eee3]">How things look</h2></div><HeartPulse size={20} className="text-[#8ad79c]" /></div>
        <div className="mt-5 flex items-baseline justify-between"><span className="text-sm text-[#9caf9f]">Plan health</span><span className="font-data text-2xl font-semibold text-[#e1eee3]" data-testid="value-health-score">{snapshot.healthScore}<span className="text-xs text-[#829586]"> / 100</span></span></div>
        <ProgressBar percent={snapshot.healthScore} tone={snapshot.healthScore < 40 ? 'red' : snapshot.healthScore < 70 ? 'amber' : 'green'} testId="progress-health" />
        <div className="mt-4 flex items-center justify-between text-xs text-[#8fa192]"><span>Current risk</span><span className={`rounded-full px-2.5 py-1 font-semibold capitalize ${snapshot.risk === 'low' ? 'bg-[#20402a] text-[#a2e2ad]' : snapshot.risk === 'moderate' ? 'bg-[#463c24] text-[#e7d293]' : 'bg-[#482b27] text-[#f0a49a]'}`} data-testid="status-risk">{snapshot.risk}</span></div>
        <p className="mt-4 text-xs leading-5 text-[#91a395]">Based on the plan details you entered. This is a planning signal, not financial advice.</p>
        <Link href="/insights" data-testid="link-health-details" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#83d999]">Understand this view <ChevronRight size={14} /></Link>
      </Surface>
    </div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <Surface testId="card-month-forecast" className="p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">The month ahead</p><h2 className="mt-1 font-display text-lg font-semibold text-[#e3eee5]">Estimated balance path</h2></div><span className="rounded-full border border-[#385240] px-2.5 py-1 text-[.68rem] text-[#94a997]">{data.forecast.length} forecast points</span></div>
        {data.forecast.length > 1 ? <ForecastChart values={data.forecast.map((point) => point.balancePaise)} labels={data.forecast.map((point) => point.label)} /> : <EmptyState title="Your forecast will take shape" body="As you add real plan details, an estimated balance path will appear here." />}
        <div className="mt-4 flex items-center justify-between border-t border-[#ffffff0c] pt-4 text-xs text-[#829587]"><span>Uses the details in your plan</span><span>Estimates can change</span></div>
      </Surface>
      <Surface testId="card-savings-progress" className="p-6 sm:p-7">
        <div className="flex items-start justify-between"><div><p className="eyebrow">Savings, your way</p><h2 className="mt-1 font-display text-lg font-semibold text-[#e3eee5]">A goal in progress</h2></div><Target size={20} className="text-[#9bd6a4]" /></div>
        {savingsTarget > 0 ? <><div className="mt-6 flex items-end justify-between gap-3"><div><p className="font-data text-2xl font-semibold text-[#e8f2e9]" data-testid="value-savings-progress">{rupees(snapshot.savingsProgressPaise)}</p><p className="mt-1 text-xs text-[#92a597]">of {rupees(savingsTarget)}</p></div><span className="font-data text-sm text-[#90dba2]">{pct(savingsPct)}</span></div><div className="mt-4"><ProgressBar percent={savingsPct} testId="progress-savings" /></div></> : <div className="mt-5"><EmptyState title="Choose something to save for" body="Add a goal when you know what you want to make room for." /></div>}
        <Link href="/savings" data-testid="link-dashboard-savings" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-[#83d999]">View savings goals <ChevronRight size={14} /></Link>
      </Surface>
    </div>
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <Surface testId="card-upcoming-commitments" className="p-6 sm:p-7"><div className="flex items-center justify-between"><div><p className="eyebrow">Coming up</p><h2 className="mt-1 font-display text-lg font-semibold text-[#e3eee5]">Planned commitments</h2></div><Link href="/commitments" data-testid="link-all-commitments" className="text-xs font-semibold text-[#83d999]">See all</Link></div>
        {data.upcomingCommitments.length === 0 ? <div className="mt-5"><EmptyState title="Nothing planned just yet" body="Add recurring or one-time obligations when you know about them." /></div> : <div className="mt-4 divide-y divide-[#ffffff0b]">{data.upcomingCommitments.slice(0,4).map((item) => <div className="flex items-center justify-between gap-4 py-3" key={item.id} data-testid={`row-upcoming-commitment-${item.id}`}><div><p className="text-sm font-medium text-[#d5e4d7]">{item.name}</p><p className="mt-1 text-xs text-[#829587]">{niceDate(item.dueDate)} · {item.category}</p></div><span className="font-data text-sm text-[#dfeae0]">{rupees(item.amountPaise)}</span></div>)}</div>}
      </Surface>
      <Surface testId="card-recent-transactions" className="p-6 sm:p-7"><div className="flex items-center justify-between"><div><p className="eyebrow">Recent activity</p><h2 className="mt-1 font-display text-lg font-semibold text-[#e3eee5]">Your latest entries</h2></div><Link href="/transactions" data-testid="link-all-transactions" className="text-xs font-semibold text-[#83d999]">See all</Link></div>
        {data.recentTransactions.length === 0 ? <div className="mt-5"><EmptyState title="Your first entry starts here" body="Record income or spending to make this overview yours." /></div> : <div className="mt-4 divide-y divide-[#ffffff0b]">{data.recentTransactions.slice(0,5).map((tx) => <TransactionRow key={tx.id} transaction={tx} compact />)}</div>}
      </Surface>
    </div>
    {data.insights.length > 0 && <Surface testId="card-dashboard-notes" className="mt-4 p-6 sm:p-7"><div className="flex items-center gap-2"><Lightbulb size={16} className="text-[#9bd59c]" /><p className="eyebrow">A few things to notice</p></div><div className="mt-4 grid gap-3 md:grid-cols-2">{data.insights.slice(0,4).map((insight, index) => <p key={index} className="rounded-xl bg-[#17291e] px-4 py-3 text-sm leading-6 text-[#b7c9b9]" data-testid={`text-insight-${index}`}>{insight}</p>)}</div></Surface>}
  </div>;
}
function Metric({ label, amount, note, testId }: { label: string; amount: string; note: string; testId: string }) {
  return <div data-testid={testId}><p className="text-xs text-[#8da193]">{label}</p><p className="mt-2 font-data text-xl font-medium text-[#e0ece2]">{amount}</p><p className="mt-1 text-[.68rem] text-[#758a7a]">{note}</p></div>;
}
function ForecastChart({ values, labels }: { values: number[]; labels: string[] }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${84 - ((value - min) / range) * 68}`).join(' ');
  return <div className="mt-6" data-testid="chart-forecast"><div className="flex h-40 items-stretch"><div className="flex flex-col justify-between pr-3 py-1 text-[.61rem] text-[#718676]"><span>{rupees(max)}</span><span>{rupees(min)}</span></div><svg className="h-full flex-1 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Estimated balance trend"><defs><linearGradient id="balanceFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#66d18d" stopOpacity=".2" /><stop offset="1" stopColor="#66d18d" stopOpacity="0" /></linearGradient></defs><path d={`M ${points.replaceAll(' ', ' L ')} L 100,100 L 0,100 Z`} fill="url(#balanceFill)" /><polyline points={points} fill="none" stroke="#70d795" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />{values.map((value, index) => index === values.length - 1 || index === 0 ? <circle key={index} cx={(index/(values.length-1))*100} cy={84 - ((value-min)/range)*68} r="1.9" fill="#a4ecb7" /> : null)}</svg></div><div className="ml-[52px] mt-3 flex justify-between text-[.62rem] text-[#718676]"><span>{labels[0]}</span><span>{labels[Math.floor((labels.length-1)/2)]}</span><span>{labels[labels.length-1]}</span></div></div>;
}
function TransactionRow({ transaction, compact = false, actions }: { transaction: Transaction; compact?: boolean; actions?: ReactNode }) {
  const incoming = ['income', 'refund'].includes(transaction.type);
  return <div className="flex items-center gap-3 py-3" data-testid={`row-transaction-${transaction.id}`}>
    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${incoming ? 'bg-[#1c3c28] text-[#83d79a]' : 'bg-[#26362b] text-[#b0c2b4]'}`}>{incoming ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</div>
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[#d8e5da]" data-testid={`text-transaction-description-${transaction.id}`}>{transaction.description || transaction.category}</p><p className="mt-1 text-[.68rem] text-[#829587]">{transaction.category}{!compact && ` · ${niceDate(transaction.transactionDate)}`}{transaction.isEssential && ' · Essential'}</p></div>
    <span className={`shrink-0 font-data text-sm ${incoming ? 'text-[#8edaa0]' : 'text-[#dce8de]'}`} data-testid={`value-transaction-${transaction.id}`}>{incoming ? '+' : '−'}{rupees(transaction.amountPaise)}</span>{actions}
  </div>;
}

export function TransactionsPage() {
  const client = useQueryClient();
  const query = useListTransactions();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();
  const [dialog, setDialog] = useState<Transaction | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [notice, setNotice] = useState<{text:string;kind:'success'|'error'}|null>(null);
  const rows = (query.data ?? []).filter((tx) => (kind === 'all' || tx.type === kind) && `${tx.description} ${tx.category}`.toLowerCase().includes(search.toLowerCase()));
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    void client.invalidateQueries({ queryKey: getListBudgetCategoriesQueryKey() });
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = getForm(event);
    const body = {
      type: String(data.get('type')) as 'expense' | 'income' | 'refund' | 'adjustment',
      amountPaise: rupeesToPaise(data.get('amount')),
      category: String(data.get('category')).trim(),
      description: String(data.get('description') ?? '').trim(),
      transactionDate: String(data.get('date')),
      isEssential: isChecked(data, 'essential'),
    };
    const callbacks = { onSuccess: () => { invalidate(); setDialog(null); setNotice({ text: 'Your entry has been saved.', kind: 'success' }); }, onError: () => setNotice({ text: 'This entry could not be saved. Check the details and try again.', kind: 'error' }) };
    if (dialog && dialog !== 'new') update.mutate({ id: dialog.id, data: body }, callbacks);
    else create.mutate({ data: body }, callbacks);
  };
  const deleteRecord = () => {
    if (!deleting) return;
    remove.mutate({ id: deleting.id }, { onSuccess: () => { invalidate(); setDeleting(null); setNotice({ text: 'Entry removed from your records.', kind: 'success' }); }, onError: () => setNotice({ text: 'This entry could not be removed.', kind: 'error' }) });
  };
  return <div className="enter" data-testid="page-transactions">
    <ScreenHeader kicker="Everyday money" title="Transactions" subtitle="Keep track of the entries that make your month feel real." action={<PageTopAction onClick={() => setDialog('new')} testId="button-add-transaction">Add an entry</PageTopAction>} />
    <PageMessage message={notice} setMessage={setNotice} />
    <Surface testId="card-transactions" className="p-5 sm:p-7">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-[310px]"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#778d7d]" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your entries" data-testid="input-search-transactions" className="h-10 w-full rounded-xl border border-[#344c3b] bg-[#101e15] pl-9 pr-3 text-sm text-[#e4eee5] outline-none placeholder:text-[#748979] focus:border-[#69d18e]" /></div>
        <div className="flex flex-wrap gap-2" data-testid="filters-transaction-type">{[['all','Everything'],['expense','Spending'],['income','Income'],['refund','Refunds'],['adjustment','Adjustments']].map(([value,label]) => <button key={value} onClick={() => setKind(value)} data-testid={`filter-transaction-${value}`} className={`rounded-full px-3 py-1.5 text-xs font-medium ${kind===value?'bg-[#285238] text-[#a5e5b4]':'border border-[#334b3a] text-[#91a495] hover:bg-[#203327]'}`}>{label}</button>)}</div>
      </div>
      {query.isLoading ? <LoadingBlock label="Loading your transactions" /> : query.isError ? <StateError retry={() => void query.refetch()} /> : rows.length === 0 ? <EmptyState title={search || kind !== 'all' ? 'No entries match that view' : 'Nothing on the list yet'} body={search || kind !== 'all' ? 'Try another search or clear the type filter.' : 'Add your first expense or income entry. You can edit or remove it later.'} action={search || kind !== 'all' ? <Button onClick={() => { setSearch(''); setKind('all'); }} testId="button-clear-transaction-filters" variant="quiet">Clear filters</Button> : <Button onClick={() => setDialog('new')} testId="button-empty-add-transaction"><Plus size={15} />Add an entry</Button>} /> : <div className="divide-y divide-[#ffffff0b]">{rows.map((tx) => <TransactionRow key={tx.id} transaction={tx} actions={<div className="flex items-center gap-1"><button onClick={() => setDialog(tx)} data-testid={`button-edit-transaction-${tx.id}`} className="rounded-lg px-2 py-1.5 text-xs text-[#95b99d] hover:bg-[#243b2a]">Edit</button><button onClick={() => setDeleting(tx)} data-testid={`button-delete-transaction-${tx.id}`} aria-label={`Delete ${tx.description || tx.category}`} className="rounded-lg p-2 text-[#829487] hover:bg-rose-950/40 hover:text-rose-200"><Trash2 size={14} /></button></div>} />)}</div>}
      {!query.isLoading && !query.isError && rows.length > 0 && <p className="mt-4 border-t border-[#ffffff0c] pt-4 text-xs text-[#819486]" data-testid="text-transaction-count">{rows.length} {rows.length === 1 ? 'entry' : 'entries'} shown · Amounts are entered by you</p>}
    </Surface>
    {dialog && <Modal title={dialog === 'new' ? 'Add an entry' : 'Edit this entry'} description="Record a change to your plan. Amounts are simulated and do not move money." onClose={() => setDialog(null)} onSubmit={submit} pending={create.isPending || update.isPending} submitLabel={dialog === 'new' ? 'Save entry' : 'Update entry'}>
      <SelectField name="type" label="Type" defaultValue={dialog === 'new' ? 'expense' : dialog.type} options={ [['expense','Spending'],['income','Income'],['refund','Refund'],['adjustment','Adjustment']] } />
      <Field name="amount" label="Amount in rupees" type="number" min="0.01" step="0.01" defaultValue={dialog === 'new' ? '' : (dialog.amountPaise/100).toFixed(2)} placeholder="For example, 240" />
      <Field name="category" label="Category" defaultValue={dialog === 'new' ? '' : dialog.category} placeholder="Food, travel, rent…" />
      <Field name="description" label="Short note" required={false} defaultValue={dialog === 'new' ? '' : dialog.description} placeholder="What was this for?" />
      <Field name="date" label="Date" type="date" defaultValue={dialog === 'new' ? today() : dialog.transactionDate} />
      <CheckField name="essential" label="This was essential" defaultChecked={dialog !== 'new' && dialog.isEssential} />
    </Modal>}
    {deleting && <Modal title="Remove this entry?" description={`${deleting.description || deleting.category} · ${rupees(deleting.amountPaise)}. This action cannot be undone.`} onClose={() => setDeleting(null)} onSubmit={(event) => { event.preventDefault(); deleteRecord(); }} pending={remove.isPending} submitLabel="Remove entry" testId="dialog-confirm-delete"><p className="rounded-xl border border-rose-300/15 bg-rose-950/20 p-3 text-xs text-rose-100">Removing this entry updates your estimated plan totals.</p></Modal>}
  </div>;
}

export function BudgetPage() {
  const client = useQueryClient();
  const query = useListBudgetCategories();
  const create = useCreateBudgetCategory();
  const update = useUpdateBudgetCategory();
  const remove = useDeleteBudgetCategory();
  const [dialog,setDialog] = useState<BudgetCategory|'new'|null>(null);
  const [deleting,setDeleting] = useState<BudgetCategory|null>(null);
  const [notice,setNotice] = useState<{text:string;kind:'success'|'error'}|null>(null);
  const invalidate = () => { void client.invalidateQueries({queryKey:getListBudgetCategoriesQueryKey()}); void client.invalidateQueries({queryKey:getGetDashboardQueryKey()}); };
  const submit = (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data=getForm(event);
    const body={name:String(data.get('name')).trim(),spendingLimitPaise:rupeesToPaise(data.get('limit')),isEssential:isChecked(data,'essential')};
    const callbacks={onSuccess:()=>{invalidate();setDialog(null);setNotice({text:'Your category plan is updated.',kind:'success'});},onError:()=>setNotice({text:'This category could not be saved. Please check its details.',kind:'error'})};
    if(dialog&&dialog!=='new')update.mutate({id:dialog.id,data:body},callbacks);else create.mutate({data:body},callbacks);
  };
  const totalLimit=(query.data??[]).reduce((sum,item)=>sum+item.spendingLimitPaise,0);
  const totalSpent=(query.data??[]).reduce((sum,item)=>sum+item.spentPaise,0);
  return <div className="enter" data-testid="page-budget">
    <ScreenHeader kicker="A little structure" title="Category budgets" subtitle="Give each part of your month a comfortable boundary. These are guide rails, not rules." action={<PageTopAction onClick={()=>setDialog('new')} testId="button-add-budget">Add a category</PageTopAction>} />
    <PageMessage message={notice} setMessage={setNotice} />
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><SummaryTile label="Planned across categories" value={rupees(totalLimit)} testId="summary-budget-limit" /><SummaryTile label="Entered spending" value={rupees(totalSpent)} testId="summary-budget-spent" /><SummaryTile label="Room in the plan" value={rupees(totalLimit-totalSpent)} testId="summary-budget-room" /></div>
    <Surface testId="card-budget-categories" className="p-5 sm:p-7"><div className="mb-5 flex items-center gap-2"><SlidersHorizontal size={16} className="text-[#8bd79c]" /><p className="text-sm font-semibold text-[#dce9de]">Your categories</p></div>
      {query.isLoading?<LoadingBlock label="Loading category budgets" />:query.isError?<StateError retry={()=>void query.refetch()} />:!query.data?.length?<EmptyState title="Start with one category" body="Choose a spending category and decide how much room to give it in this challenge." action={<Button onClick={()=>setDialog('new')} testId="button-empty-add-budget"><Plus size={15}/>Create a category</Button>} />:
        <div className="grid gap-3 md:grid-cols-2">{query.data.map((category)=>{const ratio=category.spendingLimitPaise?category.spentPaise/category.spendingLimitPaise*100:0;return <article key={category.id} className="soft-panel rounded-2xl p-4 sm:p-5" data-testid={`card-budget-category-${category.id}`}><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-[#dbe9dd]" data-testid={`text-budget-name-${category.id}`}>{category.name}</h3><p className="mt-1 text-xs text-[#879a8b]">{category.isEssential?'Essential':'Flexible'} spending</p></div><div className="flex gap-1"><button onClick={()=>setDialog(category)} data-testid={`button-edit-budget-${category.id}`} className="rounded-lg px-2 py-1 text-xs text-[#95b99d] hover:bg-[#243b2a]">Edit</button><button onClick={()=>setDeleting(category)} data-testid={`button-delete-budget-${category.id}`} aria-label={`Delete ${category.name}`} className="rounded-lg p-2 text-[#839487] hover:text-rose-200"><Trash2 size={14}/></button></div></div><div className="mt-5 flex items-baseline justify-between"><span className="font-data text-lg text-[#e3eee4]">{rupees(category.spentPaise)}<span className="text-xs text-[#7e9283]"> / {rupees(category.spendingLimitPaise)}</span></span><span className={`font-data text-xs ${ratio>100?'text-[#ee9c8e]':'text-[#a4bbab]'}`}>{pct(ratio)}</span></div><div className="mt-3"><ProgressBar percent={ratio} tone={ratio>100?'red':ratio>80?'amber':'green'} testId={`progress-budget-${category.id}`} /></div><p className="mt-3 text-[.68rem] text-[#809284]">{category.spendingLimitPaise>category.spentPaise?`${rupees(category.spendingLimitPaise-category.spentPaise)} left in this guide`:category.spendingLimitPaise===category.spentPaise?'At the planned limit':'Above your guide by '+rupees(category.spentPaise-category.spendingLimitPaise)}</p></article>;})}</div>}
      <InfoNote testId="note-budget-estimate">Category spending reflects entries in this plan. It is not a live view of a bank account.</InfoNote>
    </Surface>
    {dialog&&<Modal title={dialog==='new'?'Create a category':'Adjust this category'} description="Choose a name and a flexible spending guide for this month." onClose={()=>setDialog(null)} onSubmit={submit} pending={create.isPending||update.isPending} submitLabel={dialog==='new'?'Add category':'Save changes'}><Field name="name" label="Category name" defaultValue={dialog==='new'?'':dialog.name} placeholder="Food, transport, study…" /><Field name="limit" label="Planned amount in rupees" type="number" min="0" step="0.01" defaultValue={dialog==='new'?'':(dialog.spendingLimitPaise/100).toFixed(2)} /><CheckField name="essential" label="Usually essential" defaultChecked={dialog!=='new'&&dialog.isEssential}/></Modal>}
    {deleting&&<Modal title="Delete this category?" description={`"${deleting.name}" and its budget guide will be removed. Your transaction entries remain.`} onClose={()=>setDeleting(null)} onSubmit={(event)=>{event.preventDefault();remove.mutate({id:deleting.id},{onSuccess:()=>{invalidate();setDeleting(null);setNotice({text:'Category removed.',kind:'success'});},onError:()=>setNotice({text:'Category could not be removed.',kind:'error'})});}} pending={remove.isPending} submitLabel="Delete category" testId="dialog-confirm-category-delete"><p className="text-xs text-[#9aac9d]">This does not delete any transaction entries.</p></Modal>}
  </div>;
}
function SummaryTile({label,value,testId,subtext}:{label:string;value:string;testId:string;subtext?:string}) {
  return <div className="panel rounded-2xl p-4 sm:p-5" data-testid={testId}><p className="text-xs text-[#8fa394]">{label}</p><p className="mt-2 font-data text-xl font-semibold tracking-tight text-[#e4eee5]" data-testid={`${testId}-value`}>{value}</p>{subtext&&<p className="mt-1 text-xs text-[#758a7b]">{subtext}</p>}</div>;
}

export function SavingsPage() {
  const client=useQueryClient();
  const query=useListSavingsGoals();
  const create=useCreateSavingsGoal();
  const update=useUpdateSavingsGoal();
  const contribute=useCreateSavingsContribution();
  const [dialog,setDialog]=useState<{kind:'goal';goal?:{id:number;name:string;targetAmountPaise:number;targetDate?:string|null}|'new'}|{kind:'contribute';goalId:number;goalName:string}|null>(null);
  const [notice,setNotice]=useState<{text:string;kind:'success'|'error'}|null>(null);
  const invalidate=()=>{void client.invalidateQueries({queryKey:getListSavingsGoalsQueryKey()});void client.invalidateQueries({queryKey:getGetDashboardQueryKey()});};
  const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=getForm(event);
    if(dialog?.kind==='contribute'){contribute.mutate({id:dialog.goalId,data:{amountPaise:rupeesToPaise(form.get('amount')),contributionDate:String(form.get('date')),note:String(form.get('note')??'').trim()}},{onSuccess:()=>{invalidate();setDialog(null);setNotice({text:'Your contribution is part of the goal total now.',kind:'success'});},onError:()=>setNotice({text:'Contribution could not be added. Please review the amount.',kind:'error'})});return;}
    if(dialog?.kind==='goal'){const body={name:String(form.get('name')).trim(),targetAmountPaise:rupeesToPaise(form.get('target')),targetDate:String(form.get('date')??'')||null};const callbacks={onSuccess:()=>{invalidate();setDialog(null);setNotice({text:'Your savings goal is saved.',kind:'success'});},onError:()=>setNotice({text:'Goal could not be saved. Please check its details.',kind:'error'})};if(dialog.goal&&dialog.goal!=='new')update.mutate({id:dialog.goal.id,data:body},callbacks);else create.mutate({data:body},callbacks);}
  };
  const totalTarget=(query.data??[]).reduce((sum,goal)=>sum+goal.targetAmountPaise,0);
  const totalSaved=(query.data??[]).reduce((sum,goal)=>sum+goal.currentContributionPaise,0);
  return <div className="enter" data-testid="page-savings">
    <ScreenHeader kicker="Future you" title="Savings goals" subtitle="Give your next milestone a name, a number and a little regular attention." action={<PageTopAction onClick={()=>setDialog({kind:'goal',goal:'new'})} testId="button-add-savings-goal">Add a goal</PageTopAction>} />
    <PageMessage message={notice} setMessage={setNotice}/>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><SummaryTile label="Saved across goals" value={rupees(totalSaved)} testId="summary-savings-total"/><SummaryTile label="Across all targets" value={rupees(totalTarget)} testId="summary-savings-target"/><SummaryTile label="Still to go" value={rupees(Math.max(0,totalTarget-totalSaved))} testId="summary-savings-remaining"/></div>
    <Surface testId="card-savings-goals" className="p-5 sm:p-7"><div className="mb-5 flex items-center justify-between"><div><p className="eyebrow">Small, steady progress</p><h2 className="mt-1 font-display text-lg font-semibold text-[#e2eee4]">Your goals</h2></div><Target size={19} className="text-[#8fd79f]"/></div>
      {query.isLoading?<LoadingBlock label="Loading savings goals"/>:query.isError?<StateError retry={()=>void query.refetch()}/>:!query.data?.length?<EmptyState title="What would you like to make possible?" body="Create a goal for a cushion, a course, a trip home, or something that matters to you." action={<Button onClick={()=>setDialog({kind:'goal',goal:'new'})} testId="button-empty-add-savings"><Plus size={15}/>Add your first goal</Button>}/>:
        <div className="grid gap-3 md:grid-cols-2">{query.data.map((goal)=>{const progress=goal.targetAmountPaise?goal.currentContributionPaise/goal.targetAmountPaise*100:0;return <article key={goal.id} className="soft-panel rounded-2xl p-5" data-testid={`card-savings-goal-${goal.id}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-base font-semibold text-[#e1ede2]" data-testid={`text-savings-goal-name-${goal.id}`}>{goal.name}</h3><p className="mt-1 text-xs text-[#849889]">{goal.targetDate?`Target ${niceDate(goal.targetDate)}`:'No target date — take your time'}</p></div><button onClick={()=>setDialog({kind:'goal',goal})} data-testid={`button-edit-savings-goal-${goal.id}`} className="rounded-lg px-2 py-1 text-xs text-[#95b99d] hover:bg-[#243b2a]">Edit</button></div><div className="mt-6 flex items-end justify-between"><div><p className="font-data text-xl font-semibold text-[#e4eee5]" data-testid={`value-savings-current-${goal.id}`}>{rupees(goal.currentContributionPaise)}</p><p className="mt-1 text-xs text-[#849889]">of {rupees(goal.targetAmountPaise)}</p></div><span className="font-data text-xs text-[#91daa1]">{pct(progress)}</span></div><div className="mt-3"><ProgressBar percent={progress} testId={`progress-savings-goal-${goal.id}`}/></div><Button onClick={()=>setDialog({kind:'contribute',goalId:goal.id,goalName:goal.name})} testId={`button-contribute-goal-${goal.id}`} variant="quiet" ><Plus size={14}/>Add contribution</Button></article>;})}</div>}
      <InfoNote testId="note-savings-history">Totals update when you record a contribution. Individual contribution history is not available from this planning view; no deposits are made or verified.</InfoNote>
    </Surface>
    {dialog?.kind==='goal'&&<Modal title={dialog.goal&&dialog.goal!=='new'?'Edit your goal':'Name a savings goal'} description="A goal can be a useful reminder, not a promise you have to keep." onClose={()=>setDialog(null)} onSubmit={submit} pending={create.isPending||update.isPending} submitLabel="Save goal"><Field name="name" label="Goal name" defaultValue={dialog.goal&&dialog.goal!=='new'?dialog.goal.name:''} placeholder="Emergency cushion, new laptop…" /><Field name="target" label="Target amount in rupees" type="number" min="0.01" step="0.01" defaultValue={dialog.goal&&dialog.goal!=='new'?(dialog.goal.targetAmountPaise/100).toFixed(2):''}/><Field name="date" label="Target date (optional)" type="date" required={false} defaultValue={dialog.goal&&dialog.goal!=='new'?dialog.goal.targetDate??'':''}/></Modal>}
    {dialog?.kind==='contribute'&&<Modal title={`Add to ${dialog.goalName}`} description="This updates the simulated amount for your goal. It does not transfer money." onClose={()=>setDialog(null)} onSubmit={submit} pending={contribute.isPending} submitLabel="Record contribution"><Field name="amount" label="Contribution in rupees" type="number" min="0.01" step="0.01" placeholder="For example, 500"/><Field name="date" label="Date" type="date" defaultValue={today()}/><Field name="note" label="Note (optional)" required={false} placeholder="A little extra this week"/></Modal>}
  </div>;
}

export function CommitmentsPage() {
  const client=useQueryClient();
  const query=useListCommitments();
  const create=useCreateCommitment();
  const update=useUpdateCommitment();
  const pay=usePayCommitment();
  const [dialog,setDialog]=useState<Commitment|'new'|null>(null);
  const [settling,setSettling]=useState<Commitment|null>(null);
  const [notice,setNotice]=useState<{text:string;kind:'success'|'error'}|null>(null);
  const invalidate=()=>{void client.invalidateQueries({queryKey:getListCommitmentsQueryKey()});void client.invalidateQueries({queryKey:getGetDashboardQueryKey()});void client.invalidateQueries({queryKey:getListTransactionsQueryKey()});void client.invalidateQueries({queryKey:getListBudgetCategoriesQueryKey()});};
  const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const data=getForm(event);const body={name:String(data.get('name')).trim(),category:String(data.get('category')).trim(),amountPaise:rupeesToPaise(data.get('amount')),dueDate:String(data.get('date')),recurrenceType:String(data.get('recurrence')) as 'once'|'weekly'|'monthly'|'yearly',isEssential:isChecked(data,'essential')};const callbacks={onSuccess:()=>{invalidate();setDialog(null);setNotice({text:'Commitment plan saved.',kind:'success'});},onError:()=>setNotice({text:'Commitment could not be saved. Check the details.',kind:'error'})};if(dialog&&dialog!=='new')update.mutate({id:dialog.id,data:body},callbacks);else create.mutate({data:body},callbacks);};
  const planned=(query.data??[]).filter((item)=>item.status==='planned');
  const settle=()=>{if(!settling)return;pay.mutate({id:settling.id},{onSuccess:()=>{invalidate();setSettling(null);setNotice({text:'Commitment marked as paid in your plan.',kind:'success'});},onError:()=>setNotice({text:'This commitment could not be settled. It may already be paid or changed.',kind:'error'})});};
  return <div className="enter" data-testid="page-commitments">
    <ScreenHeader kicker="Plan for what is due" title="Commitments" subtitle="Keep upcoming obligations visible, then mark them settled when you have recorded that in your plan." action={<PageTopAction onClick={()=>setDialog('new')} testId="button-add-commitment">Add a commitment</PageTopAction>}/>
    <PageMessage message={notice} setMessage={setNotice}/>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><SummaryTile label="Planned obligations" value={String(planned.length)} testId="summary-commitment-count"/><SummaryTile label="Amount still planned" value={rupees(planned.reduce((sum,item)=>sum+item.amountPaise,0))} testId="summary-commitment-total"/><SummaryTile label="Already settled" value={String((query.data??[]).filter((item)=>item.status==='paid').length)} testId="summary-commitment-paid"/></div>
    <Surface testId="card-commitments" className="p-5 sm:p-7">
      {query.isLoading?<LoadingBlock label="Loading commitments"/>:query.isError?<StateError retry={()=>void query.refetch()}/>:!query.data?.length?<EmptyState title="No obligations planned yet" body="Add the bills or commitments you expect, so your spending room is easier to understand." action={<Button onClick={()=>setDialog('new')} testId="button-empty-add-commitment"><Plus size={15}/>Add a commitment</Button>}/>:
        <div className="divide-y divide-[#ffffff0c]">{query.data.map((item)=><article key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center" data-testid={`row-commitment-${item.id}`}><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.status==='paid'?'bg-[#1c3c28] text-[#86d89b]':'bg-[#26372c] text-[#aabdac]'}`}>{item.status==='paid'?<Check size={17}/>:<CalendarDays size={17}/>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-[#dce8de]">{item.name}</h3><span className={`rounded-full px-2 py-0.5 text-[.62rem] capitalize ${item.status==='paid'?'bg-[#1e3b27] text-[#9de1a9]':item.status==='cancelled'?'bg-[#302e2a] text-[#a69d87]':'bg-[#293a2e] text-[#b9cbbb]'}`} data-testid={`status-commitment-${item.id}`}>{item.status}</span></div><p className="mt-1 text-xs text-[#839687]">{item.category} · Due {niceDate(item.dueDate)} · {item.recurrenceType}{item.isEssential?' · Essential':''}</p></div><span className="font-data text-sm text-[#e0e9e1]" data-testid={`value-commitment-${item.id}`}>{rupees(item.amountPaise)}</span><div className="flex gap-2">{item.status==='planned'&&<><Button onClick={()=>setSettling(item)} testId={`button-settle-commitment-${item.id}`} variant="quiet"><Check size={14}/>Mark paid</Button><button onClick={()=>setDialog(item)} data-testid={`button-edit-commitment-${item.id}`} className="rounded-lg px-2 text-xs text-[#95b99d] hover:bg-[#243b2a]">Edit</button></>}</div></article>)}</div>}
      <InfoNote testId="note-commitment-settlement">Marking an item paid records a planning status and may create a simulated transaction. It does not send a payment.</InfoNote>
    </Surface>
    {dialog&&<Modal title={dialog==='new'?'Plan a commitment':'Edit this commitment'} description="Add an expected cost so it is visible in your month plan." onClose={()=>setDialog(null)} onSubmit={submit} pending={create.isPending||update.isPending} submitLabel={dialog==='new'?'Add commitment':'Save changes'}><Field name="name" label="Name" defaultValue={dialog==='new'?'':dialog.name} placeholder="Rent, internet, course fee…"/><Field name="category" label="Category" defaultValue={dialog==='new'?'':dialog.category} placeholder="Housing, bills…"/><Field name="amount" label="Amount in rupees" type="number" min="0.01" step="0.01" defaultValue={dialog==='new'?'':(dialog.amountPaise/100).toFixed(2)}/><Field name="date" label="Due date" type="date" defaultValue={dialog==='new'?today():dialog.dueDate}/><SelectField name="recurrence" label="Repeats" defaultValue={dialog==='new'?'once':dialog.recurrenceType} options={ [['once','One time'],['weekly','Weekly'],['monthly','Monthly'],['yearly','Yearly']] }/><CheckField name="essential" label="Essential obligation" defaultChecked={dialog!=='new'&&dialog.isEssential}/></Modal>}
    {settling&&<Modal title="Mark this commitment paid?" description={`${settling.name} · ${rupees(settling.amountPaise)}. This updates your simulated plan only.`} onClose={()=>setSettling(null)} onSubmit={(event)=>{event.preventDefault();settle();}} pending={pay.isPending} submitLabel="Mark as paid" testId="dialog-settle-commitment"><InfoNote>Confirm only if you want the estimate to reflect this commitment as settled.</InfoNote></Modal>}
  </div>;
}

export function SubscriptionsPage() {
  const client=useQueryClient();
  const query=useListSubscriptions();
  const create=useCreateSubscription();
  const update=useUpdateSubscription();
  const [dialog,setDialog]=useState<{item?:{id:number;name:string;amountPaise:number;billingFrequency:string;nextBillingDate:string;category:string;status:string}|'new'}|null>(null);
  const [notice,setNotice]=useState<{text:string;kind:'success'|'error'}|null>(null);
  const invalidate=()=>{void client.invalidateQueries({queryKey:getListSubscriptionsQueryKey()});void client.invalidateQueries({queryKey:getGetDashboardQueryKey()});};
  const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const data=getForm(event);const body={name:String(data.get('name')).trim(),amountPaise:rupeesToPaise(data.get('amount')),billingFrequency:String(data.get('frequency')) as 'weekly'|'monthly'|'quarterly'|'yearly',nextBillingDate:String(data.get('date')),category:String(data.get('category')).trim()};if(dialog?.item&&dialog.item!=='new'){update.mutate({id:dialog.item.id,data:{...body,status:String(data.get('status')) as 'active'|'paused'|'cancelled'}},{onSuccess:()=>{invalidate();setDialog(null);setNotice({text:'Recurring cost updated.',kind:'success'});},onError:()=>setNotice({text:'Recurring cost could not be saved.',kind:'error'})});}else create.mutate({data:body},{onSuccess:()=>{invalidate();setDialog(null);setNotice({text:'Recurring cost added to your plan.',kind:'success'});},onError:()=>setNotice({text:'Recurring cost could not be added. Check the details.',kind:'error'})});};
  const active=(query.data??[]).filter((item)=>item.status==='active');
  const monthlyTotal=active.reduce((sum,item)=>sum+item.amountPaise*(item.billingFrequency==='weekly'?52/12:item.billingFrequency==='quarterly'?1/3:item.billingFrequency==='yearly'?1/12:1),0);
  return <div className="enter" data-testid="page-subscriptions">
    <ScreenHeader kicker="Recurring costs" title="Subscriptions" subtitle="See the regular charges you have entered and what they may add up to over time." action={<PageTopAction onClick={()=>setDialog({item:'new'})} testId="button-add-subscription">Add a recurring cost</PageTopAction>}/>
    <PageMessage message={notice} setMessage={setNotice}/>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><SummaryTile label="Active recurring costs" value={String(active.length)} testId="summary-subscription-count"/><SummaryTile label="Estimated monthly equivalent" value={rupees(Math.round(monthlyTotal))} testId="summary-subscription-monthly"/><SummaryTile label="Paused or cancelled" value={String((query.data??[]).length-active.length)} testId="summary-subscription-inactive"/></div>
    <Surface testId="card-subscriptions" className="p-5 sm:p-7">
      {query.isLoading?<LoadingBlock label="Loading recurring costs"/>:query.isError?<StateError retry={()=>void query.refetch()}/>:!query.data?.length?<EmptyState title="No recurring costs listed" body="Add subscriptions or repeat expenses you want to keep in view. We will estimate their monthly equivalent." action={<Button onClick={()=>setDialog({item:'new'})} testId="button-empty-add-subscription"><Plus size={15}/>Add a recurring cost</Button>}/>:
        <div className="grid gap-3 md:grid-cols-2">{query.data.map((item)=>{const freqAmount=item.billingFrequency==='weekly'?item.amountPaise*52/12:item.billingFrequency==='quarterly'?item.amountPaise/3:item.billingFrequency==='yearly'?item.amountPaise/12:item.amountPaise;return <article key={item.id} className="soft-panel rounded-2xl p-5" data-testid={`card-subscription-${item.id}`}><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-base font-semibold text-[#dce8de]" data-testid={`text-subscription-name-${item.id}`}>{item.name}</h3><span className={`rounded-full px-2 py-0.5 text-[.62rem] capitalize ${item.status==='active'?'bg-[#1e3b27] text-[#9de1a9]':'bg-[#30352f] text-[#b2b9ae]'}`} data-testid={`status-subscription-${item.id}`}>{item.status}</span></div><p className="mt-1 text-xs text-[#829587]">{item.category} · {item.billingFrequency} · next {niceDate(item.nextBillingDate)}</p></div><button onClick={()=>setDialog({item})} data-testid={`button-edit-subscription-${item.id}`} className="rounded-lg px-2 py-1 text-xs text-[#95b99d] hover:bg-[#243b2a]">Edit</button></div><div className="mt-6 flex items-end justify-between border-t border-[#ffffff0d] pt-4"><div><p className="font-data text-xl font-semibold text-[#e3eee5]">{rupees(item.amountPaise)}<span className="font-sans text-xs font-normal text-[#849789]"> / {item.billingFrequency.replace('ly','')}</span></p><p className="mt-1 text-xs text-[#819486]">About {rupees(Math.round(freqAmount))} per month</p></div><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#20362a] text-[#8bcf99]"><CreditCard size={17}/></div></div></article>;})}</div>}
      <InfoNote testId="note-subscription-estimate">Monthly totals convert your selected billing frequency to an average. Dates and amounts are estimates you entered.</InfoNote>
    </Surface>
    {dialog&&<Modal title={dialog.item&&dialog.item!=='new'?'Update recurring cost':'Add a recurring cost'} description="Keep a repeat expense visible in your own plan. This does not cancel or change any real subscription." onClose={()=>setDialog(null)} onSubmit={submit} pending={create.isPending||update.isPending} submitLabel="Save recurring cost"><Field name="name" label="Name" defaultValue={dialog.item&&dialog.item!=='new'?dialog.item.name:''} placeholder="Music, mobile plan…"/><Field name="amount" label="Amount each billing period (rupees)" type="number" min="0.01" step="0.01" defaultValue={dialog.item&&dialog.item!=='new'?(dialog.item.amountPaise/100).toFixed(2):''}/><SelectField name="frequency" label="Billing frequency" defaultValue={dialog.item&&dialog.item!=='new'?dialog.item.billingFrequency:'monthly'} options={ [['weekly','Weekly'],['monthly','Monthly'],['quarterly','Quarterly'],['yearly','Yearly']] }/><Field name="date" label="Next billing date" type="date" defaultValue={dialog.item&&dialog.item!=='new'?dialog.item.nextBillingDate:today()}/><Field name="category" label="Category" defaultValue={dialog.item&&dialog.item!=='new'?dialog.item.category:''} placeholder="Entertainment, phone…"/>{dialog.item&&dialog.item!=='new'&&<SelectField name="status" label="Plan status" defaultValue={dialog.item.status} options={ [['active','Active'],['paused','Paused'],['cancelled','Cancelled']] }/>}</Modal>}
  </div>;
}

export function SimulatorPage() {
  const client=useQueryClient();
  const scenarios=useListScenarios();
  const simulate=useSimulateScenario();
  const save=useSaveScenario();
  const update=useUpdateScenario();
  const remove=useDeleteScenario();
  const apply=useApplyScenario();
  const [preview,setPreview]=useState<Awaited<ReturnType<typeof simulate.mutateAsync>>|null>(null);
  const [lastInput,setLastInput]=useState<ScenarioInput|null>(null);
  const [editScenario,setEditScenario]=useState<Scenario|null>(null);
  const [deleteScenario,setDeleteScenario]=useState<Scenario|null>(null);
  const [notice,setNotice]=useState<{text:string;kind:'success'|'error'}|null>(null);
  const invalidate=()=>{void client.invalidateQueries({queryKey:getListScenariosQueryKey()});void client.invalidateQueries({queryKey:getGetDashboardQueryKey()});void client.invalidateQueries({queryKey:getGetProfileQueryKey()});void client.invalidateQueries({queryKey:getListTransactionsQueryKey()});void client.invalidateQueries({queryKey:getListBudgetCategoriesQueryKey()});void client.invalidateQueries({queryKey:getListSavingsGoalsQueryKey()});void client.invalidateQueries({queryKey:getListCommitmentsQueryKey()});void client.invalidateQueries({queryKey:getListSubscriptionsQueryKey()});};
  const makeInput=(data:FormData)=>({
    name:String(data.get('name')).trim(),
    type:String(data.get('type')) as 'purchase'|'unexpected_expense'|'income'|'new_subscription'|'cancel_subscription'|'savings_contribution'|'discretionary_change'|'delayed_purchase',
    amountPaise:rupeesToPaise(data.get('amount')),
    category:String(data.get('category')??'').trim()||undefined,
    description:String(data.get('description')??'').trim()||undefined,
    decisionDate:String(data.get('date')),
    isEssential:isChecked(data,'essential'),
    billingFrequency:(String(data.get('frequency')??'')||null) as ScenarioInput['billingFrequency'],
  });
  const previewScenario=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const input=makeInput(getForm(event));setLastInput(input);setPreview(null);simulate.mutate({data:input},{onSuccess:(result)=>{setPreview(result);setNotice({text:'Preview ready. Your plan has not changed.',kind:'success'});},onError:()=>setNotice({text:'We could not preview that choice. Check the amount and try again.',kind:'error'})});};
  const saveScenario=()=>{if(!lastInput)return;save.mutate({data:lastInput},{onSuccess:()=>{invalidate();setNotice({text:'Scenario saved for you to revisit.',kind:'success'});},onError:()=>setNotice({text:'Scenario could not be saved.',kind:'error'})});};
  return <div className="enter" data-testid="page-simulator">
    <ScreenHeader kicker="Before you decide" title="Try a what-if" subtitle="Explore a change against the plan you have now. Preview first; you choose if anything gets applied."/>
    <PageMessage message={notice} setMessage={setNotice}/>
    <div className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
      <Surface testId="card-scenario-builder" className="p-5 sm:p-7"><div className="mb-5"><p className="eyebrow">A decision to explore</p><h2 className="mt-1 font-display text-lg font-semibold text-[#e1ede2]">What are you considering?</h2></div>
        <form onSubmit={previewScenario} data-testid="form-simulate-scenario" className="space-y-4"><Field name="name" label="Give this scenario a name" placeholder="A new course, one big purchase…"/><SelectField name="type" label="What might change?" options={ [['purchase','A purchase'],['unexpected_expense','An unexpected cost'],['income','Extra income'],['new_subscription','A new recurring cost'],['cancel_subscription','Pause a recurring cost'],['savings_contribution','More toward savings'],['discretionary_change','Change flexible spending'],['delayed_purchase','Wait on a purchase']] }/><Field name="amount" label="Amount in rupees" type="number" min="0.01" step="0.01" placeholder="For example, 1,200"/><Field name="category" label="Category (optional)" required={false} placeholder="Travel, learning…"/><Field name="description" label="A note to remember" required={false} placeholder="What are you weighing up?"/><Field name="date" label="Decision date" type="date" defaultValue={today()}/><SelectField name="frequency" label="Repeat frequency (if it applies)" options={ [['','Does not repeat'],['weekly','Weekly'],['monthly','Monthly'],['quarterly','Quarterly'],['yearly','Yearly']] }/><CheckField name="essential" label="This is an essential cost" /><Button type="submit" testId="button-preview-scenario" disabled={simulate.isPending}>{simulate.isPending&&<LoaderCircle size={15} className="animate-spin"/>}<Activity size={15}/>Preview the change</Button></form>
      </Surface>
      <div className="space-y-4">
        <Surface testId="card-scenario-preview" className="p-5 sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">A preview, not a commitment</p><h2 className="mt-1 font-display text-lg font-semibold text-[#e1ede2]">What could change</h2></div><Sparkles size={19} className="text-[#8bd69a]"/></div>
          {simulate.isPending?<div className="mt-5"><LoadingBlock label="Calculating scenario preview"/></div>:preview?<>
            <div className="mt-5 grid gap-3 sm:grid-cols-2"><SnapshotMini title="Current plan estimate" snapshot={preview.baseline} testId="snapshot-baseline"/><SnapshotMini title="With this choice" snapshot={preview.projected} testId="snapshot-projected"/></div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#395642] bg-[#172b1e] p-4"><span className="text-sm text-[#a5b8a8]">Estimated balance change</span><span className={`font-data text-lg font-semibold ${preview.changePaise<0?'text-[#e8a296]':'text-[#91dfa2]'}`} data-testid="value-scenario-change">{preview.changePaise<0?'−':''}{rupees(Math.abs(preview.changePaise))}</span></div>
            {preview.explanation.length>0&&<div className="mt-4 space-y-2">{preview.explanation.map((line,index)=><p key={index} className="flex gap-2 text-sm leading-6 text-[#a6b7a8]" data-testid={`text-scenario-explanation-${index}`}><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#71ce8d]"/>{line}</p>)}</div>}
            <div className="mt-5 flex flex-wrap gap-2"><Button onClick={saveScenario} testId="button-save-scenario" disabled={save.isPending||!lastInput}>{save.isPending&&<LoaderCircle size={14} className="animate-spin"/>}Save this scenario</Button><InfoNote testId="note-simulator-apply">Saving keeps a copy for you. Applying a saved scenario changes your planning records, not real money.</InfoNote></div>
          </>:<div className="mt-5"><EmptyState title="Your preview will appear here" body="Enter one possible change and compare its estimated impact with your current plan."/></div>}
          <div className="mt-5"><InfoNote testId="note-simulation-estimate">This preview is an estimate from the information in your plan. Actual costs and timing can differ.</InfoNote></div>
        </Surface>
        <Surface testId="card-saved-scenarios" className="p-5 sm:p-7"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">Pick up where you left off</p><h2 className="mt-1 font-display text-lg font-semibold text-[#e1ede2]">Saved scenarios</h2></div><span className="text-xs text-[#829587]" data-testid="text-saved-scenario-count">{scenarios.data?.length??0} saved</span></div>
          {scenarios.isLoading?<LoadingBlock label="Loading saved scenarios"/>:scenarios.isError?<StateError retry={()=>void scenarios.refetch()}/>:!scenarios.data?.length?<p className="text-sm text-[#8fa293]" data-testid="text-no-saved-scenarios">Scenarios you choose to save will be listed here. Nothing is saved automatically.</p>:<div className="space-y-2">{scenarios.data.map((item)=><article key={item.id} className="rounded-xl border border-[#344c3b] bg-[#14251a] p-4" data-testid={`card-scenario-${item.id}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#d9e7db]" data-testid={`text-scenario-name-${item.id}`}>{item.name}</p><p className="mt-1 text-xs capitalize text-[#839688]">{item.type.replaceAll('_',' ')} · {niceDate(item.createdAt)} · {item.status}</p><p className="mt-1 text-xs text-[#90a393]">Estimate change: {rupees(item.result.changePaise)}</p></div><div className="flex flex-wrap gap-2"><Button onClick={()=>apply.mutate({id:item.id},{onSuccess:()=>{invalidate();setNotice({text:'Scenario applied to your planning records.',kind:'success'});},onError:()=>setNotice({text:'This scenario could not be applied. Your plan is unchanged.',kind:'error'})})} testId={`button-apply-scenario-${item.id}`} variant="quiet" disabled={apply.isPending||item.status==='applied'}>{item.status==='applied'?'Applied':'Apply to plan'}</Button><button onClick={()=>setEditScenario(item)} data-testid={`button-rename-scenario-${item.id}`} className="rounded-lg px-2 py-1 text-xs text-[#95b99d] hover:bg-[#243b2a]">Rename</button><button onClick={()=>setDeleteScenario(item)} aria-label={`Delete ${item.name}`} data-testid={`button-delete-scenario-${item.id}`} className="rounded-lg p-2 text-[#829487] hover:text-rose-200"><Trash2 size={14}/></button></div></div></article>)}</div>}
        </Surface>
      </div>
    </div>
    {editScenario&&<Modal title="Rename this scenario" description="Give this saved idea a name that will make sense later." onClose={()=>setEditScenario(null)} pending={update.isPending} submitLabel="Save name" onSubmit={(event)=>{event.preventDefault();const name=String(getForm(event).get('name')).trim();update.mutate({id:editScenario.id,data:{name}},{onSuccess:()=>{invalidate();setEditScenario(null);setNotice({text:'Scenario renamed.',kind:'success'});},onError:()=>setNotice({text:'Scenario name could not be updated.',kind:'error'})});}}><Field name="name" label="Scenario name" defaultValue={editScenario.name}/></Modal>}
    {deleteScenario&&<Modal title="Delete this saved idea?" description={`"${deleteScenario.name}" will be removed from your saved scenarios.`} onClose={()=>setDeleteScenario(null)} pending={remove.isPending} submitLabel="Delete scenario" testId="dialog-delete-scenario" onSubmit={(event)=>{event.preventDefault();remove.mutate({id:deleteScenario.id},{onSuccess:()=>{invalidate();setDeleteScenario(null);setNotice({text:'Saved scenario removed.',kind:'success'});},onError:()=>setNotice({text:'Scenario could not be deleted.',kind:'error'})});}}><p className="text-xs text-[#99ad9e]">This does not change your current plan.</p></Modal>}
  </div>;
}
function SnapshotMini({title,snapshot,testId}:{title:string;snapshot:FinancialSnapshot;testId:string}) {
  return <div className="rounded-xl border border-[#324a39] bg-[#14251a] p-4" data-testid={testId}><p className="text-xs text-[#8fa294]">{title}</p><p className="mt-2 font-data text-lg font-semibold text-[#e2eee3]">{rupees(snapshot.projectedMonthEndBalancePaise)}</p><p className="mt-1 text-[.68rem] capitalize text-[#91a394]">Plan risk: {snapshot.risk}</p></div>;
}

export function InsightsPage() {
  const query=useGetDashboard();
  const budgets=useListBudgetCategories();
  const commitments=useListCommitments();
  if(query.isLoading||budgets.isLoading||commitments.isLoading)return <><ScreenHeader kicker="See the shape of things" title="Insights" subtitle="A plain-language view of your plan, with estimates and context."/><LoadingBlock label="Loading plan insights"/></>;
  if(query.isError||budgets.isError||commitments.isError||!query.data)return <><ScreenHeader kicker="See the shape of things" title="Insights" subtitle="A plain-language view of your plan, with estimates and context."/><StateError retry={()=>{void query.refetch();void budgets.refetch();void commitments.refetch();}}/></>;
  const snapshot=query.data.snapshot;
  const planned=commitments.data??[];
  const covered=planned.filter((item)=>item.status==='planned').reduce((sum,item)=>sum+item.amountPaise,0);
  const budgetTotal=(budgets.data??[]).reduce((sum,item)=>sum+item.spendingLimitPaise,0);
  const spendRate=budgetTotal?query.data.expensesPaise/budgetTotal*100:0;
  const riskLabel=snapshot.risk==='low'?'Your plan has breathing room':snapshot.risk==='moderate'?'Keep an eye on the next few costs':snapshot.risk==='high'?'Your plan may need a little more room':'The current plan looks tight';
  const focus=snapshot.riskFactors.length?snapshot.riskFactors:['No specific pressure points have been flagged from the information currently in your plan.'];
  return <div className="enter" data-testid="page-insights">
    <ScreenHeader kicker="See the shape of things" title="Insights" subtitle="A plain-language view of your plan, with estimates and context."/>
    <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
      <Surface testId="card-insight-health" className="p-6 sm:p-7"><div className="flex items-start justify-between"><div><p className="eyebrow">Plan health</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-[-.04em] text-[#e5efe6]" data-testid="text-risk-summary">{riskLabel}</h2></div><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#213a29] text-[#8cdaa0]"><HeartPulse size={20}/></div></div><div className="mt-6 flex items-baseline justify-between"><span className="text-sm text-[#95a99a]">Health estimate</span><span className="font-data text-2xl text-[#dbe9dd]" data-testid="value-insight-health">{snapshot.healthScore}<span className="text-sm text-[#85988a]"> / 100</span></span></div><div className="mt-3"><ProgressBar percent={snapshot.healthScore} tone={snapshot.healthScore<40?'red':snapshot.healthScore<70?'amber':'green'} testId="progress-insight-health"/></div><p className="mt-4 text-xs leading-5 text-[#889b8d]">This is a simple planning signal based on estimates you entered, not advice or a prediction of what will happen.</p></Surface>
      <Surface testId="card-insight-balance" className="p-6 sm:p-7"><p className="eyebrow">Month-end estimate</p><p className="mt-3 font-display text-4xl font-semibold tracking-[-.06em] text-[#e4eee5]" data-testid="value-insight-projection">{rupees(snapshot.projectedMonthEndBalancePaise)}</p><p className="mt-2 text-sm text-[#95a99a]">Estimated balance at the end of your challenge</p><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#17291e] p-3"><p className="text-[.68rem] text-[#86998a]">Current estimated balance</p><p className="mt-1 font-data text-sm text-[#dce9de]">{rupees(snapshot.currentBalancePaise)}</p></div><div className="rounded-xl bg-[#17291e] p-3"><p className="text-[.68rem] text-[#86998a]">Spendable estimate</p><p className="mt-1 font-data text-sm text-[#dce9de]">{rupees(snapshot.spendableBalancePaise)}</p></div></div></Surface>
    </div>
    <div className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
      <Surface testId="card-risk-factors" className="p-6 sm:p-7"><div className="flex items-center gap-2"><CircleAlert size={17} className="text-[#d8b978]"/><div><p className="eyebrow">What to notice</p><h2 className="mt-1 font-display text-lg font-semibold text-[#e1ede2]">Things influencing this view</h2></div></div><div className="mt-5 space-y-3">{focus.map((factor,index)=><div key={index} className="flex gap-3 rounded-xl border border-[#36483a] bg-[#17251b] p-4" data-testid={`text-risk-factor-${index}`}><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#3d3826] text-xs font-semibold text-[#d8c388]">{index+1}</span><p className="text-sm leading-6 text-[#b5c5b7]">{factor}</p></div>)}</div></Surface>
      <Surface testId="card-plan-context" className="p-6 sm:p-7"><div className="flex items-center gap-2"><Lightbulb size={17} className="text-[#93d59c]"/><div><p className="eyebrow">In context</p><h2 className="mt-1 font-display text-lg font-semibold text-[#e1ede2]">A few useful comparisons</h2></div></div><div className="mt-5 space-y-4">{[
        {label:'Planned costs still ahead',value:rupees(covered),copy:`${planned.filter(item=>item.status==='planned').length} planned commitments`},
        {label:'Recorded spending vs category guides',value:budgetTotal?`${spendRate.toFixed(0)}%`:'No category guides yet',copy:budgetTotal?`${rupees(query.data.expensesPaise)} entered against ${rupees(budgetTotal)} planned`:'Add a few categories to give spending some context.'},
        {label:'Commitment coverage',value:pct(snapshot.commitmentCoverage),copy:'A coverage estimate from your current plan details'},
      ].map((item,index)=><div key={item.label} className="flex items-center justify-between gap-3 border-b border-[#ffffff0b] pb-3 last:border-0" data-testid={`row-context-${index}`}><div><p className="text-sm text-[#c3d2c5]">{item.label}</p><p className="mt-1 text-[.68rem] text-[#839587]">{item.copy}</p></div><span className="shrink-0 font-data text-sm text-[#dce9dd]">{item.value}</span></div>)}</div></Surface>
    </div>
    <Surface testId="card-insight-forecast" className="mt-4 p-6 sm:p-7"><div className="flex items-start justify-between"><div><p className="eyebrow">Your estimate over time</p><h2 className="mt-1 font-display text-lg font-semibold text-[#e1ede2]">Balance path</h2></div><Link href="/simulator" data-testid="link-insight-simulator" className="text-xs font-semibold text-[#82d997]">Try a change <ArrowRight size={13} className="ml-1 inline"/></Link></div>{query.data.forecast.length>1?<ForecastChart values={query.data.forecast.map((item)=>item.balancePaise)} labels={query.data.forecast.map((item)=>item.label)}/>:<div className="mt-5"><EmptyState title="More plan details, clearer estimates" body="Your projected path will appear once there are enough details to build it." /></div>}<InfoNote testId="note-insights-estimates">Forecasts and health signals are system-generated estimates from the current plan. They can be wrong and should not be treated as financial advice.</InfoNote></Surface>
    <Surface testId="card-generated-insights" className="mt-4 p-6 sm:p-7"><div className="flex items-center gap-2"><Sparkles size={17} className="text-[#89d79a]"/><p className="eyebrow">From the numbers you entered</p></div>{query.data.insights.length?<ul className="mt-4 grid gap-2 md:grid-cols-2">{query.data.insights.map((insight,index)=><li key={index} className="rounded-xl bg-[#17291e] px-4 py-3 text-sm leading-6 text-[#bdccbf]" data-testid={`text-generated-insight-${index}`}>{insight}</li>)}</ul>:<p className="mt-4 text-sm leading-6 text-[#8fa294]" data-testid="text-no-generated-insights">No additional notes yet. Insights will update as your own plan details change.</p>}</Surface>
  </div>;
}

export function NotificationsPage() {
  const client=useQueryClient();
  const query=useListNotifications();
  const mark=useMarkNotificationRead();
  const [notice,setNotice]=useState<{text:string;kind:'success'|'error'}|null>(null);
  const unread=(query.data??[]).filter((item)=>!item.isRead).length;
  return <div className="enter" data-testid="page-notifications">
    <ScreenHeader kicker="A little heads-up" title="Notifications" subtitle="Alerts created from your plan details. Read them as prompts to check your numbers, not as instructions."/>
    <PageMessage message={notice} setMessage={setNotice}/>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><SummaryTile label="Unread alerts" value={String(unread)} testId="summary-notifications-unread"/><SummaryTile label="All alerts" value={String(query.data?.length??0)} testId="summary-notifications-total"/><SummaryTile label="What these are" value="Plan prompts" testId="summary-notifications-type"/></div>
    <Surface testId="card-notifications" className="p-5 sm:p-7"><div className="mb-5 flex items-center gap-2"><Bell size={17} className="text-[#8bd69a]"/><p className="text-sm font-semibold text-[#dce9de]">Your alerts</p></div>
      {query.isLoading?<LoadingBlock label="Loading your alerts"/>:query.isError?<StateError retry={()=>void query.refetch()}/>:!query.data?.length?<EmptyState title="A quiet inbox" body="There are no generated financial alerts for your plan right now. Alerts will appear when a detail is worth another look."/>:<div className="space-y-2">{query.data.map((item)=>{const severityColor=item.severity==='critical'?'text-[#eea39a] bg-[#432b27]':item.severity==='warning'?'text-[#e2c77e] bg-[#413921]':'text-[#8ed5a0] bg-[#203b29]';return <article key={item.id} className={`rounded-2xl border p-4 sm:p-5 ${item.isRead?'border-[#34473a] bg-[#15231a]/50':'border-[#456348] bg-[#192a1e]'}`} data-testid={`card-notification-${item.id}`}><div className="flex items-start gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${severityColor}`}><CircleAlert size={17}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-[#dce8dd]" data-testid={`text-notification-title-${item.id}`}>{item.title}</h3><span className={`rounded-full px-2 py-0.5 text-[.62rem] capitalize ${severityColor}`} data-testid={`status-notification-severity-${item.id}`}>{item.severity}</span>{!item.isRead&&<span className="h-1.5 w-1.5 rounded-full bg-[#77d592]" aria-label="Unread" data-testid={`status-notification-unread-${item.id}`}/>}</div><p className="mt-2 text-sm leading-6 text-[#a4b5a7]" data-testid={`text-notification-message-${item.id}`}>{item.message}</p><p className="mt-3 text-[.68rem] text-[#7f9384]">{new Date(item.createdAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</p></div>{!item.isRead&&<Button onClick={()=>mark.mutate({id:item.id},{onSuccess:()=>{void client.invalidateQueries({queryKey:getListNotificationsQueryKey()});setNotice({text:'Alert marked as read.',kind:'success'});},onError:()=>setNotice({text:'Could not update this alert.',kind:'error'})})} testId={`button-mark-read-${item.id}`} variant="quiet" disabled={mark.isPending}><Check size={14}/>Read</Button>}</div></article>;})}</div>}
      <InfoNote testId="note-notification-context">Alerts are generated from the information in your plan. Confirm the underlying details before making a decision.</InfoNote>
    </Surface>
  </div>;
}

export function SettingsPage() {
  const client=useQueryClient();
  const profileQuery=useGetProfile();
  const update=useUpdateProfile();
  const [notice,setNotice]=useState<{text:string;kind:'success'|'error'}|null>(null);
  const [exportRequested,setExportRequested]=useState(false);
  const exportQuery=useExportFinancialData({query:{enabled:exportRequested,queryKey:getExportFinancialDataQueryKey()}});
  useEffect(()=>{
    if(!exportRequested||!exportQuery.data)return;
    const blob=new Blob([JSON.stringify(exportQuery.data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='finsync-plan-export.json';link.click();
    URL.revokeObjectURL(url);setExportRequested(false);setNotice({text:'Your personal plan data has been exported.',kind:'success'});
  },[exportRequested,exportQuery.data]);
  const profile=profileQuery.data;
  const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const data=getForm(event);const body={displayName:String(data.get('displayName')).trim(),timezone:String(data.get('timezone')).trim(),challengeStartDate:String(data.get('startDate')),challengeDurationDays:Number(data.get('duration')),startingBudgetPaise:rupeesToPaise(data.get('budget')),plannedIncomePaise:rupeesToPaise(data.get('income')),savingsGoalPaise:rupeesToPaise(data.get('savingsGoal')),emergencyReserveTargetPaise:rupeesToPaise(data.get('reserve')),onboardingCompleted:true};update.mutate({data:body},{onSuccess:()=>{void client.invalidateQueries({queryKey:getGetProfileQueryKey()});void client.invalidateQueries({queryKey:getGetDashboardQueryKey()});setNotice({text:'Your profile and challenge settings are saved.',kind:'success'});},onError:()=>setNotice({text:'Settings could not be saved. Please check your details.',kind:'error'})});};
  return <div className="enter" data-testid="page-settings">
    <ScreenHeader kicker="Make it yours" title="Profile & challenge" subtitle="Update the starting point for your 30-day planning space whenever it changes."/>
    <PageMessage message={notice} setMessage={setNotice}/>
    {profileQuery.isLoading?<LoadingBlock label="Loading profile and challenge settings"/>:profileQuery.isError||!profile?<StateError retry={()=>void profileQuery.refetch()}/>:<div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <Surface testId="card-challenge-settings" className="p-5 sm:p-7"><div className="mb-6"><p className="eyebrow">Your challenge setup</p><h2 className="mt-1 font-display text-lg font-semibold text-[#e1ede2]">The numbers behind your plan</h2><p className="mt-2 text-xs text-[#889b8d]">Amounts are entered in rupees and saved as exact paise.</p></div>
        <form onSubmit={submit} className="space-y-4" data-testid="form-profile-settings"><Field name="displayName" label="Name" defaultValue={profile.displayName}/><div className="rounded-xl border border-[#304839] bg-[#17271d] px-3.5 py-3"><p className="text-[.68rem] text-[#859889]">Account email</p><p className="mt-1 text-sm text-[#cbd9cd]" data-testid="text-profile-email">{profile.email||'No email provided'}</p></div><Field name="timezone" label="Time zone" defaultValue={profile.timezone}/><div className="grid gap-4 sm:grid-cols-2"><Field name="startDate" label="Challenge start date" type="date" defaultValue={profile.challengeStartDate}/><Field name="duration" label="Challenge duration in days" type="number" min="1" max="366" defaultValue={profile.challengeDurationDays}/></div><div className="grid gap-4 sm:grid-cols-2"><Field name="budget" label="Starting budget in rupees" type="number" min="0" step="0.01" defaultValue={(profile.startingBudgetPaise/100).toFixed(2)}/><Field name="income" label="Planned income in rupees" type="number" min="0" step="0.01" defaultValue={(profile.plannedIncomePaise/100).toFixed(2)}/></div><div className="grid gap-4 sm:grid-cols-2"><Field name="savingsGoal" label="Savings goal in rupees" type="number" min="0" step="0.01" defaultValue={(profile.savingsGoalPaise/100).toFixed(2)}/><Field name="reserve" label="Emergency reserve target in rupees" type="number" min="0" step="0.01" defaultValue={(profile.emergencyReserveTargetPaise/100).toFixed(2)}/></div><Button type="submit" testId="button-save-profile" disabled={update.isPending}>{update.isPending&&<LoaderCircle size={15} className="animate-spin"/>}Save challenge settings</Button></form>
      </Surface>
      <div className="space-y-4">
        <Surface testId="card-data-export" className="p-5 sm:p-7"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#244330] text-[#8cdda0]"><FileDown size={18}/></div><div><p className="eyebrow">Your records</p><h2 className="mt-1 font-display text-lg font-semibold text-[#e1ede2]">Take your data with you</h2></div></div><p className="mt-4 text-sm leading-6 text-[#95a99a]">Export your profile, transactions, savings goals, commitments and subscriptions as a JSON file.</p><Button onClick={()=>{setExportRequested(true);setNotice(null);}} testId="button-export-data" variant="quiet" disabled={exportRequested||exportQuery.isFetching} >{exportQuery.isFetching?<LoaderCircle size={15} className="animate-spin"/>:<Download size={15}/>}Export my data</Button>{exportQuery.isError&&<Feedback kind="error" message="Your export could not be prepared. Please try again." onDismiss={()=>{setExportRequested(false);}}/>}<InfoNote testId="note-export-private">This export contains the personal records associated with your account. Keep the file somewhere private.</InfoNote></Surface>
        <Surface testId="card-settings-trust" className="p-5 sm:p-7"><div className="flex items-center gap-2"><ShieldCheck size={17} className="text-[#8bdaa0]"/><p className="eyebrow">A clear boundary</p></div><h2 className="mt-3 font-display text-lg font-semibold text-[#e1ede2]">Planning, not banking</h2><p className="mt-2 text-sm leading-6 text-[#95a99a]">FINSync stores the planning details you enter. It does not ask for bank credentials, verify your balances, or move money. All forecasts are estimates.</p></Surface>
        <div className="rounded-2xl border border-[#31483a] bg-[#16251b] p-4 text-xs leading-5 text-[#8da091]" data-testid="text-account-context">Profile ID <span className="ml-2 font-data text-[#aebfb0]">{profile.id}</span><br/>Currency: {profile.currency}</div>
      </div>
    </div>}
  </div>;
}
