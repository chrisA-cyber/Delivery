-- Classic v2 additive catalog refresh. Requires committed 014.
-- Existing bodies, directions, UUIDs, memberships, Daily slots, deliveries and scores
-- are never rewritten. Only draw eligibility changes for the explicit legacy list.
-- Newly published content has new v2 IDs. Re-running this block does not resurrect
-- archived/moderated v2 content: immutable rows use DO NOTHING on conflicts.
-- BEGIN CLASSIC V2 CATALOG
insert into public.content_packs (
  slug, name, eyebrow, description, access, state, categories,
  color, accent, icon, cover_tone, sort_order, featured, draw_enabled
) values
  ('internet-originals','Public Apology','Main character damage','Confessions, delusions, and apologies that somehow make it worse.','free','published',array['main-character'],'#D7FF3F','#121116','spark','internet-originals',10,true,true),
  ('stream-gremlins','Clip That','Chat has the receipts','Original streamer meltdowns. The microphone was definitely on.','free','published',array['streamer-mode'],'#A87CFF','#121116','live','stream-gremlins',20,true,true),
  ('gaming-comms','Skill Issue','Your team heard that','Failed clutches, hostile tutorials, and excuses with zero evidence.','free','published',array['gaming'],'#69F0AE','#121116','controller','gaming-comms',30,false,true),
  ('group-chat-evidence','Do Not Forward','The voice note stays here','Private confessions and social disasters with no plausible deniability.','free','published',array['group-chat'],'#FFB84D','#121116','bubble','group-chat-evidence',40,true,true),
  ('romance-rejection','Down Catastrophic','Read. Regret. Repeat.','Flirting, bad dates, and dignity left on read.','rotating','published',array['romance'],'#FF78C8','#121116','heart-crack','romance-rejection',50,false,true),
  ('impossible-energy','Final Boss Behavior','Pro: emotional whiplash','Grand declarations for people who absolutely cannot back them up.','pro','published',array['wildcard'],'#FF7448','#121116','warning','impossible-energy',60,false,true)
on conflict (slug) do update set
  name = excluded.name, eyebrow = excluded.eyebrow, description = excluded.description,
  color = excluded.color, accent = excluded.accent, icon = excluded.icon,
  cover_tone = excluded.cover_tone, sort_order = excluded.sort_order,
  featured = excluded.featured;

insert into public.energy_modifiers (slug, instruction, short_label, intensity, tags, state, draw_enabled)
values
  ('v2-confidence-tears','Sound outrageously confident while holding back tears; let one word wobble, then recover.','Winning. Barely.',4,array['confident','strained','contrast'],'published',true),
  ('v2-polite-fury','Whisper a furious outburst with immaculate politeness. Keep every word audible.','Whispered fury',3,array['quiet','whisper','angry'],'published',true),
  ('v2-sincere-confession','Confess with total sincerity, as if this is the bravest thing you have ever admitted.','Painfully sincere',2,array['quiet','sincere','confessional'],'published',true),
  ('v2-deadpan-evidence','Give flat, precise testimony. Pause before the most embarrassing detail; do not wink at the joke.','Under oath',1,array['quiet','deadpan','timing'],'published',true),
  ('v2-apology-smile','Start with a soft apology; become audibly proud halfway through, then pretend you did not.','Sorry you noticed',3,array['apology','contrast'],'published',true),
  ('v2-hold-laugh','Try desperately not to laugh. Let one breath escape, then finish with rigid seriousness.','Absolutely serious',3,array['restrained','comedy'],'published',true),
  ('v2-last-voicemail','Leave a calm voicemail that slowly reveals you are having the worst night of your life.','Please call back',3,array['confessional','escalating'],'published',true),
  ('v2-press-conference-v2','Answer like a disgraced champion. Start defensive and finish as though you somehow won.','No further questions',4,array['defensive','confident'],'published',true),
  ('v2-soft-threat','Use a warm, gentle voice that gets colder on the final phrase. No shouting.','Sweet little threat',2,array['quiet','controlled','villain'],'published',true),
  ('v2-fake-ad','Pitch every word like an irresistible deal. Make the worst detail your big selling point.','Buy my disaster',4,array['sales','confident'],'published',true),
  ('v2-bedtime-catastrophe','Tell it as a soothing bedtime story for adults. Make the absurd detail sound comforting.','Sleep tight',1,array['quiet','gentle'],'published',true),
  ('v2-betrayed-teammate','Speak to your most trusted teammate after a betrayal. Hurt first; outrage at the end.','You promised',4,array['hurt','contrast'],'published',true),
  ('v2-no-breathless-rush','Start casually, realize everyone can hear you, and finish in tightly controlled panic.','Missed the mute',4,array['panic','contrast'],'published',true),
  ('v2-documentary-scandal','Explain it like an awestruck documentary narrator witnessing behavior never seen before.','Rare behavior',2,array['deadpan','wonder'],'published',true),
  ('v2-villain-crack','Begin with smooth villain menace, accidentally sound needy, then claw back your authority.','Evil. Mostly.',4,array['villain','contrast'],'published',true),
  ('v2-forbidden-whisper','Whisper an urgent secret to someone beside you. Be intense without raising your volume.','Do not wake them',2,array['quiet','whisper','urgent'],'published',true),
  ('v2-one-word-break','Keep a completely level voice until one important word; crack emotionally there, then go flat again.','The word that broke you',3,array['quiet','deadpan','contrast'],'published',true),
  ('v2-fake-casual','Record the voice note like it took eight attempts to sound casual. Hide nerves under a breezy finish.','Obviously casual',2,array['awkward','restrained'],'published',true),
  ('v2-sports-final','Call it like the final seconds of a championship: build suspense, then give the ending everything.','Last seconds',5,array['broadcast','escalating'],'published',true),
  ('v2-reverse-meltdown','Begin on the edge of a meltdown. Force your voice back into calm by the last few words.','Get it together',4,array['contrast','controlled'],'published',true),
  ('v2-no-context-pride','Accept an award for this exact behavior. Sound moved, grateful, and completely unashamed.','Standing ovation',3,array['proud','sincere'],'published',true),
  ('v2-quiet-winner','Speak softly and slowly, with the certainty of someone who has already won. No raised voice.','Already won',1,array['quiet','confident'],'published',true),
  ('v2-horror-realization','Begin as an ordinary observation. Pause as the meaning sinks in; finish in barely audible horror.','Oh. Oh no.',3,array['quiet','eerie','contrast'],'published',true),
  ('v2-news-desk','Report breaking news professionally while an increasingly obvious laugh threatens your composure.','Keep broadcasting',3,array['broadcast','restrained'],'published',true),
  ('v2-romantic-disaster','Make it a tender declaration of love. Commit especially hard to the least romantic word.','This is love',2,array['gentle','romance'],'published',true),
  ('v2-wrong-room','Start with bold authority. Realize halfway through you are in the wrong room; finish anyway.','Wrong audience',4,array['awkward','contrast'],'published',true),
  ('v2-tiny-argument','Try to sound reasonable while clearly losing an argument. Stress the detail nobody believes.','Losing the argument',3,array['defensive','timing'],'published',true),
  ('v2-hero-last-stand','Deliver a wounded hero’s final request. Keep the words clear and make the ending absurdly noble.','One last request',4,array['dramatic','strained'],'published',true),
  ('v2-smug-explanation','Explain it with unbearable smugness. Treat the final detail as proof of your genius.','As I predicted',3,array['confident','comedy'],'published',true),
  ('v2-terrible-good-news','Announce it as wonderful news. Let doubt flash through once, then double down on the celebration.','Great news, somehow',4,array['victorious','contrast'],'published',true),
  ('v2-voice-assistant','Use a smooth automated voice that briefly glitches into real embarrassment, then resets.','Human mode failed',3,array['robotic','contrast'],'published',true),
  ('v2-bad-interrogation','Sound calmly innocent until the crucial detail. Rush that part, then overcorrect into calm.','You cannot prove it',3,array['nervous','timing'],'published',true),
  ('v2-angry-gratitude','Sound intensely grateful through clenched frustration. Make the courtesy unmistakable.','Thank you so much',3,array['polite','angry'],'published',true),
  ('v2-delayed-laugh','Deliver the setup plainly, pause before the final phrase, and land it with perfect seriousness.','Wait for it',2,array['quiet','deadpan','timing'],'published',true),
  ('v2-awe-to-disgust','Start in genuine wonder. Gradually realize this is disgusting; finish with defeated acceptance.','What a miracle',4,array['contrast','disgust'],'published',true),
  ('v2-tiny-emergency','Brief someone on a crisis in a low, steady voice. Put urgency into the pace, not the volume.','Controlled emergency',2,array['quiet','controlled','urgent'],'published',true)
on conflict (slug) do nothing;

with prompt_seed(pack_slug, category, difficulty, rating, scoring_focus, slug, body, tags) as (
  values
    ('internet-originals','main-character',1,'everyone',array['commitment','accuracy'],'v2-favorite-child','I am my own emergency contact. We are both panicking.',array['main-character','confession']),
    ('internet-originals','main-character',1,'everyone',array['commitment','accuracy'],'v2-apology-draft','I would like to apologize to everyone who saw me run for that bus.',array['main-character','boast']),
    ('internet-originals','main-character',1,'everyone',array['commitment','accuracy'],'v2-mirror-argument','I won an argument in the shower. I have called a press conference.',array['main-character','confession']),
    ('internet-originals','main-character',1,'everyone',array['commitment','accuracy'],'v2-wrong-door','I waved back at a person waving at someone behind me. We are married now.',array['main-character','boast']),
    ('internet-originals','main-character',2,'teen',array['commitment','accuracy'],'v2-fake-account','I made a fake account to defend myself. It got bullied into agreeing with them.',array['main-character','confession']),
    ('internet-originals','main-character',2,'teen',array['commitment','accuracy'],'v2-villain-budget','I cannot afford a villain era. I have to be a problem on public transport.',array['main-character','boast']),
    ('internet-originals','main-character',2,'teen',array['commitment','accuracy'],'v2-crying-hot','I checked the mirror while crying. The sadness can wait. I look incredible.',array['main-character','confession']),
    ('internet-originals','main-character',2,'mature',array['commitment','accuracy'],'v2-apology-sponsor','This apology is sponsored by the consequences of my own bullshit.',array['main-character','boast']),
    ('internet-originals','main-character',2,'mature',array['commitment','accuracy'],'v2-emotional-support-lie','I faked a British accent on a first date. We have been married six fucking years.',array['main-character','confession']),
    ('internet-originals','main-character',2,'mature',array['commitment','accuracy'],'v2-blocked-therapist','I blocked my therapist. She kept bringing up things I specifically paid her to hear.',array['main-character','boast']),
    ('internet-originals','main-character',2,'mature',array['commitment','accuracy'],'v2-god-favorites','The universe put me in charge of my own life. Bold fucking choice.',array['main-character','confession']),
    ('internet-originals','main-character',2,'mature',array['commitment','accuracy'],'v2-character-witness','I asked for a character witness. My best friend said, "For the prosecution?" Fuck.',array['main-character','boast']),
    ('stream-gremlins','streamer-mode',1,'everyone',array['commitment','accuracy'],'v2-muted-scream','I have been screaming on mute for six minutes. The neighbors got the exclusive.',array['streamer-mode','confession']),
    ('stream-gremlins','streamer-mode',1,'everyone',array['commitment','accuracy'],'v2-chat-dad','Chat, stop calling him Dad. He is here to fix the internet.',array['streamer-mode','boast']),
    ('stream-gremlins','streamer-mode',1,'everyone',array['commitment','accuracy'],'v2-tutorial-betrayal','I skipped the tutorial because I respect myself. That was my first mistake.',array['streamer-mode','confession']),
    ('stream-gremlins','streamer-mode',1,'everyone',array['commitment','accuracy'],'v2-sponsor-mom','My mom asked what I do for work. I showed her the clip. She said, "Besides that."',array['streamer-mode','boast']),
    ('stream-gremlins','streamer-mode',2,'teen',array['commitment','accuracy'],'v2-clip-grandma','Who sent that clip to my grandma? She has started saying it at church.',array['streamer-mode','confession']),
    ('stream-gremlins','streamer-mode',2,'teen',array['commitment','accuracy'],'v2-stream-snore','I fell asleep on stream and gained viewers. The audience has made its position clear.',array['streamer-mode','boast']),
    ('stream-gremlins','streamer-mode',2,'teen',array['commitment','accuracy'],'v2-ban-me','Mods, ban me before I finish this sentence.',array['streamer-mode','confession']),
    ('stream-gremlins','streamer-mode',2,'mature',array['commitment','accuracy'],'v2-open-mic','The mic was on. The door was open. My entire bloodline heard that shit.',array['streamer-mode','boast']),
    ('stream-gremlins','streamer-mode',2,'mature',array['commitment','accuracy'],'v2-sponsor-candle','I cannot say the sponsor name while crying. It makes the apology sound like a fucking ad.',array['streamer-mode','confession']),
    ('stream-gremlins','streamer-mode',2,'mature',array['commitment','accuracy'],'v2-donation-confession','Thank you for the five dollars. I am not reading that fucking confession out loud.',array['streamer-mode','boast']),
    ('stream-gremlins','streamer-mode',2,'mature',array['commitment','accuracy'],'v2-clutch-camera','I turned the camera off to lock in. I was naked from the waist down and losing.',array['streamer-mode','confession']),
    ('stream-gremlins','streamer-mode',2,'mature',array['commitment','accuracy'],'v2-chat-receipts','Chat has receipts. I have a headache and a legally useless pinky promise. Fuck.',array['streamer-mode','boast']),
    ('gaming-comms','gaming',1,'everyone',array['commitment','accuracy'],'v2-loot-goblin','I did not abandon the team. I heard a chest.',array['gaming','confession']),
    ('gaming-comms','gaming',1,'everyone',array['commitment','accuracy'],'v2-friendly-fire','The enemy team invited me back. They said I helped more than their fifth player.',array['gaming','boast']),
    ('gaming-comms','gaming',1,'everyone',array['commitment','accuracy'],'v2-boss-second-phase','The boss has a second phase. I have a bedtime.',array['gaming','confession']),
    ('gaming-comms','gaming',1,'everyone',array['commitment','accuracy'],'v2-training-dummy','The training dummy is studying my mistakes. I can feel it getting confident.',array['gaming','boast']),
    ('gaming-comms','gaming',2,'teen',array['commitment','accuracy'],'v2-voice-crack','I said "watch this" and my voice cracked before my character died.',array['gaming','confession']),
    ('gaming-comms','gaming',2,'teen',array['commitment','accuracy'],'v2-ranked-breathing','Stop breathing into the mic. I cannot hear myself making excuses.',array['gaming','boast']),
    ('gaming-comms','gaming',2,'teen',array['commitment','accuracy'],'v2-controller-alibi','My controller disconnected emotionally. The buttons still worked.',array['gaming','confession']),
    ('gaming-comms','gaming',2,'mature',array['commitment','accuracy'],'v2-ranked-flirting','I said "get fucked" to the boss. My date thought I was talking to them.',array['gaming','boast']),
    ('gaming-comms','gaming',2,'mature',array['commitment','accuracy'],'v2-healer-payment','I am the healer. Say please or die with your fucking principles.',array['gaming','confession']),
    ('gaming-comms','gaming',2,'mature',array['commitment','accuracy'],'v2-skill-funeral','I uninstalled out of respect for the people who made this shit.',array['gaming','boast']),
    ('gaming-comms','gaming',2,'mature',array['commitment','accuracy'],'v2-fall-damage','I survived the apocalypse and died walking down some fucking stairs.',array['gaming','confession']),
    ('gaming-comms','gaming',2,'mature',array['commitment','accuracy'],'v2-push-to-talk','I used push-to-talk to fart. I need to leave this server and start a new life.',array['gaming','boast']),
    ('group-chat-evidence','group-chat',1,'everyone',array['commitment','accuracy'],'v2-voice-note-podcast','That was not a voice note. That was a hostage situation with chapters.',array['group-chat','confession']),
    ('group-chat-evidence','group-chat',1,'everyone',array['commitment','accuracy'],'v2-accidental-like','I liked a photo from six years ago. I am moving countries before they wake up.',array['group-chat','boast']),
    ('group-chat-evidence','group-chat',1,'everyone',array['commitment','accuracy'],'v2-reply-everyone','I said "you too" when the dentist said "open wide." Neither of us recovered.',array['group-chat','confession']),
    ('group-chat-evidence','group-chat',1,'everyone',array['commitment','accuracy'],'v2-birthday-investigation','I wished myself happy birthday from the group account. Nobody corrected me.',array['group-chat','boast']),
    ('group-chat-evidence','group-chat',2,'teen',array['commitment','accuracy'],'v2-screenshot-spiral','I sent the screenshot to the person in the screenshot. I need a new identity.',array['group-chat','confession']),
    ('group-chat-evidence','group-chat',2,'teen',array['commitment','accuracy'],'v2-typing-hostage','I have been typing for eleven minutes. The message is "okay."',array['group-chat','boast']),
    ('group-chat-evidence','group-chat',2,'teen',array['commitment','accuracy'],'v2-voice-note-laugh','I laughed at my own voice note before sending it. That is quality control.',array['group-chat','confession']),
    ('group-chat-evidence','group-chat',2,'mature',array['commitment','accuracy'],'v2-toilet-unmute','I unmuted to flush so they would know I was done with this conversation.',array['group-chat','boast']),
    ('group-chat-evidence','group-chat',2,'mature',array['commitment','accuracy'],'v2-group-chat-court','If this group chat leaks, we are all going to court in matching fucking outfits.',array['group-chat','confession']),
    ('group-chat-evidence','group-chat',2,'mature',array['commitment','accuracy'],'v2-nude-printer','I tried to send a nude and accidentally selected the printer. Dad is downstairs.',array['group-chat','boast']),
    ('group-chat-evidence','group-chat',2,'mature',array['commitment','accuracy'],'v2-poop-authorship','Someone used my bathroom and left a crime scene. I live alone.',array['group-chat','confession']),
    ('group-chat-evidence','group-chat',2,'mature',array['commitment','accuracy'],'v2-autocorrect-funeral','Autocorrect changed "condolences" to "congratulations." I sent a fucking balloon.',array['group-chat','boast']),
    ('romance-rejection','romance',1,'everyone',array['commitment','accuracy'],'v2-date-handshake','They leaned in for a kiss. I panicked and said my full legal name.',array['romance','confession']),
    ('romance-rejection','romance',1,'everyone',array['commitment','accuracy'],'v2-crush-door','I held the door for my crush and bowed. I do not know why I bowed.',array['romance','boast']),
    ('romance-rejection','romance',1,'everyone',array['commitment','accuracy'],'v2-date-bread','I said I wanted something serious. They brought out the bread basket. I stayed.',array['romance','confession']),
    ('romance-rejection','romance',1,'everyone',array['commitment','accuracy'],'v2-crush-story','I watched their story in three seconds. Now I have to pretend I own a life.',array['romance','boast']),
    ('romance-rejection','romance',2,'teen',array['commitment','accuracy'],'v2-date-split','We split the bill. They paid for dinner. I paid with my self-respect.',array['romance','confession']),
    ('romance-rejection','romance',2,'teen',array['commitment','accuracy'],'v2-read-receipt-romance','They left me on read. At least we are doing an activity together.',array['romance','boast']),
    ('romance-rejection','romance',2,'teen',array['commitment','accuracy'],'v2-hot-red-flag','That is a red flag. Unfortunately, red is their color.',array['romance','confession']),
    ('romance-rejection','romance',2,'mature',array['commitment','accuracy'],'v2-dirty-talk-weather','They asked me to talk dirty. I said the air quality is fucking terrible.',array['romance','boast']),
    ('romance-rejection','romance',2,'mature',array['commitment','accuracy'],'v2-situationship-app','My situationship has terms and conditions. I clicked accept with my whole ass.',array['romance','confession']),
    ('romance-rejection','romance',2,'mature',array['commitment','accuracy'],'v2-sexy-voice','I tried a sexy voice and sounded like I owed the bank fucking money.',array['romance','boast']),
    ('romance-rejection','romance',2,'mature',array['commitment','accuracy'],'v2-booty-call-carpool','It was a booty call. I brought snacks and asked if anyone needed a ride home.',array['romance','confession']),
    ('romance-rejection','romance',2,'mature',array['commitment','accuracy'],'v2-date-safe-word','Our safe word is "commitment." Apparently I said it too early.',array['romance','boast']),
    ('impossible-energy','wildcard',4,'everyone',array['commitment','accuracy'],'v2-final-boss-refund','I have come to collect what I am owed. It is seven dollars and you know it.',array['wildcard','confession']),
    ('impossible-energy','wildcard',4,'everyone',array['commitment','accuracy'],'v2-royal-laundry','I called an emergency family meeting. Nobody is allowed to ask why my eyebrows are missing.',array['wildcard','boast']),
    ('impossible-energy','wildcard',4,'everyone',array['commitment','accuracy'],'v2-destiny-password','I challenged a revolving door to a fight. It keeps coming back.',array['wildcard','confession']),
    ('impossible-energy','wildcard',4,'everyone',array['commitment','accuracy'],'v2-evil-laugh','I tried to leave dramatically. The door said pull. I gave it everything.',array['wildcard','boast']),
    ('impossible-energy','wildcard',4,'teen',array['commitment','accuracy'],'v2-revenge-calendar','I penciled in revenge. It clashes with my dentist appointment. They have a fee.',array['wildcard','confession']),
    ('impossible-energy','wildcard',4,'teen',array['commitment','accuracy'],'v2-fear-chihuahua','I can fight. I just need someone to hold my glasses, my bag, and most of my confidence.',array['wildcard','boast']),
    ('impossible-energy','wildcard',4,'teen',array['commitment','accuracy'],'v2-power-pose','I practiced my entrance in the elevator. Someone was already in it.',array['wildcard','confession']),
    ('impossible-energy','wildcard',4,'mature',array['commitment','accuracy'],'v2-god-receipt','I challenged God to a fistfight. He sent my fucking rent increase.',array['wildcard','boast']),
    ('impossible-energy','wildcard',4,'mature',array['commitment','accuracy'],'v2-throne-toilet','I said "fear me" and my stomach made a noise like a fucking haunted drain.',array['wildcard','confession']),
    ('impossible-energy','wildcard',4,'mature',array['commitment','accuracy'],'v2-knees-cracked','I dropped to my knees dramatically. They cracked so loud the argument stopped. Shit.',array['wildcard','boast']),
    ('impossible-energy','wildcard',4,'mature',array['commitment','accuracy'],'v2-demons-rent','I told everyone I could take a punch. I meant emotionally, and even that was bullshit.',array['wildcard','confession']),
    ('impossible-energy','wildcard',4,'mature',array['commitment','accuracy'],'v2-death-speech','Tell my enemies I died standing. Edit out the bit where I fell into the fucking hedge.',array['wildcard','boast'])
), upserted as (
  insert into public.prompts (slug, body, category, difficulty, rating, scoring_focus, tags, locale, state, source, draw_enabled, metadata)
  select slug, body, category, difficulty::smallint, rating::public.content_rating, scoring_focus, tags, 'en', 'published', 'built_in', true,
    '{"catalogVersion":"classic-content-v2","publicationStatus":"original-editorial"}'::jsonb
  from prompt_seed
  on conflict (slug) do nothing
  returning id, slug
), canonical as (
  select id, slug from upserted
  union all
  select p.id, p.slug from public.prompts p join prompt_seed seed on seed.slug = p.slug
)
insert into public.pack_prompts (pack_id, prompt_id, sort_order)
select pack.id, prompt.id, row_number() over (partition by seed.pack_slug order by seed.slug)::integer
from prompt_seed seed
join canonical prompt on prompt.slug = seed.slug
join public.content_packs pack on pack.slug = seed.pack_slug
on conflict (pack_id, prompt_id) do nothing;

update public.prompts set draw_enabled = false where slug in (
  'timeline-needs-me', 'aura-nonrefundable', 'plot-found-me', 'receipts-in-4k', 'peace-limited-edition', 'offline-mysterious', 'algorithm-personally', 'soft-launch-disaster', 'lore-expensive', 'terms-of-serving', 'chat-be-normal', 'lag-legal-team', 'clip-context', 'sponsor-saw-nothing', 'mods-close-door', 'first-try-archive', 'camera-froze-dignity', 'sub-goal-consequences', 'chat-voted-chaos', 'technical-skill-issue', 'parking-spot-destiny', 'sandwich-betrayal', 'umbrella-prophecy', 'group-project-return', 'laundry-last-load', 'keys-chosen-one', 'door-holds-grudge', 'train-left-poetry', 'snack-before-dawn', 'coupon-one-chance', 'final-form-calendar', 'friendship-password', 'rival-coffee-order', 'forbidden-tab', 'training-arc-stairs', 'ancient-technique-nap', 'power-level-email', 'season-finale-bus', 'mentor-grocery-aisle', 'monologue-delivery', 'strategic-falling', 'map-personal', 'cooldown-three-business', 'loot-emotional', 'ranked-spiritual', 'patch-notes-me', 'inventory-full-heart', 'respawn-confidence', 'side-quest-manager', 'boss-fight-tutorial', 'typing-three-hours', 'plans-left-chat', 'screenshot-good-side', 'paragraph-jumpscare', 'mute-loving', 'reaction-emergency', 'brunch-constitutional', 'delete-after-courage', 'location-still-home', 'voice-note-podcast', 'circle-back-sunset', 'bandwidth-emotional', 'deck-has-journey', 'quick-call-myth', 'synergy-unlicensed', 'action-item-sentient', 'calendar-hostile', 'reply-all-event', 'kpi-chose-violence', 'promotion-side-quest', 'chemistry-wifi', 'heart-typing', 'red-flag-decor', 'soft-launch-hard-landing', 'closure-delivery-window', 'butterflies-union', 'flirting-beta', 'seen-cinematic', 'relationship-patch', 'date-rehearsal', 'evil-dental', 'lair-open-plan', 'monologue-overtime', 'doom-calendar', 'cape-dry-clean', 'evil-laugh-feedback', 'henchmen-standup', 'master-plan-password', 'ominous-chair', 'world-domination-trial', 'hold-music-knows', 'manager-final-form', 'receipt-archaeology', 'return-policy-riddle', 'call-recorded-legacy', 'escalate-moon', 'coupon-emotional-support', 'system-says-maybe', 'survey-prophecy', 'policy-blinked-first', 'dialogue-loop', 'side-quest-laundry', 'loading-personality', 'interaction-unavailable', 'thought-patch', 'quest-marker-fridge', 'cutscene-small-talk', 'morality-plus-two', 'fast-travel-couch', 'inventory-one-vibe', 'whispered-thunder', 'laughing-emergency', 'confidently-unsure', 'tiny-grand-announcement', 'calm-panic-plan', 'villain-customer-service', 'romantic-weather-alert', 'toddler-ceo', 'opera-password-reset', 'robot-feelings-ticket'
);
update public.energy_modifiers set draw_enabled = false where slug in (
  'defeated-final-boss', 'lying-to-police', 'maximum-aura', 'voice-note-fourth-take', 'parents-asleep', 'press-conference', 'royal-decree', 'customer-service-breaking', 'documentary-narrator', 'anime-powerup', 'terrible-secret', 'airport-goodbye', 'tutorial-npc', 'microwave-mission-control', 'one-percent-battery', 'villain-performance-review', 'group-chat-leak', 'medieval-town-crier', 'quietly-furious', 'award-speech', 'conspiracy-whiteboard', 'sleepover-whisper', 'weather-emergency', 'first-day-manager', 'haunted-smart-speaker', 'sports-anime-commentator', 'exhausted-superhero', 'bad-wifi-prophet', 'tiny-microphone', 'cooking-show-disaster', 'final-voicemail', 'unearned-confidence', 'suspiciously-specific', 'dramatic-zoom', 'museum-audio-guide', 'rival-in-the-rain', 'motivational-speaker', 'office-heist', 'fake-livestream-apology', 'overqualified-toddler', 'romcom-misunderstanding', 'slow-elevator', 'boss-music', 'low-budget-commercial', 'time-traveler', 'courtroom-objection', 'zen-chaos', 'last-person-on-earth'
);
update public.content_packs set draw_enabled = false where slug in (
  'cinematic-overreaction', 'anime-adjacent', 'corporate-delusion', 'villain-internship', 'customer-service-boss-fight', 'npc-malfunction'
);
-- END CLASSIC V2 CATALOG

-- Preserve existing canonical Daily slots; newly generated dates are clean.
create or replace function public.ensure_daily_challenge(p_date date, p_market text default 'global')
returns public.daily_challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_prompt uuid;
  selected_difficulty smallint;
  selected_body text;
  selected_energy uuid;
  result public.daily_challenges;
  normalized_market text := lower(coalesce(nullif(btrim(p_market), ''), 'global'));
  day_start timestamptz := (p_date::timestamp at time zone 'UTC');
begin
  if p_date is null then
    raise exception using errcode = '22023', message = 'A Daily challenge date is required';
  end if;

  -- Existing canonical dates win before catalog availability is considered.
  select * into result from public.daily_challenges
  where challenge_date = p_date and market = normalized_market;
  if found then return result; end if;

  select p.id, p.difficulty, p.body into selected_prompt, selected_difficulty, selected_body
  from public.prompts p
  where p.state = 'published'
    and p.draw_enabled and p.rating = 'everyone'::public.content_rating
    and (p.available_from is null or p.available_from <= day_start)
    and (p.available_until is null or p.available_until > day_start)
    and exists (
      select 1
      from public.pack_prompts pp
      join public.content_packs pack on pack.id = pp.pack_id
      where pp.prompt_id = p.id
        and pack.state = 'published' and pack.draw_enabled
        and pack.access in ('free', 'rotating')
        and (pack.available_from is null or pack.available_from <= day_start)
        and (pack.available_until is null or pack.available_until > day_start)
    )
  order by md5(p_date::text || ':' || normalized_market || ':prompt:' || p.id::text)
  limit 1;

  select id into selected_energy
  from public.energy_modifiers
  where state = 'published' and draw_enabled
    and (not ('contrast' = any(tags)) or cardinality(regexp_split_to_array(btrim(selected_body), '\s+')) >= 8)
    and (
      compatible_difficulties is null
      or selected_difficulty = any(compatible_difficulties)
    )
  order by md5(p_date::text || ':' || normalized_market || ':energy:' || id::text)
  limit 1;

  if selected_prompt is null or selected_energy is null then
    raise exception 'Published prompt and energy content must exist before generating a daily challenge';
  end if;

  insert into public.daily_challenges (challenge_date, market, prompt_id, energy_modifier_id)
  values (p_date, normalized_market, selected_prompt, selected_energy)
  on conflict (challenge_date, market) do nothing;

  select * into result from public.daily_challenges
  where challenge_date = p_date and market = normalized_market;
  return result;
end;
$$;

