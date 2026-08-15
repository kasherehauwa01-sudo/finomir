import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Directories } from './pages/Directories';
import { Expenses } from './pages/Expenses';
import { Settings } from './pages/Settings';
import './styles.css';

declare const __BASE_PATH__: string;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={__BASE_PATH__}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/partners" element={<Directories />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${__BASE_PATH__}sw.js`));
}
