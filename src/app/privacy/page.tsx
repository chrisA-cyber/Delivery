import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
export const metadata: Metadata = { title: "Privacy" };
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy, without the fog machine.">
      <section>
        <h2>What Delivery handles</h2>
        <p>
          When you choose to submit a take, Delivery processes the recording,
          prompt, transcript, scores, and technical request data needed to judge
          and protect the service. Account users may also store a profile,
          history, reactions, challenges, and subscription status.
        </p>
      </section>
      <section>
        <h2>Private by default</h2>
        <p>
          New recordings and results are private unless you explicitly publish
          them. Guest results can be judged without joining the public feed. A
          public share action is a separate choice.
        </p>
      </section>
      <section>
        <h2>AI processing</h2>
        <p>
          Submitted audio is sent to OpenAI for direct audio judgment and
          structured scoring. When Scribe transcription is enabled, it is also
          sent to ElevenLabs for a separate transcript with word timestamps.
          Unsubmitted rehearsals stay in your browser. Provider retention
          depends on the configured account and contract; we do not promise zero
          retention. API credentials remain server-side.
        </p>
      </section>
      <section>
        <h2>Control</h2>
        <p>
          You can delete local guest data in Settings. Signed-in users can make
          their profile private, block performers, download a machine-readable
          personal-data export, remove individual deliveries, or delete their
          account. Deleted public content may persist briefly in caches or in
          copies another person already downloaded.
        </p>
      </section>
      <section>
        <h2>Safety and retention</h2>
        <p>
          We retain only what is needed for the game, abuse prevention, billing,
          and legal obligations. Access is controlled with row-level database
          policies and private storage. Before launch, exact retention periods
          and a support contact must be published for the operating company and
          jurisdiction.
        </p>
      </section>
    </LegalPage>
  );
}
