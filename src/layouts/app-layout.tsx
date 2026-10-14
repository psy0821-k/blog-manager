import { useState } from 'react';
import SideNav from './side-nav/side-nav';

export function AppLayout() {
  const [user] = useState<string | null>(null);

  return (
    <div>
      <SideNav user={user} />
    </div>
  );
}
