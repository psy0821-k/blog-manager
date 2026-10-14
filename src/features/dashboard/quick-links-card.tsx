import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QUICK_LINKS } from '@/layouts/side-nav/quick-links';

/** 자주 쓰는 사이트를 아이콘 그리드로 보여 준다. 데이터는 사이드바 바로가기와 공유한다. */
export function QuickLinksCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>자주 사용하는 사이트</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-3 gap-3">
          {QUICK_LINKS.map(({ url, label, icon: Icon }) => (
            <li key={url}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 rounded-lg p-2 text-xs hover:bg-muted"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="size-5" />
                </span>
                <span className="truncate">{label}</span>
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
