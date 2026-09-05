# Classic: six-person playtest kit

**Status: ready materials; zero participants recruited or tested.** Acceptance criteria below are proposals, not measured results. Plan six sessions (20–25 minutes), with two optional replacements. Include at least two people who prefer camera-free participation, two regular online-video/meme viewers, and two occasional viewers. Include solo players; do not require streaming experience. Use adults for this first cohort; Mature is optional, never the default or a test requirement.

## Two distinct sessions

The current local preview can support a **flow/content pilot**. It has real local voice capture and playback, but a visibly labeled fixture judge. Tell participants that before starting; skip score-credibility measurement. Do not interpret fixture reactions as judging validation.

Run the **complete product playtest** only after an authorized OpenAI key and an isolated Supabase environment support live judging and friend challenges. Run the technical smoke checks first. Both modes can reveal confusing controls, weak prompts, comfort, and voluntary replay; only the live mode supports feedback-credibility observations. Never tell participants a fixture score is real.

## Facilitator preparation

1. Start the review build using `docs/CLASSIC_STEP_1B_HANDOFF.md`. Use desktop and an actual mobile device where a reviewed secure test origin is available; `127.0.0.1` on a phone points to that phone. Do not expose the development server or disable browser microphone security to work around this.
2. Open `feedback.html` locally; it needs no server and makes no network requests. Use a fresh form per participant. Export its JSON locally before closing. Use `observations.csv` for timestamped notes and one row per event. Participant IDs P01–P08 are placeholders, not actual people.
3. Record build/branch, date, viewport/device/browser, live vs fixture judge, guest vs test account, and provider/model versions. Do not write keys, real names, emails, or auth tokens in notes. Keep optional consent receipts and recordings in a private folder outside the repository.
4. Reset content to Clean and mute preferences to the participant's choice. Keep the participant’s microphone selection and normal volume. Do not pre-grant permissions invisibly. For signed-in sessions use isolated test accounts only. Have one prepared test recipient for the friend-challenge task; no unsolicited invitations.
5. Ask permission for observation. Separately ask for any screen/audio recording and provider processing. Declining recorded research must not prevent an observed local flow pilot. Set a deletion date and withdrawal contact before collecting research recordings. No camera is needed or requested.

## Opening script (read verbatim)

“We’re testing Delivery, not your voice or whether you’re funny. You can stay off camera, skip any line, choose Clean, or stop whenever you want. Please say what you expect a button to do and tell me when something feels confusing. I’ll mostly watch rather than teach you. Your take stays in this page until you submit it. In a live session, submission sends audio to the disclosed AI providers; it does not publish the take. Research recording is a separate choice.”

For the local pilot add: “This build uses a labeled practice judge. Its scores and feedback are fixtures and do not reflect your performance. We will test real feedback in a later session.”

## Tasks: landing → challenge

| Step | Task to say | Observe without coaching |
|---|---|---|
| 1 | “From this page, find a way to play one round.” | Time to primary play action; what they believe the game does; whether they expect a camera. |
| 2 | “Pick a line you are willing to perform. Change it if you want.” | Readability, recognition without hints, skipped IDs/reasons, whether New line changes the expected things, whether they find content choices. |
| 3 | “Make a take you would be comfortable sending.” | Permission comprehension, time to recording, direction comprehension, rehearsal/retake choices, quiet delivery confidence. Never say they must be louder. |
| 4 | “Listen to it. Keep it or try again.” | Playback discovery, whether they hear their voice, retake effort, whether they think a take already left the device. |
| 5 | “Submit when you’re ready.” | Understanding of private submission, waiting tolerance, errors; if a live failure occurs, observe same-take recovery without making a new paid call unless budget allows. |
| 6 | “What does this result tell you? What would you change?” | Live sessions only: ask them to point to one audible moment supporting or contradicting the feedback. Record transcript mistakes separately from direction/comedy disagreement. |
| 7 | “Do whatever you’d naturally do next.” | **Do not ask for another round yet.** Record voluntary replay, same-direction retry, new round, share, or exit; later ask why. Then ask them to try another round if they did not. |
| 8 | “Set up this line for the prepared test friend.” | Entry-point discovery, preserved line/direction, sign-in/entitlement friction. Stop before an external invitation. In the local pilot, record the actual configuration/sign-in block instead of claiming completion. |

After the first round, allow two more voluntary rounds and one optional content-level change. Do not prompt recognition with creator names. Ask “Does this remind you of anything?” first, then record unaided recognition vs recognition after a hint separately. Alternate two preselected lines across participants to compare reactions; do not force identical acting.

## Debrief (feedback.html contains these)

- Funniest and weakest lines, preferably exact prompt IDs; what made each work or fail?
- Did the direction add a second joke or make the line harder to perform? Which part?
- Did you recognize a phrase unaided? Where from? Recognition and finding it funny are separate.
- How comfortable was camera-free play? Any pressure to share, raise volume, choose adult content, or perform an accent?
- In a live session: which feedback claim could you verify by replaying? What sounded invented? Was the coach note usable without contradicting the direction?
- Would you play another round alone, challenge a friend, or bring this on stream? Ask why after the rating; do not count a polite “yes” as behavior.

## Proposed decision criteria (set before the sessions)

- At least 5/6 start a recording within 90 seconds without facilitator instruction, excluding explicit OS permission troubleshooting (report those cases separately).
- At least 5/6 find playback and retake unaided; at least 5/6 correctly explain that submitting is private provider processing, not publication.
- At least 4/6 voluntarily choose a new round or same-direction retry before being prompted. Report behavior separately from stated intention.
- At least 4/6 identify one genuinely funny line and direction combination; replace any line skipped by 3+ people for confusion or discomfort at its selected rating. Laughter is useful evidence, not a required personal reaction.
- Both camera-uncomfortable participants rate camera-free completeness at least 4/5, without pressure to enable a camera.
- Live-only: at least 4/6 can connect a feedback claim to an audible moment and name an actionable change; investigate every fabricated transcript or direction-contradicting note. Do not average away failures or claim objective comedy accuracy.
- No unintended publication, consent bypass, lost recoverable take, duplicate persisted attempt, or cross-user access. Any such defect blocks broader testing regardless of satisfaction scores.

Six people are a qualitative signal, not a statistically representative population or proof of accent/device fairness. Record actual counts and contrary evidence. Do not start Switch based solely on a passing interface test.

## Optional judging recording session (separate consent)

Use `docs/evaluation/manifest.example.json` and `docs/JUDGING_EVALUATION.md`. Collect accurate expressive, deliberately flat, quiet deadpan, true whispered, loud but wrong-direction, omitted/wrong words, alternate interpretation, room-noise, silence/unintelligible, and spoken-instruction cases. Attenuated speech is not a substitute for a whisper. Have two listeners independently transcribe what was actually spoken, including mistakes; resolve or retain disagreements before viewing AI transcripts.

Propose at most **16 scored attempts**, including three identical-byte repeats, maximum 20 seconds each. Each can call Scribe once and OpenAI up to twice for bounded format repair. Obtain a fresh explicit spend limit using current prices before any human live run; the approved synthetic Scribe batch does not authorize this. No human recordings or consent receipts are bundled here. Record latency, model/rubric/score version, transcript disagreement, paired direction fit, gain effects, repeated-score range, and grounded coaching separately from enjoyment. Predefine investigation thresholds, e.g. >15-point repeated overall range or >10-point commitment advantage for loud wrong-direction over quiet correct-direction; these are triage triggers, not validated pass/fail truths.

## Completion record

Current actual results: **0 human sessions; 0 consented human recordings; all proposed criteria unmeasured.** After each real session, export the form, review event notes, and summarize denominators/exclusions. Keep private speech and participant data out of Git. Delete recordings, transcripts, exports, and derived data by the agreed date.
