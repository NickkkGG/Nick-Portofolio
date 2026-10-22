import { TestHookInstaller } from '@/debug/TestHookInstaller';
import { ExperienceRoot } from '@/experience/ExperienceRoot';
import { ScrollDriver } from '@/scroll/ScrollDriver';
import { ContentDocument } from '@/ui/ContentDocument';
import { Overlay } from '@/ui/Overlay';

export default function Home() {
  return (
    <main data-testid="app-root">
      <ContentDocument />
      <ExperienceRoot />
      <ScrollDriver />
      <Overlay />
      <TestHookInstaller />
    </main>
  );
}
