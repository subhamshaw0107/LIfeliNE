import React from 'react';
import { AppProvider } from './context/AppContext';
import { DemoBar } from './components/demo/DemoBar';
import { MobileDeviceShell } from './components/common/MobileDeviceShell';

const MainAppContent: React.FC = () => {
  return (
    <div className="lifeline-viewport-container">
      {/* Top Action Bar: Install APK / Phone Option Only */}
      <DemoBar />

      {/* Main Mobile Device Screen */}
      <MobileDeviceShell />
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
