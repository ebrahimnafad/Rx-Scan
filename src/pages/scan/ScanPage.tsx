// pages/scan/ScanPage.tsx
import { useQuery } from '@tanstack/react-query';
import { ScanDeck } from '@/widgets/scan-deck/ScanDeck';
import { getSettings } from '@/app/db';

export default function ScanPage() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    staleTime: 30_000,
  });

  return (
    <div className="pb-28">
      <ScanDeck settings={settings} />
    </div>
  );
}
