import { TestHookInstaller } from '@/debug/TestHookInstaller';
import { ScrollDriver } from '@/scroll/ScrollDriver';

export default function Home() {
  return (
    <main data-testid="app-root">
      <ScrollDriver />
      <TestHookInstaller />
    </main>
  );
}
