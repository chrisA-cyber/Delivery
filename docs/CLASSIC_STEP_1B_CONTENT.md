# Classic Step 1B — content editorial record

**Editorial review, September 5, 2026. No human playtest results are claimed.** We reviewed every one of the original 72 lines, 36 directions, and six packs. Twenty-seven line slots receive new copy and new `v3-` identities; 45 survive the pass. Twelve directions receive fresh identities for clearer audible instructions, distinct performance choices, or short-line compatibility. The 72 original slots remain 24 Clean / 18 Spicy / 30 Mature; 14 individually reviewed recognizable phrases are now active, for **86 lines / 36 directions / 6 packs** in total (36 Clean / 19 Spicy / 31 Mature).

The five review questions were: is the premise understandable immediately; can it be spoken naturally within 20 seconds; does it support different interpretations; can a direction create a second joke; and is there a reason to replay after reading the reveal once? The table gives the decision, spoken word count, an actual contrasting direction, and an explicit replay-risk flag. All final originals are at most 93 characters. Word count is a technical estimate of reading effort, not a timed human read. “Range” below means an editorial hypothesis: sincere admission, confident declaration, or precise deadpan can each change the speaker’s relationship to the same words. It does not claim three proven funny interpretations.

We kept some familiar setup structures because immediate comprehension matters, but removed duplicate escape/new-identity endings, vague scandal without a reveal, office/calendar filler, and profanity attached merely to raise the rating. Adult tone now includes a bot reading a sext, a sponsored breakup, a casual affair, and a name moaned incorrectly. Clean receives social overcommitment, accidental broadcasts, and humiliating gamer logic.

## Every original line reviewed

All rows passed the editorial comprehension and speakability check after changes. The named direction is the proposed contrast check. Rows marked “watch” have a greater familiarity risk and should be prioritized for skip/replay feedback. Full final copy is in `src/data/content.ts`; exact original copy stays frozen in `src/data/classic-content-v2.ts`.

| Original identity → final identity                     | Decision / comedic premise and range                                                                                   | Words | Contrast direction | Replay risk                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----: | ------------------ | ---------------------------------- |
| `v2-favorite-child`                                    | Keep the instantly understood two-panicking-selves contradiction; strong for quiet resignation or absolute confidence. |    10 | Painfully sincere  | Watch: familiar setup              |
| `v2-apology-draft` → `v3-two-phone-calls`              | Replace. Replace apology without a punchline with an audible three-beat social disaster.                               |    14 | Already won        | Test interpretation variety        |
| `v2-mirror-argument`                                   | Keep the tiny private victory treated as public news; supports both underplayed testimony and pompous triumph.         |    13 | Whispered fury     | Watch: familiar setup              |
| `v2-wrong-door` → `v3-camera-relationship`             | Replace. Replace the unearned marriage jump with a specific ongoing commitment.                                        |    18 | Standing ovation   | Test interpretation variety        |
| `v2-fake-account`                                      | Keep the extra betrayal: even the invented defender caves. Strong final-word turn.                                     |    15 | Under oath         | Test interpretation variety        |
| `v2-villain-budget`                                    | Keep the attainable, petty version of a grand villain fantasy; public transport is the specific deflation.             |    15 | Read the manual    | Watch: familiar format             |
| `v2-crying-hot`                                        | Keep narcissism interrupting sadness; two emotions are already clear in the words.                                     |    13 | Painfully sincere  | Test interpretation variety        |
| `v2-apology-sponsor`                                   | Keep the compact fake-sponsor structure; profanity belongs to the confession.                                          |    11 | Already won        | Test interpretation variety        |
| `v2-emotional-support-lie`                             | Keep the six-year commitment to an absurd first-date lie; no accent imitation required.                                |    16 | Whispered fury     | Test interpretation variety        |
| `v2-blocked-therapist`                                 | Keep the speaker misunderstanding the very service they bought; works sincerely or defensively.                        |    15 | Standing ovation   | Test interpretation variety        |
| `v2-god-favorites` → `v3-banned-list`                  | Replace. Replace an abstract universe joke with a boast reversed by one concrete word.                                 |    15 | Under oath         | Test interpretation variety        |
| `v2-character-witness`                                 | Keep the best friend becoming the prosecution; the isolated final swear is an intentional reaction beat.               |    14 | Read the manual    | Test interpretation variety        |
| `v2-muted-scream`                                      | Keep the neighbors getting exclusive content; voice-only play gives this a direct connection.                          |    14 | Painfully sincere  | Test interpretation variety        |
| `v2-chat-dad`                                          | Keep the repair worker accidentally assigned a family role by chat; short and clean.                                   |    12 | Already won        | Test interpretation variety        |
| `v2-tutorial-betrayal` → `v3-skip-how-to-move`         | Replace. Cut the generic first-mistake tag; let the humiliating search be the reveal.                                  |    10 | Whispered fury     | Test interpretation variety        |
| `v2-sponsor-mom`                                       | Keep the mother dismissing an entire career in two words; the internal quotation is easy to act.                       |    17 | Standing ovation   | Test interpretation variety        |
| `v2-clip-grandma`                                      | Keep the clip escaping into an incongruous audience; exact clip remains open to imagination.                           |    14 | Under oath         | Watch: unspecified clip            |
| `v2-stream-snore`                                      | Keep the insult supplied by audience behavior; no invented real activity count is implied by this fictional line.      |    15 | Read the manual    | Test interpretation variety        |
| `v2-ban-me`                                            | Keep the urgent request for preemptive self-moderation; eight words are enough to pivot into panic.                    |     8 | Painfully sincere  | Test interpretation variety        |
| `v2-open-mic` → `v3-dentist-breedable`                 | Replace. Replace vague implied scandal with a specific adult word in the wrong audience.                               |    12 | Already won        | Test interpretation variety        |
| `v2-sponsor-candle` → `v3-sponsored-breakup`           | Replace. Separate from apology-sponsor; the discount code makes the confession playable.                               |    14 | Whispered fury     | Test interpretation variety        |
| `v2-donation-confession`                               | Keep refusing to read an unspecified confession as a playable refusal; do not add an actual viewer identity.           |    15 | Standing ovation   | Watch: unspecified confession      |
| `v2-clutch-camera`                                     | Keep the dignity failure compounded by still losing. Fictional camera mention never requires player video.             |    17 | Under oath         | Test interpretation variety        |
| `v2-chat-receipts` → `v3-robot-sext`                   | Replace. Replace a generic receipts claim and appended profanity with an actual on-stream disaster.                    |    12 | Read the manual    | Test interpretation variety        |
| `v2-loot-goblin`                                       | Keep the short, indefensible excuse; sincerity supplies the second joke.                                               |    10 | Painfully sincere  | Test interpretation variety        |
| `v2-friendly-fire`                                     | Keep the opposing team expressing gratitude; a clear social reversal of failure.                                       |    15 | Already won        | Test interpretation variety        |
| `v2-boss-second-phase`                                 | Keep the epic conflict stopped by bedtime; a compact conflict that survives multiple deliveries.                       |    10 | Whispered fury     | Test interpretation variety        |
| `v2-training-dummy` → `v3-bot-custody`                 | Replace. Give the passive training-dummy premise a surprising relationship and a clean punch.                          |    13 | Standing ovation   | Test interpretation variety        |
| `v2-voice-crack`                                       | Keep the boast failing before gameplay does; an audible interpretation is built into the premise.                      |    12 | Under oath         | Test interpretation variety        |
| `v2-ranked-breathing`                                  | Keep the speaker protecting their own excuses; anger or tender sincerity changes the joke.                             |    11 | Read the manual    | Test interpretation variety        |
| `v2-controller-alibi` → `v3-single-player-lag`         | Replace. Replace abstract emotional-disconnect phrasing with a confession the player can defend.                       |    12 | Painfully sincere  | Test interpretation variety        |
| `v2-ranked-flirting`                                   | Keep the game/date ambiguity; mature language is integral to the misunderstanding.                                     |    15 | Already won        | Test interpretation variety        |
| `v2-healer-payment`                                    | Keep the healer weaponizing manners; a whispered courteous ultimatum is especially strong.                             |    12 | Whispered fury     | Test interpretation variety        |
| `v2-skill-funeral`                                     | Keep uninstalling as reverence rather than rage; strong ritual or award-speech interpretations.                        |    12 | Standing ovation   | Test interpretation variety        |
| `v2-fall-damage`                                       | Keep the huge survival claim defeated by ordinary stairs; familiar player frustration is the hook.                     |    11 | Under oath         | Watch: familiar gaming frustration |
| `v2-push-to-talk`                                      | Keep the deliberately enabled fart as an irreversible confession; dramatic nobility creates contrast.                  |    16 | Read the manual    | Test interpretation variety        |
| `v2-voice-note-podcast`                                | Keep the accusing review of an overlong voice note; keep it out of suggested three-beat pairings if shortened later.   |    13 | Painfully sincere  | Watch: familiar metaphor           |
| `v2-accidental-like` → `v3-photo-audit`                | Replace. Avoid another new-identity exit; double down on the mistake.                                                  |    15 | Already won        | Test interpretation variety        |
| `v2-reply-everyone`                                    | Keep the familiar automatic reply at an unusually awkward moment; silence between sentences can carry it.              |    14 | Whispered fury     | Watch: familiar setup              |
| `v2-birthday-investigation` → `v3-birthday-without-me` | Replace. Make the betrayal immediate and leave room for hurt or oblivious pride.                                       |    13 | Standing ovation   | Test interpretation variety        |
| `v2-screenshot-spiral` → `v3-screenshot-option-two`    | Replace. Replace the repeated flee-the-country ending with an answer from the victim.                                  |    17 | Under oath         | Test interpretation variety        |
| `v2-typing-hostage`                                    | Keep eleven minutes producing one word; a clean rhythm joke with a sharper social tone.                                |    11 | Read the manual    | Test interpretation variety        |
| `v2-voice-note-laugh` → `v3-full-name-sound-effect`    | Replace. Add a specific threat that can be whispered, confessed, or proudly announced.                                 |    17 | Painfully sincere  | Test interpretation variety        |
| `v2-toilet-unmute`                                     | Keep an intentional flush as an argument; petty certainty is funnier than generic disgust.                             |    14 | Already won        | Test interpretation variety        |
| `v2-group-chat-court` → `v3-subpoena-award`            | Replace. Give the self-protective speaker a shameless conditional reversal.                                            |    18 | Whispered fury     | Test interpretation variety        |
| `v2-nude-printer`                                      | Keep the digital mistake turning into a physical family problem. Adult reading; never pair with a child persona.       |    14 | Standing ovation   | Test interpretation variety        |
| `v2-poop-authorship`                                   | Keep the final sentence removing every alternative suspect; a strong deadpan reveal.                                   |    12 | Under oath         | Test interpretation variety        |
| `v2-autocorrect-funeral`                               | Keep the mistaken sentiment compounded by a balloon; a specific escalating social disaster.                            |    10 | Read the manual    | Test interpretation variety        |
| `v2-date-handshake`                                    | Keep the legal-name response to a kiss; confession and award speech both have a clear target.                          |    14 | Painfully sincere  | Test interpretation variety        |
| `v2-crush-door`                                        | Keep the repeated admission of bowing; awkwardness can be sincere or dignified.                                        |    16 | Already won        | Test interpretation variety        |
| `v2-date-bread` → `v3-drive-through-rehearsal`         | Replace. Remove the arbitrary bread pivot; make private rehearsal accidentally public.                                 |    12 | Whispered fury     | Test interpretation variety        |
| `v2-crush-story` → `v3-thumb-alibi`                    | Replace. Shorten the abstract final sentence into an absurd physical defense.                                          |    12 | Standing ovation   | Test interpretation variety        |
| `v2-date-split` → `v3-no-pressure-question-marks`      | Replace. Replace a familiar bill/self-respect template with audible anxious escalation.                                |    10 | Under oath         | Test interpretation variety        |
| `v2-read-receipt-romance`                              | Keep forced optimism about a one-sided relationship; minimal language leaves room for restraint.                       |    13 | Read the manual    | Watch: familiar format             |
| `v2-hot-red-flag` → `v3-fix-me-estimate`               | Replace. Trade a familiar red-flag aphorism for a reply that can be sincere or offended.                               |    11 | Painfully sincere  | Test interpretation variety        |
| `v2-dirty-talk-weather` → `v3-dirty-service-voice`     | Replace. Remove weather/profanity filler; the performer can make the conflicting voices the joke.                      |    14 | Already won        | Test interpretation variety        |
| `v2-situationship-app` → `v3-casual-wife`              | Replace. Remove random terms-and-conditions phrasing; use a short, adult, uncomfortable reveal.                        |    10 | Whispered fury     | Test interpretation variety        |
| `v2-sexy-voice` → `v3-own-name`                        | Replace. Replace an unclear bank simile with a specific adult confession and shameless turn.                           |    16 | Standing ovation   | Test interpretation variety        |
| `v2-booty-call-carpool`                                | Keep practical hospitality colliding with adult sexual intent; warmth works without extra obscenity.                   |    16 | Under oath         | Test interpretation variety        |
| `v2-date-safe-word`                                    | Keep the double meaning of commitment; avoid adding a mimicked partner or nonconsensual framing.                       |    11 | Read the manual    | Watch: familiar wordplay           |
| `v2-final-boss-refund`                                 | Keep the grand claim over seven dollars; grandeur versus pettiness is immediately playable.                            |    17 | Painfully sincere  | Test interpretation variety        |
| `v2-royal-laundry`                                     | Keep the meeting called to forbid the obvious question; eyebrow evidence makes the omission clear.                     |    16 | Already won        | Test interpretation variety        |
| `v2-destiny-password` → `v3-door-single-combat`        | Replace. Make the foe and cause of failure legible; supports heroism without a random object punchline.                |    14 | Whispered fury     | Test interpretation variety        |
| `v2-evil-laugh`                                        | Keep the dramatic exit defeated by a readable sign; the final effort preserves the character’s pride.                  |    13 | Standing ovation   | Test interpretation variety        |
| `v2-revenge-calendar` → `v3-enemy-has-map`             | Replace. Remove the office/calendar structure and give the defeated speaker a reason to cooperate.                     |    15 | Under oath         | Test interpretation variety        |
| `v2-fear-chihuahua` → `v3-hold-my-hand`                | Replace. Trim the list and turn the boast into a need for comfort.                                                     |    13 | Read the manual    | Test interpretation variety        |
| `v2-power-pose`                                        | Keep the private entrance rehearsal with an unwanted witness; the reveal is quick.                                     |    12 | Painfully sincere  | Test interpretation variety        |
| `v2-god-receipt` → `v3-devil-bank-balance`             | Replace. Give the cosmic boast a concrete rebuttal rather than a rent punchline.                                       |    16 | Already won        | Test interpretation variety        |
| `v2-throne-toilet`                                     | Keep the body interrupting a threat; the drain simile is audible and grotesque rather than abstract.                   |    15 | Whispered fury     | Test interpretation variety        |
| `v2-knees-cracked` → `v3-begging-ambulance`            | Replace. Replace appended profanity with a second speaker misreading the dramatic gesture.                             |    19 | Standing ovation   | Test interpretation variety        |
| `v2-demons-rent` → `v3-two-men-context`                | Replace. Use adult ambiguity with a clear setup; no extra profanity needed.                                            |    15 | Under oath         | Test interpretation variety        |
| `v2-death-speech`                                      | Keep the requested heroic edit exposed by the line itself; a noble last request gives it range.                        |    17 | Read the manual    | Test interpretation variety        |

## Every direction reviewed

Directions ask for audible pace, precision, emotional tension, a pause, or restraint. “Quiet” remains a full performance choice. A `contrast` or `multi-beat` tag requires at least eight words on both client and server; tiny recognizable phrases draw from single-state directions. The SQL Daily selector uses the same condition. Historical directions keep their original instructions and tags.

| Original identity → final identity                  | Editorial decision                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `v2-confidence-tears`                               | Keep confidence against contained tears; one wobble gives a concrete audible target.         |
| `v2-polite-fury`                                    | Keep audible whisper plus courtesy versus fury; no volume escalation required.               |
| `v2-sincere-confession`                             | Keep wholehearted sincerity as a single-state option, including tiny phrases.                |
| `v2-deadpan-evidence`                               | Keep flat testimony and precise pause; distinguish from warmth or monotone indifference.     |
| `v2-apology-smile`                                  | Keep the apology becoming pride; an explicit contrast tag gives it enough runway.            |
| `v2-hold-laugh` → `v3-hold-laugh`                   | Clarify the audible recovery and restrict a three-beat task to longer lines.                 |
| `v2-last-voicemail` → `v3-last-voicemail`           | Replace vague slow revelation with an audible final admission.                               |
| `v2-press-conference-v2` → `v3-press-conference`    | Make the speaker intention immediate and mark the emotional turn.                            |
| `v2-soft-threat` → `v3-soft-threat`                 | Retain restraint; distinguish the turn from a single quiet performance.                      |
| `v2-fake-ad`                                        | Keep persuasive sales emphasis; the worst word becomes the benefit.                          |
| `v2-bedtime-catastrophe` → `v3-bedtime-catastrophe` | Replace a general narrator pose with playable word-level care.                               |
| `v2-betrayed-teammate`                              | Keep hurt becoming outrage; a two-beat interpersonal task.                                   |
| `v2-no-breathless-rush`                             | Keep accidental public speech; controlled panic can be quick without shouting.               |
| `v2-documentary-scandal` → `v3-documentary-scandal` | Distinguish awe from the flat under-oath and instruction-manual deliveries.                  |
| `v2-villain-crack`                                  | Keep menace slipping into neediness and recovery; correctly restricted to longer lines.      |
| `v2-forbidden-whisper`                              | Keep secret-sharing urgency distinct from polite fury.                                       |
| `v2-one-word-break`                                 | Keep deadpan interrupted on one chosen word; gives useful player agency.                     |
| `v2-fake-casual` → `v3-fake-casual`                 | Give awkwardness an audible action instead of relying on backstory.                          |
| `v2-sports-final` → `v3-sports-final`               | Replace ambiguous give-it-everything with pace and timing; volume is optional.               |
| `v2-reverse-meltdown`                               | Keep a de-escalation arc so louder energy is not the only valid trajectory.                  |
| `v2-no-context-pride`                               | Keep moved, grateful pride about inappropriate behavior; single-state and widely compatible. |
| `v2-quiet-winner`                                   | Keep quiet certainty; direct protection for low-volume confidence.                           |
| `v2-horror-realization` → `v3-horror-realization`   | Keep the horror quiet while removing the instruction to become barely audible.               |
| `v2-news-desk` → `v3-news-desk`                     | Differentiate a restrained broadcast from the general held-laugh direction.                  |
| `v2-romantic-disaster`                              | Keep tenderness applied to an unromantic word; sound rather than camera behavior.            |
| `v2-wrong-room`                                     | Keep authority collapsing into social awareness; long-line contrast only.                    |
| `v2-tiny-argument`                                  | Keep unreasonable defensiveness disguised as reason; stress is the audible task.             |
| `v2-hero-last-stand`                                | Keep noble strain with clear words; intensity does not require yelling.                      |
| `v2-smug-explanation`                               | Keep self-satisfaction as an alternative to generic confidence.                              |
| `v2-terrible-good-news`                             | Keep celebration punctured by one doubt and recovery; contrast restriction remains.          |
| `v2-voice-assistant`                                | Keep automated composure briefly becoming embarrassment; no real person imitation.           |
| `v2-bad-interrogation` → `v3-bad-interrogation`     | Make the overcorrection measurable in rhythm and enforce enough words.                       |
| `v2-angry-gratitude`                                | Keep courtesy under tension; suitable for short phrases and quiet control.                   |
| `v2-delayed-laugh` → `v3-manual-serious`            | Replace a near-duplicate of under-oath timing with exact, useful-on-short-lines precision.   |
| `v2-awe-to-disgust`                                 | Keep the distinct wonder/disgust/acceptance arc, with the existing long-line gate.           |
| `v2-tiny-emergency`                                 | Keep urgency in pace while volume stays low; distinct from whisper secrecy.                  |

## Six-pack editorial check

| Pack                | Decision                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public Apology      | Keep failed self-defense and shameless confessions; replaced two weak Clean slots and the abstract universe joke.                                     |
| Clip That           | Keep creator/chat context; replace unspecified microphone scandal with concrete audible consequences. Description now allows recognizable text.       |
| Skill Issue         | Keep actual gamer mistakes; replace emotional-controller abstraction and passive training dummy with legible failures.                                |
| Do Not Forward      | Keep social evidence; replace repeated identity-escape endings and generic praise of one’s own voice note.                                            |
| Down Catastrophic   | Largest rewrite: remove bread/random-object and terms-and-conditions jokes; foreground awkward effort and adult overconfidence.                       |
| Final Boss Behavior | Keep the Pro entitlement and demanding original material, but replace calendar/revenge filler with concrete confrontations and humiliating reversals. |

Pack membership, rating, and compatibility participate in actual server selection and canonical submission checks. No recognition item is exempt from those boundaries. Mature stays explicit opt-in and private through the existing database/publication guards.

## History and rollout

- `classic-content-v2.ts` freezes all 72 lines, 36 directions, and the Daily algorithm. Existing pre-v2 data stays frozen in `legacy-content.ts`.
- New draws use the refined originals and reviewed recognizable subset. Replaced v2 identities remain resolvable with their exact old strings but are retired from new Classic draws.
- Additive migration 017 inserts fresh identities, marks only the replaced v2 line/direction IDs `draw_enabled=false`, and preserves prompt bodies, UUIDs, saved scores, challenge memberships, and canonical Daily slots.
- The bundled September 5, 2026 Daily remains on the frozen v2 algorithm; the v3 bundled algorithm begins September 6. Already persisted database Daily slots win unchanged regardless of date.
- Fresh-install seed includes the same v3 data block as migration 017; old migration 015 remains intact. Insert-on-conflict-do-nothing preserves existing moderation state and never silently republishes an archived row.
- This is content version `classic-content-v3`; it does not change the score formula, rubric version, or historical ranking scale.

## Final counts and published recognizable text

| Pack                |  Clean |  Spicy | Mature | Active total | Access                        |
| ------------------- | -----: | -----: | -----: | -----------: | ----------------------------- |
| Public Apology      |      6 |      3 |      5 |           14 | free                          |
| Clip That           |      7 |      3 |      5 |           15 | free                          |
| Skill Issue         |      6 |      4 |      5 |           15 | free                          |
| Do Not Forward      |      6 |      3 |      5 |           14 | free                          |
| Down Catastrophic   |      6 |      3 |      5 |           14 | rotating                      |
| Final Boss Behavior |      5 |      3 |      6 |           14 | pro                           |
| **Total**           | **36** | **19** | **31** |       **86** | **72 Free/rotating + 14 Pro** |

Published recognizable collection: **14 short text references**. Exact wording, source type, source URLs, original-source uncertainty, dated recognition evidence, rating, and individual publication reasoning are in [CLASSIC_RECOGNIZABLE_LEDGER.md](CLASSIC_RECOGNIZABLE_LEDGER.md) and `src/data/recognizable-content.ts`. This supersedes the Step 1 pending-only shortlist for the subset individually reassessed here. Publication is an editorial text-use decision, not a claim of legal clearance, universal recognizability, current popularity, or creator endorsement. No original audio/video, likeness, artwork, music, or voice imitation is shipped.

| Published phrase                                        | Rating       | Existing pack       |
| ------------------------------------------------------- | ------------ | ------------------- |
| This is fine.                                           | Clean        | Public Apology      |
| My disappointment is immeasurable and my day is ruined. | Clean        | Public Apology      |
| It is Wednesday, my dudes.                              | Clean        | Clip That           |
| Emotional damage!                                       | Clean        | Clip That           |
| Chat, is this real?                                     | Clean        | Clip That           |
| Was that the bite of '87?!                              | Spicy        | Skill Issue         |
| Yeah, this is big brain time.                           | Clean        | Skill Issue         |
| Let him cook.                                           | Clean        | Skill Issue         |
| Touch grass.                                            | Clean        | Do Not Forward      |
| Weird flex, but OK.                                     | Clean        | Do Not Forward      |
| No thoughts, head empty.                                | Clean        | Down Catastrophic   |
| I like turtles.                                         | Clean        | Down Catastrophic   |
| Double rainbow all the way across the sky.              | Clean        | Final Boss Behavior |
| Fuck around and find out.                               | Mature · 18+ | Final Boss Behavior |

## Twenty strongest final combinations

These are **editorial picks**, not player-validated rankings. The direction asks for an independent performance; a familiar source does not ask players to reproduce a creator’s voice. All twenty are actual compatible catalog combinations.

| #   | Line                                                                                   | Direction                                                                                                          | Content level |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------- |
| 1   | This is fine.                                                                          | Whisper a furious outburst with immaculate politeness. Keep every word audible.                                    | Clean         |
| 2   | It is Wednesday, my dudes.                                                             | Give flat, precise testimony. Pause before the most embarrassing detail; do not wink at the joke.                  | Clean         |
| 3   | My disappointment is immeasurable and my day is ruined.                                | Accept an award for this exact behavior. Sound moved, grateful, and completely unashamed.                          | Clean         |
| 4   | Was that the bite of '87?!                                                             | Read this as a vital instruction from an appliance manual. Give one absurd word painfully precise emphasis.        | Spicy         |
| 5   | Emotional damage!                                                                      | Make it a tender declaration of love. Commit especially hard to the least romantic word.                           | Clean         |
| 6   | I liked their old photo, panicked, and liked twelve more. It is an audit now.          | Speak softly and slowly, with the certainty of someone who has already won. No raised voice.                       | Clean         |
| 7   | I faked a phone call to avoid someone. My phone rang. I answered both.                 | Try painfully hard to sound casual. Add a tiny nervous laugh, then pretend you never made it.                      | Clean         |
| 8   | I have been screaming on mute for six minutes. The neighbors got the exclusive.        | Sound outrageously confident while holding back tears; let one word wobble, then recover.                          | Clean         |
| 9   | They leaned in for a kiss. I panicked and said my full legal name.                     | Accept an award for this exact behavior. Sound moved, grateful, and completely unashamed.                          | Clean         |
| 10  | I made a fake account to defend myself. It got bullied into agreeing with them.        | Give flat, precise testimony. Pause before the most embarrassing detail; do not wink at the joke.                  | Spicy         |
| 11  | I sent them the screenshot of me asking how to reply to them. They said "option two."  | Deliver a wounded hero’s final request. Keep the words clear and make the ending absurdly noble.                   | Spicy         |
| 12  | I said "no pressure" and sent three question marks. Separately.                        | Whisper an urgent secret to someone beside you. Be intense without raising your volume.                            | Spicy         |
| 13  | I am the healer. Say please or die with your fucking principles.                       | Whisper a furious outburst with immaculate politeness. Keep every word audible.                                    | Mature · 18+  |
| 14  | The donation robot just read my sext. It pronounced every fucking emoji.               | Brief someone on a crisis in a low, steady voice. Put urgency into the pace, not the volume.                       | Mature · 18+  |
| 15  | This breakup is sponsored. Use code ABANDONED for ten percent off my fucking mattress. | Leave a voicemail pretending everything is fine. Let the final few words give away how badly you need a call back. | Mature · 18+  |
| 16  | We are keeping it casual. I have met his wife.                                         | Start with a soft apology; become audibly proud halfway through, then pretend you did not.                         | Mature · 18+  |
| 17  | I tried to moan their name and said my own. Honestly? Best sex of my life.             | Accept an award for this exact behavior. Sound moved, grateful, and completely unashamed.                          | Mature · 18+  |
| 18  | I tried to send a nude and accidentally selected the printer. Dad is downstairs.       | Read the news with crisp professionalism. Let a laugh threaten one word, swallow it, and keep broadcasting.        | Mature · 18+  |
| 19  | I told everyone I could take two men at once. Apparently the context was important.    | Confess with total sincerity, as if this is the bravest thing you have ever admitted.                              | Mature · 18+  |
| 20  | Autocorrect changed "condolences" to "congratulations." I sent a fucking balloon.      | Make it a tender declaration of love. Commit especially hard to the least romantic word.                           | Mature · 18+  |

## Content verification

- `node node_modules/vitest/vitest.mjs run src/lib/content/content.test.ts src/lib/server/random-content.test.ts src/lib/server/content-resolution.test.ts src/lib/server/challenge-creation.test.ts`: **49 passing tests** at content integration. Covers exact seed/catalog copy, all 14 reviewed source records, current counts/ratings, active draw filtering and exclusions, short-line compatibility, immutable full v2 lookup, retired-line/direction denial for new Classic, Daily history, and challenge creation consent/entitlements.
- Additive migration 017 and fresh seed contain identical v3 catalog blocks. 014–016 and the old v2 seed block are preserved. Root/database subagent owns the actual PostgreSQL and pgTAP execution report; those outcomes should be read from the Step 1B handoff, not inferred from this string-parity test.
- Human spoken rhythm, funny/weak ratings, recognition, skip reasons, and voluntary replay remain unmeasured. Prioritize the table’s familiarity-risk entries and both two-word phrases in the prepared human playtest.
