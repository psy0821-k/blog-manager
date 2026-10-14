import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import type { QuickLink } from './quick-links';

export function QuickLinkMenuItem({ url, label, icon: Icon }: QuickLink) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={label}>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Icon />
          <span>{label}</span>
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
