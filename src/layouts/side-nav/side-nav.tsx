import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { NAV_ITEMS } from './nav-items';
import { BookOpen } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { NavMenuItem } from './nav-menu-item';
import { QuickLinkMenuItem } from './quick-link-menu-item';
import { QUICK_LINKS } from './quick-links';

interface SideNavProps {
  user: string | null;
}

const SideNav = ({ user }: SideNavProps) => {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="blogManager">
                <Link to="/">
                  <BookOpen />
                  <span className="font-semibold">blogManager</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map(item => (
                  <NavMenuItem key={item.path} {...item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>바로가기</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {QUICK_LINKS.map(link => (
                  <QuickLinkMenuItem key={link.url} {...link} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-12 items-center justify-between border-b px-4">
          <SidebarTrigger />

          {user ? (
            <div>
              {user} 님 반갑습니다 <a href="">로그아웃</a>
            </div>
          ) : (
            <Link className="border rounded-2xl px-2 py-1 hover:bg-black hover:text-white" to="/login">
              로그인
            </Link>
          )}
        </header>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default SideNav;
