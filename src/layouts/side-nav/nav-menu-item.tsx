import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import type { NavItem } from './nav-items';
import { NavLink, useMatch } from 'react-router-dom';

export function NavMenuItem({ path, label, icon: Icon }: NavItem) {
  const isActive = useMatch({ path, end: path === '/' }) !== null;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
        <NavLink to={path} end={path === '/'}>
          <Icon />
          <span>{label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
