import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BottomNav, ToastHost, type Tab } from './components/ui';
import { UpdateBanner, useServiceWorker } from './components/UpdateBanner';
import { canShareFiles, downloadBackup, shareBackup } from './lib/backup';
import { allSegmentProgress, lastPlayableDay } from './lib/engine';
import { toast } from './lib/feedback';
import { useMediaQuery, useToday } from './lib/hooks';
import { actions, getState, onSaveError, useAppState, useStoreReady } from './lib/store';
import type { ISODate } from './lib/dates';
import type { Theme } from './lib/types';
import { Onboarding } from './screens/Onboarding';
import { ProgressScreen } from './screens/Progress';
import { RewardsScreen } from './screens/Rewards';
import { SettingsScreen } from './screens/Settings';
import { TodayScreen } from './screens/Today';

function useTheme(theme: Theme) {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    const dark = theme === 'dark' || (theme === 'system' && prefersDark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0B0E13' : '#F3F5F8');
  }, [theme, prefersDark]);
}

export function App() {
  const sw = useServiceWorker();
  const ready = useStoreReady();
  const state = useAppState();
  const today = useToday();
  const [tab, setTab] = useState<Tab>('hoy');
  const [selected, setSelected] = useState<ISODate>(today);
  const lastToday = useRef(today);

  useTheme(state.settings?.theme ?? 'system');
  useEffect(() => onSaveError((m) => toast(m, 'error')), []);

  // Si pasa la medianoche con la app abierta en "hoy", sigue en el nuevo hoy.
  useEffect(() => {
    if (lastToday.current !== today) {
      setSelected((sel) => (sel === lastToday.current ? today : sel));
      lastToday.current = today;
    }
  }, [today]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  if (!ready) return <div className="app" aria-busy="true" />;

  if (!state.settings) {
    return (
      <>
        <Onboarding today={today} updateBanner={<UpdateBanner needRefresh={sw.needRefresh} onUpdate={sw.update} />} />
        <ToastHost />
      </>
    );
  }

  const s = state.settings;
  const playable = lastPlayableDay(s, today);
  const sel = today < s.startDate ? today : selected < s.startDate ? s.startDate : selected > playable ? playable : selected;
  const pendingRewards = allSegmentProgress(s, state.days, today).filter(
    (p) => p.status === 'won' && !state.rewards[String(p.segment.index)]?.claimedAt,
  ).length;

  const quickBackup = async () => {
    try {
      if (canShareFiles()) {
        if ((await shareBackup(getState())) === 'cancelled') return;
      } else downloadBackup(getState());
      actions.markBackup();
      toast('Respaldo listo.', 'success');
    } catch {
      toast('No se pudo crear el respaldo.', 'error');
    }
  };

  return (
    <>
      <div className="app">
        <UpdateBanner needRefresh={sw.needRefresh} onUpdate={sw.update} />
        {tab === 'hoy' && (
          <TodayScreen
            state={state}
            today={today}
            selected={sel}
            onSelect={setSelected}
            onGoRewards={() => setTab('premios')}
            onBackup={() => void quickBackup()}
          />
        )}
        {tab === 'premios' && <RewardsScreen state={state} today={today} />}
        {tab === 'avance' && (
          <ProgressScreen
            state={state}
            today={today}
            onOpenDay={(d) => {
              setSelected(d);
              setTab('hoy');
            }}
          />
        )}
        {tab === 'ajustes' && <SettingsScreen state={state} today={today} />}
      </div>
      <BottomNav tab={tab} onChange={setTab} rewardsPending={pendingRewards} />
      <ToastHost />
    </>
  );
}
