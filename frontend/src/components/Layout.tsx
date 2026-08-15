import { NavLink, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <>
      <header>
        <nav aria-label="Основная навигация">
          <NavLink to="/">Дашборд</NavLink>
          <NavLink to="/expenses">Расходы</NavLink>
          <NavLink to="/directories">Справочники</NavLink>
          <NavLink to="/settings">Настройки</NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <nav className="mobile-nav" aria-label="Мобильная навигация">
        <NavLink to="/">Обзор</NavLink>
        <NavLink to="/expenses">Расходы</NavLink>
        <NavLink to="/directories">Справочники</NavLink>
        <NavLink to="/settings">Настройки</NavLink>
      </nav>
    </>
  );
}
