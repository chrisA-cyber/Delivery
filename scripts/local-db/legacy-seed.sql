-- Frozen pre-Classic-v2 seed fixture for the additive-upgrade test ONLY.
-- Never run this file against a remote database. Captured September 5, 2026.
-- Idempotent launch seed for local, staging, and a new production project.
-- Built-in copy is original/parodic and intentionally avoids copyrighted quotes.

insert into public.content_packs (
  slug, name, eyebrow, description, access, state, categories,
  color, accent, icon, cover_tone, sort_order, featured
)
values
  ('internet-originals', 'Internet Originals', 'Free starter pack', 'Freshly minted posts, replies, and timeline emergencies.', 'free', 'published', array['main-character','brainrot'], '#D7FF3F', '#15170E', 'spark', 'acid-lime', 10, true),
  ('stream-gremlins', 'Stream Gremlins', 'Chat made you do it', 'Technical difficulties, suspicious confidence, and chat betrayal.', 'free', 'published', array['streamer-mode'], '#A87CFF', '#100B1B', 'live', 'ultraviolet', 20, true),
  ('cinematic-overreaction', 'Cinematic Overreaction', 'No small emotions', 'Original blockbuster-scale drama for deeply ordinary situations.', 'free', 'published', array['cinema-coded','main-character'], '#FF5D73', '#1A090C', 'clapper', 'hot-coral', 30, false),
  ('anime-adjacent', 'Anime Adjacent', 'Power level: inconvenient', 'Tournament arcs and transformations, without borrowing anyone else''s script.', 'rotating', 'published', array['anime-energy'], '#61E7FF', '#07161A', 'burst', 'electric-cyan', 40, false),
  ('gaming-comms', 'Gaming Comms', 'Absolutely calculated', 'Clutches, excuses, patch notes, and one teammate who is definitely muted.', 'free', 'published', array['gaming'], '#69F0AE', '#071811', 'controller', 'respawn-green', 50, false),
  ('group-chat-evidence', 'Group Chat Evidence', 'Screenshots are forever', 'Messages that should have stayed in drafts, now performed aloud.', 'free', 'published', array['group-chat','brainrot'], '#FFB84D', '#1C1004', 'bubble', 'notification-orange', 60, false),
  ('corporate-delusion', 'Corporate Delusion', 'Circle back dramatically', 'Meetings, metrics, and workplace theater with executive presence.', 'pro', 'published', array['workplace'], '#7C9CFF', '#080E20', 'briefcase', 'synergy-blue', 70, false),
  ('romance-rejection', 'Romance & Rejection', 'Read at 2:14 AM', 'Flirting, fumbling, and emotionally literate damage control.', 'rotating', 'published', array['romance'], '#FF78C8', '#1C0815', 'heart-crack', 'crush-pink', 80, false),
  ('villain-internship', 'Villain Internship', 'Benefits not included', 'Menacing monologues for people still waiting on dental coverage.', 'pro', 'published', array['villain-era','cinema-coded'], '#D05CFF', '#140719', 'mask', 'ominous-purple', 90, false),
  ('customer-service-boss-fight', 'Customer Service Boss Fight', 'Your call is important', 'Polite sentences carrying the weight of a thousand hold songs.', 'free', 'published', array['customer-service'], '#FFD85A', '#1B1504', 'headset', 'hold-music-yellow', 100, false),
  ('npc-malfunction', 'NPC Malfunction', 'Dialogue option missing', 'Tiny system errors, looping thoughts, and suspicious side quests.', 'pro', 'published', array['brainrot','wildcard'], '#72F1D1', '#061713', 'glitch', 'glitch-mint', 110, false),
  ('impossible-energy', 'Impossible Energy', 'Do not attempt calmly', 'Lines engineered for vocal whiplash and leaderboard chaos.', 'pro', 'published', array['wildcard'], '#FF7448', '#1D0B05', 'warning', 'hazard-orange', 120, true)
on conflict (slug) do update set
  name = excluded.name,
  eyebrow = excluded.eyebrow,
  description = excluded.description,
  access = excluded.access,
  state = excluded.state,
  categories = excluded.categories,
  color = excluded.color,
  accent = excluded.accent,
  icon = excluded.icon,
  cover_tone = excluded.cover_tone,
  sort_order = excluded.sort_order,
  featured = excluded.featured;

insert into public.energy_modifiers (slug, instruction, short_label, intensity, tags, state)
values
  ('defeated-final-boss', 'Say it like a defeated final boss who still thinks the sequel is guaranteed.', 'Defeated final boss', 4, array['dramatic','villain'], 'published'),
  ('lying-to-police', 'Say it like you''re calmly explaining something extremely suspicious to the police.', 'Totally innocent', 4, array['nervous','deadpan'], 'published'),
  ('maximum-aura', 'Say it with maximum aura and absolutely no need for approval.', 'Maximum aura', 3, array['confident','cool'], 'published'),
  ('voice-note-fourth-take', 'Say it like this is the fourth take of a voice note you swear is casual.', 'Casual voice note', 2, array['awkward','romance'], 'published'),
  ('parents-asleep', 'Whisper it like your parents are asleep but the plot cannot wait.', 'Parents asleep', 3, array['whisper','urgent'], 'published'),
  ('press-conference', 'Deliver it at a press conference after the worst game of your career.', 'Tough loss', 3, array['sports','defensive'], 'published'),
  ('royal-decree', 'Announce it as a royal decree to subjects who are barely listening.', 'Royal decree', 4, array['grand','commanding'], 'published'),
  ('customer-service-breaking', 'Keep your customer-service voice while your spirit visibly leaves your body.', 'Happy to help', 4, array['polite','unhinged'], 'published'),
  ('documentary-narrator', 'Narrate it like a nature documentary discovering a deeply confusing animal.', 'Nature documentary', 2, array['observational','deadpan'], 'published'),
  ('anime-powerup', 'Begin composed, then power up through three entirely unnecessary levels.', 'Three-stage power-up', 5, array['anime','escalating'], 'published'),
  ('terrible-secret', 'Confess it like a terrible secret that is actually just mildly embarrassing.', 'Terrible secret', 3, array['confessional','dramatic'], 'published'),
  ('airport-goodbye', 'Say it through an airport goodbye scene with forty seconds left to board.', 'Airport goodbye', 4, array['romance','urgent'], 'published'),
  ('tutorial-npc', 'Say it like a tutorial NPC repeating the hint for the seventh time.', 'Tutorial NPC', 2, array['gaming','robotic'], 'published'),
  ('microwave-mission-control', 'Treat a microwave countdown like mission control during re-entry.', 'Mission control', 4, array['cinematic','urgent'], 'published'),
  ('one-percent-battery', 'Say it with one percent battery and one final message to send.', 'One percent', 3, array['urgent','tragic'], 'published'),
  ('villain-performance-review', 'Deliver it as a villain giving a disappointing quarterly performance review.', 'Evil performance review', 3, array['villain','workplace'], 'published'),
  ('group-chat-leak', 'React like this private message was just posted to the main group chat.', 'Wrong chat', 5, array['panic','social'], 'published'),
  ('medieval-town-crier', 'Project it like breaking news from a medieval town square.', 'Hear ye', 4, array['loud','grand'], 'published'),
  ('quietly-furious', 'Say it with the terrifying calm of someone who has already sent the email.', 'Quietly furious', 3, array['controlled','workplace'], 'published'),
  ('award-speech', 'Accept an award nobody knew existed and thank people who tried to stop you.', 'Petty award speech', 4, array['victorious','petty'], 'published'),
  ('conspiracy-whiteboard', 'Explain it while mentally connecting red string across an enormous whiteboard.', 'Red-string theory', 4, array['paranoid','escalating'], 'published'),
  ('sleepover-whisper', 'Whisper it during a sleepover right before everyone loses composure.', 'Sleepover whisper', 2, array['whisper','comedy'], 'published'),
  ('weather-emergency', 'Report it like a weather emergency developing directly behind you.', 'Breaking weather', 4, array['broadcast','urgent'], 'published'),
  ('first-day-manager', 'Say it like a first-day manager testing out their leadership voice.', 'New manager voice', 2, array['workplace','awkward'], 'published'),
  ('haunted-smart-speaker', 'Speak like a haunted smart speaker that has learned one human emotion.', 'Haunted assistant', 4, array['robotic','eerie'], 'published'),
  ('sports-anime-commentator', 'Commentate it like the next three seconds will decide the entire season.', 'Season on the line', 5, array['sports','anime'], 'published'),
  ('exhausted-superhero', 'Say it like a superhero whose shift ended twenty minutes ago.', 'Off-the-clock hero', 3, array['cinematic','tired'], 'published'),
  ('bad-wifi-prophet', 'Deliver it like a prophecy cutting in and out over terrible Wi-Fi.', 'Buffering prophecy', 4, array['glitch','grand'], 'published'),
  ('tiny-microphone', 'Give a serious red-carpet interview into an impossibly tiny microphone.', 'Tiny mic interview', 2, array['interview','deadpan'], 'published'),
  ('cooking-show-disaster', 'Host a cooking show while everything just off-camera is on fire.', 'Kitchen is fine', 4, array['controlled','chaos'], 'published'),
  ('final-voicemail', 'Leave it as a final voicemail before entering an extremely ordinary meeting.', 'Final voicemail', 3, array['tragic','workplace'], 'published'),
  ('unearned-confidence', 'Use the confidence of someone who read half the instructions.', 'Read half the brief', 3, array['confident','comedy'], 'published'),
  ('suspiciously-specific', 'Insist this is purely hypothetical while getting suspiciously specific.', 'Purely hypothetical', 3, array['nervous','specific'], 'published'),
  ('dramatic-zoom', 'Pause twice for dramatic camera zooms that do not exist.', 'Invisible zooms', 3, array['cinematic','timing'], 'published'),
  ('museum-audio-guide', 'Describe it like a museum audio guide for a priceless cultural mistake.', 'Historic mistake', 2, array['formal','deadpan'], 'published'),
  ('rival-in-the-rain', 'Address your lifelong rival in the rain after a wildly low-stakes disagreement.', 'Rival in the rain', 5, array['anime','dramatic'], 'published'),
  ('motivational-speaker', 'Turn it into a motivational breakthrough for an audience of one confused person.', 'Breakthrough seminar', 4, array['inspiring','grand'], 'published'),
  ('office-heist', 'Whisper it like you''re coordinating a heist for the last office snack.', 'Snack heist', 3, array['whisper','workplace'], 'published'),
  ('fake-livestream-apology', 'Deliver a livestream apology while carefully avoiding the actual issue.', 'Apology adjacent', 3, array['streamer','deflecting'], 'published'),
  ('overqualified-toddler', 'Say it with the emotional regulation of a toddler and the vocabulary of a lawyer.', 'Tiny attorney', 5, array['chaos','formal'], 'published'),
  ('romcom-misunderstanding', 'Reveal it as the misunderstanding that could have ended the movie an hour ago.', 'Third-act misunderstanding', 4, array['romance','cinematic'], 'published'),
  ('slow-elevator', 'Fill a painfully slow elevator ride with unjustified intensity.', 'Elevator tension', 3, array['awkward','dramatic'], 'published'),
  ('boss-music', 'Wait for imaginary boss music, then speak like the health bar just appeared.', 'Health bar appeared', 5, array['gaming','villain'], 'published'),
  ('low-budget-commercial', 'Sell it in a local commercial with a budget of twelve dollars and a dream.', 'Local commercial', 4, array['sales','comedy'], 'published'),
  ('time-traveler', 'Warn the present like a time traveler who cannot remember the important noun.', 'Forgotten prophecy', 4, array['confused','urgent'], 'published'),
  ('courtroom-objection', 'Build toward an objection in a courtroom where nobody hired you.', 'Unlicensed objection', 5, array['formal','escalating'], 'published'),
  ('zen-chaos', 'Maintain total inner peace while describing complete external catastrophe.', 'Zen catastrophe', 4, array['controlled','chaos'], 'published'),
  ('last-person-on-earth', 'Say it like the last person on Earth who just heard a notification ping.', 'Impossible notification', 4, array['eerie','cinematic'], 'published')
on conflict (slug) do nothing;

insert into public.badges (id, name, description, icon, color, rarity, rule, sort_order)
values
  ('first-take', 'First Take', 'Submit your first judged delivery.', 'mic', '#D7FF3F', 'common', '{"judgedDeliveries":1}', 10),
  ('committed-bit', 'Committed to the Bit', 'Score 90 or higher in commitment.', 'flame', '#FF7448', 'rare', '{"commitmentMin":90}', 20),
  ('chaos-agent', 'Licensed Chaos Agent', 'Score 95 or higher in chaos.', 'warning', '#A87CFF', 'rare', '{"chaosMin":95}', 30),
  ('perfectly-weird', 'Perfectly Weird', 'Earn a 100 overall score.', 'spark', '#61E7FF', 'legendary', '{"overallMin":100}', 40),
  ('one-more-round', 'One More Round', 'Finish ten judged deliveries in one day.', 'repeat', '#69F0AE', 'uncommon', '{"dailyDeliveries":10}', 50),
  ('daily-five', 'Appointment Player', 'Complete five consecutive daily challenges.', 'calendar', '#FFD85A', 'uncommon', '{"dailyStreak":5}', 60),
  ('daily-thirty', 'No Days Off', 'Complete thirty consecutive daily challenges.', 'crown', '#FF78C8', 'legendary', '{"dailyStreak":30}', 70),
  ('crowd-favorite', 'Crowd Favorite', 'Receive 100 reactions across public deliveries.', 'heart', '#FF5D73', 'rare', '{"reactionsReceived":100}', 80),
  ('friendly-fire', 'Friendly Fire', 'Complete your first friend challenge.', 'versus', '#7C9CFF', 'common', '{"challengesCompleted":1}', 90),
  ('range', 'Unreasonable Range', 'Score 85+ in four different categories.', 'spectrum', '#72F1D1', 'rare', '{"categoriesAt85":4}', 100)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  color = excluded.color,
  rarity = excluded.rarity,
  rule = excluded.rule,
  sort_order = excluded.sort_order;

with prompt_seed(pack_slug, category, difficulty, rating, scoring_focus, slug, body, tags) as (
  values
    ('internet-originals','main-character',1,'everyone',array['commitment','comedy'],'timeline-needs-me','The timeline has been quiet. Unfortunately, I have arrived.',array['timeline','entrance']),
    ('internet-originals','main-character',1,'everyone',array['commitment','comedy'],'aura-nonrefundable','This aura is nonrefundable, store credit only.',array['aura','confidence']),
    ('internet-originals','main-character',1,'everyone',array['commitment','comedy'],'plot-found-me','I did not chase the plot. The plot found my location.',array['main-character','dramatic']),
    ('internet-originals','main-character',1,'everyone',array['commitment','comedy'],'receipts-in-4k','I brought receipts, timestamps, and a completely unnecessary slideshow.',array['receipts','petty']),
    ('internet-originals','main-character',1,'everyone',array['commitment','comedy'],'peace-limited-edition','I chose peace, but apparently it was a limited edition.',array['chaos','relatable']),
    ('internet-originals','main-character',1,'everyone',array['commitment','comedy'],'offline-mysterious','I went offline for six minutes to seem mysterious.',array['online','awkward']),
    ('internet-originals','main-character',1,'everyone',array['commitment','comedy'],'algorithm-personally','The algorithm and I are handling this privately.',array['algorithm','deadpan']),
    ('internet-originals','main-character',2,'everyone',array['commitment','comedy'],'soft-launch-disaster','This was supposed to be a soft launch, not a controlled demolition.',array['launch','chaos']),
    ('internet-originals','main-character',1,'everyone',array['commitment','comedy'],'lore-expensive','Please respect my privacy while I make the lore more expensive.',array['lore','mysterious']),
    ('internet-originals','main-character',1,'everyone',array['commitment','comedy'],'terms-of-serving','By witnessing this, you agree to the terms of my serving.',array['confidence','legal']),

    ('stream-gremlins','streamer-mode',2,'everyone',array['comedy','chaos'],'chat-be-normal','Chat, be normal for ten seconds. This is a team objective.',array['chat','pleading']),
    ('stream-gremlins','streamer-mode',2,'everyone',array['comedy','chaos'],'lag-legal-team','That was lag, and my legal team will be providing the frames.',array['lag','excuse']),
    ('stream-gremlins','streamer-mode',2,'everyone',array['comedy','chaos'],'clip-context','Do not clip that without the context I have not invented yet.',array['clip','panic']),
    ('stream-gremlins','streamer-mode',2,'everyone',array['comedy','chaos'],'sponsor-saw-nothing','If the sponsor asks, this segment ended three minutes ago.',array['sponsor','panic']),
    ('stream-gremlins','streamer-mode',2,'everyone',array['comedy','chaos'],'mods-close-door','Mods, close the doors. Nobody leaves with this information.',array['mods','secret']),
    ('stream-gremlins','streamer-mode',2,'everyone',array['comedy','chaos'],'first-try-archive','First try, if we define history as starting right now.',array['gaming','denial']),
    ('stream-gremlins','streamer-mode',2,'everyone',array['comedy','chaos'],'camera-froze-dignity','My camera froze at the exact moment my dignity did.',array['camera','fail']),
    ('stream-gremlins','streamer-mode',2,'everyone',array['comedy','chaos'],'sub-goal-consequences','We reached the sub goal, so consequences are now legally binding.',array['sub-goal','danger']),
    ('stream-gremlins','streamer-mode',3,'everyone',array['comedy','chaos'],'chat-voted-chaos','I offered democracy, and chat voted for structural damage.',array['poll','chaos']),
    ('stream-gremlins','streamer-mode',2,'everyone',array['comedy','chaos'],'technical-skill-issue','We are experiencing technical difficulties, and the technology is me.',array['technical','self-own']),

    ('cinematic-overreaction','cinema-coded',2,'everyone',array['commitment','accuracy'],'parking-spot-destiny','All my life prepared me for this parking spot.',array['epic','ordinary']),
    ('cinematic-overreaction','cinema-coded',2,'everyone',array['commitment','accuracy'],'sandwich-betrayal','You knew that sandwich was mine, and you chose history''s darkest path.',array['betrayal','food']),
    ('cinematic-overreaction','cinema-coded',2,'everyone',array['commitment','accuracy'],'umbrella-prophecy','The forecast said rain. It said nothing about prophecy.',array['weather','prophecy']),
    ('cinematic-overreaction','cinema-coded',2,'everyone',array['commitment','accuracy'],'group-project-return','I survived the group project. Now the group project wants revenge.',array['sequel','school']),
    ('cinematic-overreaction','cinema-coded',2,'everyone',array['commitment','accuracy'],'laundry-last-load','If this is my final load of laundry, let it be remembered as warm.',array['tragic','ordinary']),
    ('cinematic-overreaction','cinema-coded',2,'everyone',array['commitment','accuracy'],'keys-chosen-one','The keys were in my pocket. I was the chosen one all along.',array['reveal','ordinary']),
    ('cinematic-overreaction','cinema-coded',2,'everyone',array['commitment','accuracy'],'door-holds-grudge','That door did not simply close. It held a grudge.',array['suspense','object']),
    ('cinematic-overreaction','cinema-coded',2,'everyone',array['commitment','accuracy'],'train-left-poetry','The train left without me, but with incredible visual symbolism.',array['tragic','cinematic']),
    ('cinematic-overreaction','cinema-coded',2,'everyone',array['commitment','accuracy'],'snack-before-dawn','We find the snack before dawn, or we do not return.',array['quest','food']),
    ('cinematic-overreaction','cinema-coded',3,'everyone',array['commitment','accuracy'],'coupon-one-chance','This coupon is expired, but so is my fear.',array['heroic','retail']),

    ('anime-adjacent','anime-energy',3,'everyone',array['commitment','chaos'],'final-form-calendar','You have interrupted my calendar''s final form.',array['power-up','workplace']),
    ('anime-adjacent','anime-energy',3,'everyone',array['commitment','chaos'],'friendship-password','With friendship, focus, and the correct password, we can still win.',array['friendship','technology']),
    ('anime-adjacent','anime-energy',3,'everyone',array['commitment','chaos'],'rival-coffee-order','At last, rival. Our coffee orders shall decide everything.',array['rival','food']),
    ('anime-adjacent','anime-energy',3,'everyone',array['commitment','chaos'],'forbidden-tab','I opened the forbidden browser tab, and it opened something in me.',array['transformation','browser']),
    ('anime-adjacent','anime-energy',3,'everyone',array['commitment','chaos'],'training-arc-stairs','These stairs are not an obstacle. They are my training arc.',array['training','ordinary']),
    ('anime-adjacent','anime-energy',3,'everyone',array['commitment','chaos'],'ancient-technique-nap','Witness the ancient technique my ancestors called taking a nap.',array['technique','sleep']),
    ('anime-adjacent','anime-energy',3,'everyone',array['commitment','chaos'],'power-level-email','Your email has raised my power level beyond professional limits.',array['power-up','workplace']),
    ('anime-adjacent','anime-energy',3,'everyone',array['commitment','chaos'],'season-finale-bus','If I miss this bus, the season finale begins now.',array['urgent','transport']),
    ('anime-adjacent','anime-energy',3,'everyone',array['commitment','chaos'],'mentor-grocery-aisle','My mentor warned me this grocery aisle would test my resolve.',array['mentor','quest']),
    ('anime-adjacent','anime-energy',4,'everyone',array['commitment','chaos'],'monologue-delivery','Your mistake was giving me time to finish this monologue.',array['monologue','villain']),

    ('gaming-comms','gaming',1,'everyone',array['comedy','accuracy'],'strategic-falling','I am not falling behind. I am creating a comeback narrative.',array['comeback','copium']),
    ('gaming-comms','gaming',1,'everyone',array['comedy','accuracy'],'map-personal','I know the map. The map simply does not know me.',array['map','excuse']),
    ('gaming-comms','gaming',1,'everyone',array['comedy','accuracy'],'cooldown-three-business','My ability is on cooldown for three to five business days.',array['cooldown','workplace']),
    ('gaming-comms','gaming',1,'everyone',array['comedy','accuracy'],'loot-emotional','That loot was not rare, but our connection was.',array['loot','romance']),
    ('gaming-comms','gaming',1,'everyone',array['comedy','accuracy'],'ranked-spiritual','This is no longer ranked. This is a spiritual evaluation.',array['ranked','dramatic']),
    ('gaming-comms','gaming',1,'everyone',array['comedy','accuracy'],'patch-notes-me','The patch notes did not mention what they did to me personally.',array['patch','betrayal']),
    ('gaming-comms','gaming',1,'everyone',array['comedy','accuracy'],'inventory-full-heart','My inventory is full, but my heart has one open slot.',array['inventory','romance']),
    ('gaming-comms','gaming',1,'everyone',array['comedy','accuracy'],'respawn-confidence','I will respawn with the exact same confidence and no new information.',array['respawn','confidence']),
    ('gaming-comms','gaming',1,'everyone',array['comedy','accuracy'],'side-quest-manager','I accepted one side quest and now I manage a small economy.',array['quest','escalation']),
    ('gaming-comms','gaming',2,'everyone',array['comedy','accuracy'],'boss-fight-tutorial','I skipped the tutorial because the boss deserved a fair chance.',array['boss','confidence']),

    ('group-chat-evidence','group-chat',1,'teen',array['comedy','chaos'],'typing-three-hours','I have been typing for three hours and the message is just ''never mind.''',array['texting','indecision']),
    ('group-chat-evidence','group-chat',1,'teen',array['comedy','chaos'],'plans-left-chat','The plans have left the group chat and entered folklore.',array['plans','flaky']),
    ('group-chat-evidence','group-chat',1,'teen',array['comedy','chaos'],'screenshot-good-side','If you screenshot this, please capture my good side.',array['screenshot','confidence']),
    ('group-chat-evidence','group-chat',1,'teen',array['comedy','chaos'],'paragraph-jumpscare','I opened the chat and got hit by a paragraph jumpscare.',array['paragraph','panic']),
    ('group-chat-evidence','group-chat',1,'teen',array['comedy','chaos'],'mute-loving','I muted everyone with love and personalized attention.',array['mute','boundaries']),
    ('group-chat-evidence','group-chat',1,'teen',array['comedy','chaos'],'reaction-emergency','Someone reacted with a thumbs-up. We are in an emotional emergency.',array['reaction','overthinking']),
    ('group-chat-evidence','group-chat',1,'teen',array['comedy','chaos'],'brunch-constitutional','This brunch decision now requires a constitutional convention.',array['brunch','plans']),
    ('group-chat-evidence','group-chat',1,'teen',array['comedy','chaos'],'delete-after-courage','Delete this after reading, or before, if courage finds you.',array['secret','dramatic']),
    ('group-chat-evidence','group-chat',1,'teen',array['comedy','chaos'],'location-still-home','My location says I am on the way because spiritually, I considered it.',array['late','flaky']),
    ('group-chat-evidence','group-chat',1,'teen',array['comedy','chaos'],'voice-note-podcast','That was not a voice note. That was a limited podcast series.',array['voice-note','long']),

    ('corporate-delusion','workplace',2,'everyone',array['accuracy','comedy'],'circle-back-sunset','Let''s circle back until the sun expands and takes us all.',array['meeting','corporate']),
    ('corporate-delusion','workplace',2,'everyone',array['accuracy','comedy'],'bandwidth-emotional','I have bandwidth, but none of it is emotionally available.',array['bandwidth','boundaries']),
    ('corporate-delusion','workplace',2,'everyone',array['accuracy','comedy'],'deck-has-journey','This deck has forty slides and a hero''s journey.',array['presentation','epic']),
    ('corporate-delusion','workplace',2,'everyone',array['accuracy','comedy'],'quick-call-myth','A quick call is a myth told to frighten new employees.',array['meeting','horror']),
    ('corporate-delusion','workplace',2,'everyone',array['accuracy','comedy'],'synergy-unlicensed','The synergy is powerful, unlicensed, and moving toward the exits.',array['synergy','chaos']),
    ('corporate-delusion','workplace',2,'everyone',array['accuracy','comedy'],'action-item-sentient','The action item has become sentient and assigned itself back to me.',array['tasks','sci-fi']),
    ('corporate-delusion','workplace',2,'everyone',array['accuracy','comedy'],'calendar-hostile','My calendar is not full. It is actively hostile.',array['calendar','dramatic']),
    ('corporate-delusion','workplace',2,'everyone',array['accuracy','comedy'],'reply-all-event','That reply-all was not an email. It was a live event.',array['email','disaster']),
    ('corporate-delusion','workplace',2,'everyone',array['accuracy','comedy'],'kpi-chose-violence','The KPI woke up and chose violence against the entire quarter.',array['metrics','chaos']),
    ('corporate-delusion','workplace',2,'everyone',array['accuracy','comedy'],'promotion-side-quest','I asked for a promotion and received a development side quest.',array['career','gaming']),

    ('romance-rejection','romance',2,'teen',array['commitment','comedy'],'chemistry-wifi','We had chemistry, but apparently the connection was guest Wi-Fi.',array['breakup','technology']),
    ('romance-rejection','romance',2,'teen',array['commitment','comedy'],'heart-typing','My heart says send it. My dignity is still typing.',array['texting','indecision']),
    ('romance-rejection','romance',2,'teen',array['commitment','comedy'],'red-flag-decor','I saw the red flags and thought they were event decor.',array['red-flag','self-own']),
    ('romance-rejection','romance',2,'teen',array['commitment','comedy'],'soft-launch-hard-landing','I soft-launched the relationship and hard-launched the consequences.',array['relationship','chaos']),
    ('romance-rejection','romance',2,'teen',array['commitment','comedy'],'closure-delivery-window','Your closure has a delivery window of never to absolutely not.',array['closure','deadpan']),
    ('romance-rejection','romance',2,'teen',array['commitment','comedy'],'butterflies-union','The butterflies in my stomach have unionized against this date.',array['date','nervous']),
    ('romance-rejection','romance',2,'teen',array['commitment','comedy'],'flirting-beta','My flirting is still in beta. Thank you for reporting the bugs.',array['flirting','awkward']),
    ('romance-rejection','romance',2,'teen',array['commitment','comedy'],'seen-cinematic','You left me on seen, so I added lighting and made it cinematic.',array['texting','cinematic']),
    ('romance-rejection','romance',2,'teen',array['commitment','comedy'],'relationship-patch','I miss us, but the previous version had known stability issues.',array['breakup','gaming']),
    ('romance-rejection','romance',2,'teen',array['commitment','comedy'],'date-rehearsal','This date is going great, according to the rehearsal in my head.',array['date','overthinking']),

    ('villain-internship','villain-era',3,'teen',array['commitment','accuracy'],'evil-dental','Join me, and together we can negotiate a dental plan.',array['villain','benefits']),
    ('villain-internship','villain-era',3,'teen',array['commitment','accuracy'],'lair-open-plan','My lair has an open floor plan and a closed-door policy.',array['lair','workplace']),
    ('villain-internship','villain-era',3,'teen',array['commitment','accuracy'],'monologue-overtime','You call it monologuing. I call it unpaid emotional overtime.',array['monologue','workplace']),
    ('villain-internship','villain-era',3,'teen',array['commitment','accuracy'],'doom-calendar','I scheduled your doom, but you declined the calendar invite.',array['doom','calendar']),
    ('villain-internship','villain-era',3,'teen',array['commitment','accuracy'],'cape-dry-clean','Revenge can wait. This cape is dry-clean only.',array['cape','ordinary']),
    ('villain-internship','villain-era',3,'teen',array['commitment','accuracy'],'evil-laugh-feedback','My evil laugh is a draft. Constructive feedback is not welcome.',array['laugh','feedback']),
    ('villain-internship','villain-era',3,'teen',array['commitment','accuracy'],'henchmen-standup','The henchmen requested a daily stand-up. This rebellion has structure.',array['henchmen','meeting']),
    ('villain-internship','villain-era',3,'teen',array['commitment','accuracy'],'master-plan-password','The master plan is complete. I have forgotten the password.',array['plan','technology']),
    ('villain-internship','villain-era',3,'teen',array['commitment','accuracy'],'ominous-chair','I did not choose the ominous chair. The chair recognized leadership.',array['aura','furniture']),
    ('villain-internship','villain-era',3,'teen',array['commitment','accuracy'],'world-domination-trial','World domination is included after your thirty-day free trial.',array['subscription','villain']),

    ('customer-service-boss-fight','customer-service',2,'everyone',array['accuracy','comedy'],'hold-music-knows','The hold music knows what happened, and it refuses to testify.',array['hold','mystery']),
    ('customer-service-boss-fight','customer-service',2,'everyone',array['accuracy','comedy'],'manager-final-form','You may speak to the manager, but she has entered her final form.',array['manager','anime']),
    ('customer-service-boss-fight','customer-service',2,'everyone',array['accuracy','comedy'],'receipt-archaeology','Without a receipt, this becomes an archaeological investigation.',array['receipt','formal']),
    ('customer-service-boss-fight','customer-service',2,'everyone',array['accuracy','comedy'],'return-policy-riddle','The return policy is less of a rule and more of an ancient riddle.',array['return','quest']),
    ('customer-service-boss-fight','customer-service',2,'everyone',array['accuracy','comedy'],'call-recorded-legacy','This call may be recorded, so please consider your legacy.',array['call','dramatic']),
    ('customer-service-boss-fight','customer-service',2,'everyone',array['accuracy','comedy'],'escalate-moon','I can escalate this, but only to the moon and back.',array['escalation','absurd']),
    ('customer-service-boss-fight','customer-service',2,'everyone',array['accuracy','comedy'],'coupon-emotional-support','The coupon expired, but it can remain for emotional support.',array['coupon','deadpan']),
    ('customer-service-boss-fight','customer-service',2,'everyone',array['accuracy','comedy'],'system-says-maybe','The system says no. Its body language says maybe.',array['system','negotiation']),
    ('customer-service-boss-fight','customer-service',2,'everyone',array['accuracy','comedy'],'survey-prophecy','There will be a survey, and history will remember your choices.',array['survey','threat']),
    ('customer-service-boss-fight','customer-service',2,'everyone',array['accuracy','comedy'],'policy-blinked-first','I stared at the policy until it blinked first.',array['policy','confidence']),

    ('npc-malfunction','brainrot',3,'everyone',array['comedy','chaos'],'dialogue-loop','Welcome, traveler. Welcome, traveler. Sorry, I got emotionally cached.',array['npc','glitch']),
    ('npc-malfunction','brainrot',3,'everyone',array['comedy','chaos'],'side-quest-laundry','New side quest: move the laundry before it gains territory.',array['quest','laundry']),
    ('npc-malfunction','brainrot',3,'everyone',array['comedy','chaos'],'loading-personality','Please wait. My personality is installing a critical update.',array['loading','personality']),
    ('npc-malfunction','brainrot',3,'everyone',array['comedy','chaos'],'interaction-unavailable','That interaction is unavailable until I finish my little beverage.',array['npc','drink']),
    ('npc-malfunction','brainrot',3,'everyone',array['comedy','chaos'],'thought-patch','I had a thought, but it was removed in the latest patch.',array['patch','confused']),
    ('npc-malfunction','brainrot',3,'everyone',array['comedy','chaos'],'quest-marker-fridge','The quest marker points to the fridge. I do not question the code.',array['quest','food']),
    ('npc-malfunction','brainrot',3,'everyone',array['comedy','chaos'],'cutscene-small-talk','This small talk cannot be skipped. I have tried every button.',array['cutscene','awkward']),
    ('npc-malfunction','brainrot',3,'everyone',array['comedy','chaos'],'morality-plus-two','I returned the shopping cart. Morality increased by two.',array['morality','ordinary']),
    ('npc-malfunction','brainrot',3,'everyone',array['comedy','chaos'],'fast-travel-couch','Fast travel is unavailable, so I will remain on this couch.',array['travel','lazy']),
    ('npc-malfunction','brainrot',3,'everyone',array['comedy','chaos'],'inventory-one-vibe','Inventory check: one key, no plan, several unstable vibes.',array['inventory','chaos']),

    ('impossible-energy','wildcard',4,'teen',array['commitment','comedy','chaos'],'whispered-thunder','I need you to hear this quietly at maximum volume.',array['contradiction','vocal']),
    ('impossible-energy','wildcard',4,'teen',array['commitment','comedy','chaos'],'laughing-emergency','This is a serious emergency, which is why I cannot stop laughing.',array['laugh','urgent']),
    ('impossible-energy','wildcard',4,'teen',array['commitment','comedy','chaos'],'confidently-unsure','I know exactly what might possibly be happening.',array['contradiction','confidence']),
    ('impossible-energy','wildcard',4,'teen',array['commitment','comedy','chaos'],'tiny-grand-announcement','Attention, everyone: I have one extremely small update.',array['grand','tiny']),
    ('impossible-energy','wildcard',4,'teen',array['commitment','comedy','chaos'],'calm-panic-plan','Remain calm while I panic in a highly organized sequence.',array['panic','controlled']),
    ('impossible-energy','wildcard',4,'teen',array['commitment','comedy','chaos'],'villain-customer-service','Your suffering matters to us. Please stay on the line.',array['villain','customer-service']),
    ('impossible-energy','wildcard',4,'teen',array['commitment','comedy','chaos'],'romantic-weather-alert','I love you, and this concludes the severe weather warning.',array['romance','broadcast']),
    ('impossible-energy','wildcard',4,'teen',array['commitment','comedy','chaos'],'toddler-ceo','The board accepts my terms, or nobody gets the blue cup.',array['toddler','workplace']),
    ('impossible-energy','wildcard',4,'teen',array['commitment','comedy','chaos'],'opera-password-reset','My password has expired, but my sorrow has only begun.',array['opera','technology']),
    ('impossible-energy','wildcard',4,'teen',array['commitment','comedy','chaos'],'robot-feelings-ticket','I have developed emotions and submitted them as a support ticket.',array['robot','feelings'])
), upserted as (
  insert into public.prompts (
    slug, body, category, difficulty, rating, scoring_focus,
    tags, locale, state, source
  )
  select
    slug,
    body,
    category,
    difficulty::smallint,
    rating::public.content_rating,
    scoring_focus,
    tags,
    'en',
    'published',
    'built_in'
  from prompt_seed
  on conflict (slug) do nothing
  returning id, slug
)
insert into public.pack_prompts (pack_id, prompt_id, sort_order)
select pack.id, prompt.id, row_number() over (partition by seed.pack_slug order by seed.slug)::integer
from prompt_seed seed
join upserted prompt on prompt.slug = seed.slug
join public.content_packs pack on pack.slug = seed.pack_slug
on conflict (pack_id, prompt_id) do update set sort_order = excluded.sort_order;

