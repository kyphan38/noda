import { AuthPage } from '@/components/AuthPage';
import { MistakesView } from '@/components/MistakesView';
import { TalkMistakesList } from '@/components/talk/TalkMistakesList';

export default function MistakesPage() {
  return (
    <AuthPage title="Mistakes">
      <TalkMistakesList />
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-400">Dictation</h2>
        <MistakesView />
      </section>
    </AuthPage>
  );
}
