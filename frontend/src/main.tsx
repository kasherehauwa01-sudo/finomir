import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/DashboardStable';
import { Directories } from './pages/DirectoriesStable';
import { DirectoryCard } from './pages/DirectoryCardStable';
import { Expenses } from './pages/ExpensesStable';
import { ExpenseCard } from './pages/ExpenseCard';
import { Settings } from './pages/Settings';
import { APP_PATHS } from './config/navigation';
import './styles.css';

declare const __BASE_PATH__: string;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={__BASE_PATH__}>
      <Routes>
        <Route element={<Layout />}>
          <Route path={APP_PATHS.dashboard} element={<Dashboard />} />
          <Route path={APP_PATHS.expenses} element={<Expenses />} />
          <Route path="/expenses/:expenseId" element={<ExpenseCard />} />
          <Route path={APP_PATHS.directories} element={<Directories />} />
          <Route path="/directories/:directory" element={<Directories />} />
          <Route path="/directories/:directory/:itemId" element={<DirectoryCard />} />
          <Route path={APP_PATHS.partners} element={<Directories />} />
          <Route path={APP_PATHS.settings} element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const hadController = Boolean(navigator.serviceWorker.controller);
      const registration = await navigator.serviceWorker.register(`${__BASE_PATH__}sw.js`, { updateViaCache: 'none' });
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadController && !reloading) {
          reloading = true;
          window.location.reload();
        }
      });
      // Проверяем обновление при каждом запуске установленного PWA, а не ждём
      // стандартного суточного интервала браузера.
      await registration.update();
    } catch {
      // При отсутствии сети уже установленное PWA продолжает работать из кеша.
    }
  });
}
