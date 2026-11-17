import { useMemo } from 'react';

import { useTune } from './app/useTune';
import { createBackend } from './backend';
import { I18nContext, SetLanguageContext } from './i18n/context';
import { FirstRun } from './screens/FirstRun';
import { Header, MockBar } from './screens/Header';
import { Main } from './screens/Main';
import { Sidebar } from './screens/Sidebar';

export function App() {
  const backend = useMemo(createBackend, []);
  const tune = useTune(backend);

  if (tune.fatal) {
    return (
      <pre role="alert" style={{ margin: 16, whiteSpace: 'pre-wrap' }}>
        {tune.fatal}
      </pre>
    );
  }
  if (!tune.settings || !tune.info) return null;

  return (
    <I18nContext.Provider value={tune.i18n}>
      <SetLanguageContext.Provider value={tune.setLanguage}>
        <Header tune={tune} />
        <MockBar tune={tune} />
        {tune.settings.firstRunDone ? (
          <div className="shell">
            <Sidebar tune={tune} />
            <Main tune={tune} />
          </div>
        ) : (
          <FirstRun tune={tune} />
        )}
      </SetLanguageContext.Provider>
    </I18nContext.Provider>
  );
}
