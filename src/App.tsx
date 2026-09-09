import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
export type ViewMode = 'phone' | 'desktop' | 'dual';
import { MobileDeviceShell } from './components/common/MobileDeviceShell';
import { DesktopRescueCommand } from './components/rescue/DesktopRescueCommand';

const MainAppContent: React.FC = () => {
  const { user, role, setRole } = useApp();
  const [viewMode, setViewMode] = useState<ViewMode>('phone');
  const [triggerSplashCount, setTriggerSplashCount] = useState<number>(0);
  const [isWideScreen, setIsWideScreen] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 900 : false;
  });

  // Track window resize
  useEffect(() => {
    const handleResize = () => {
      setIsWideScreen(window.innerWidth >= 900);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // When switching to desktop view mode, ensure role is RESCUE_TEAM
  const handleSelectViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'desktop') {
      setRole('RESCUE_TEAM');
    }
  };

  const handleReplaySplash = () => {
    setViewMode('phone');
    setTriggerSplashCount(c => c + 1);
  };

  return (
    <div className={`lifeline-viewport-container ${viewMode}`}>
      {/* Main Content Area */}
      <main className="lifeline-main-content">
        {!user ? (
          /* When logged out, show the phone frame with Splash & Login */
          <MobileDeviceShell
            key={`logged-out-${triggerSplashCount}`}
            triggerSplash={triggerSplashCount > 0}
          />
        ) : viewMode === 'desktop' ? (
          <DesktopRescueCommand onSwitchToPhoneView={() => setViewMode('phone')} />
        ) : viewMode === 'dual' && isWideScreen ? (
          <div className="dual-view-layout">
            <div className="dual-view-phone-pane">
              <div className="dual-pane-badge">📱 VICTIM NODE SIMULATOR</div>
              <MobileDeviceShell
                forcedRole="VICTIM"
                key={`dual-phone-${triggerSplashCount}`}
                triggerSplash={triggerSplashCount > 0}
              />
            </div>

            <div className="dual-view-hq-pane">
              <div className="dual-pane-badge hq">🛡️ RESCUE INCIDENT COMMAND HQ</div>
              <DesktopRescueCommand />
            </div>
          </div>
        ) : (
          <MobileDeviceShell
            key={`phone-${triggerSplashCount}`}
            triggerSplash={triggerSplashCount > 0}
          />
        )}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
};

export default App;
