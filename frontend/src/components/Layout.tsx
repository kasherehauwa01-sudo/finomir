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
          <NavLink to="/recognition-journal">Журнал распознавания</NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <nav className="mobile-nav" aria-label="Мобильная навигация">
        <NavLink to="/"><span aria-hidden="true">⌂</span><b>Обзор</b></NavLink>
        <NavLink to="/expenses"><span aria-hidden="true">₽</span><b>Расходы</b></NavLink>
        <NavLink to="/directories"><span aria-hidden="true">▦</span><b>Справочники</b></NavLink>
        <NavLink to="/settings"><span aria-hidden="true">⚙</span><b>Настройки</b></NavLink>
        <NavLink to="/recognition-journal"><span aria-hidden="true">◎</span><b>Журнал</b></NavLink>
      </nav>
    </>
  );
}
