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
import { AuthGate } from './components/AuthGate';
import './styles.css';

declare const __BASE_PATH__: string;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate><BrowserRouter basename={__BASE_PATH__}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/expenses/:expenseId" element={<ExpenseCard />} />
          <Route path="/directories" element={<Directories />} />
          <Route path="/directories/:directory" element={<Directories />} />
          <Route path="/directories/:directory/:itemId" element={<DirectoryCard />} />
          <Route path="/partners" element={<Directories />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter></AuthGate>
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
