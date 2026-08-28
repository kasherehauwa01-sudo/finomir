import { NavLink, Outlet } from 'react-router-dom';
import { NAVIGATION_ITEMS } from '../config/navigation';

export function Layout() {
  const location = useLocation();
  return (
    <>
      <header>
        <nav aria-label="Основная навигация">
          {NAVIGATION_ITEMS.map((item) => <NavLink key={item.path} to={item.path}>{item.label}</NavLink>)}
        </nav>
      </header>
      <main className={location.pathname === '/expenses' ? 'expenses-wide' : undefined}>
        <Outlet />
      </main>
      <nav className="mobile-nav" aria-label="Мобильная навигация">
        {NAVIGATION_ITEMS.map((item) => <NavLink key={item.path} to={item.path}><span aria-hidden="true">{item.icon}</span><b>{item.mobileLabel}</b></NavLink>)}
      </nav>
    </>
  );
}
