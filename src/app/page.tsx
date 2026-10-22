import { TestHookInstaller } from '@/debug/TestHookInstaller';
import { ExperienceRoot } from '@/experience/ExperienceRoot';
import { ScrollDriver } from '@/scroll/ScrollDriver';

export default function Home() {
  return (
    <main data-testid="app-root">
      <ExperienceRoot />
      <ScrollDriver />
      <TestHookInstaller />
    </main>
  );
}
