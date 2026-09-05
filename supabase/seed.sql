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

-- Keep a rolling daily horizon ready. A scheduled server job should call the same
-- function once per day to extend it; existing dates are never rewritten.
select public.ensure_daily_challenge(day::date, 'global')
from generate_series(
  (now() at time zone 'UTC')::date,
  (now() at time zone 'UTC')::date + 30,
  interval '1 day'
) as days(day);

-- Classic Step 1B additive catalog refresh. Apply after committed 014–016.
-- Exact prior line/direction copy and UUIDs remain available to historical references.
-- Re-running does not republish moderated/archived rows. No score or media changes.
-- BEGIN CLASSIC V3 CATALOG
insert into public.content_packs (
  slug, name, eyebrow, description, access, state, categories,
  color, accent, icon, cover_tone, sort_order, featured, draw_enabled
) values
  ('internet-originals','Public Apology','Main character damage','Confessions, delusions, and apologies that somehow make it worse.','free','published',array['main-character'],'#D7FF3F','#121116','spark','internet-originals',10,true,true),
  ('stream-gremlins','Clip That','Chat has the receipts','Stream meltdowns, familiar phrases, and microphones that were definitely on.','free','published',array['streamer-mode'],'#A87CFF','#121116','live','stream-gremlins',20,true,true),
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
  ('v3-hold-laugh','Try not to laugh. Let one breath escape, then force the ending back into rigid seriousness.','Absolutely serious',3,array['restrained','comedy','multi-beat'],'published',true),
  ('v3-last-voicemail','Leave a voicemail pretending everything is fine. Let the final few words give away how badly you need a call back.','Please call back',3,array['confessional','escalating','multi-beat'],'published',true),
  ('v3-press-conference','Answer a question you wish nobody had asked. Start defensive; finish congratulating yourself.','No further questions',4,array['defensive','confident','multi-beat'],'published',true),
  ('v3-soft-threat','Use a warm, gentle voice. Let the final phrase turn cold, as if your patience has just run out.','Sweet little threat',2,array['quiet','controlled','villain','multi-beat'],'published',true),
  ('v2-fake-ad','Pitch every word like an irresistible deal. Make the worst detail your big selling point.','Buy my disaster',4,array['sales','confident'],'published',true),
  ('v3-bedtime-catastrophe','Soothe someone back to sleep. Give the worst word the same gentle care as "sweet dreams."','Sleep tight',1,array['quiet','gentle'],'published',true),
  ('v2-betrayed-teammate','Speak to your most trusted teammate after a betrayal. Hurt first; outrage at the end.','You promised',4,array['hurt','contrast'],'published',true),
  ('v2-no-breathless-rush','Start casually, realize everyone can hear you, and finish in tightly controlled panic.','Missed the mute',4,array['panic','contrast'],'published',true),
  ('v3-documentary-scandal','Describe this behavior with hushed scientific wonder. Sound grateful you lived long enough to witness it.','Rare behavior',2,array['quiet','wonder'],'published',true),
  ('v2-villain-crack','Begin with smooth villain menace, accidentally sound needy, then claw back your authority.','Evil. Mostly.',4,array['villain','contrast'],'published',true),
  ('v2-forbidden-whisper','Whisper an urgent secret to someone beside you. Be intense without raising your volume.','Do not wake them',2,array['quiet','whisper','urgent'],'published',true),
  ('v2-one-word-break','Keep a completely level voice until one important word; crack emotionally there, then go flat again.','The word that broke you',3,array['quiet','deadpan','contrast'],'published',true),
  ('v3-fake-casual','Try painfully hard to sound casual. Add a tiny nervous laugh, then pretend you never made it.','Obviously casual',2,array['awkward','restrained','multi-beat'],'published',true),
  ('v3-sports-final','Call the final seconds of a championship. Tighten the pace, pause before the ending, then release the suspense.','Last seconds',5,array['broadcast','escalating','multi-beat'],'published',true),
  ('v2-reverse-meltdown','Begin on the edge of a meltdown. Force your voice back into calm by the last few words.','Get it together',4,array['contrast','controlled'],'published',true),
  ('v2-no-context-pride','Accept an award for this exact behavior. Sound moved, grateful, and completely unashamed.','Standing ovation',3,array['proud','sincere'],'published',true),
  ('v2-quiet-winner','Speak softly and slowly, with the certainty of someone who has already won. No raised voice.','Already won',1,array['quiet','confident'],'published',true),
  ('v3-horror-realization','Begin with an ordinary observation. Pause as the meaning sinks in; finish in a clear, horrified whisper.','Oh. Oh no.',3,array['quiet','eerie','contrast'],'published',true),
  ('v3-news-desk','Read the news with crisp professionalism. Let a laugh threaten one word, swallow it, and keep broadcasting.','Keep broadcasting',3,array['broadcast','restrained','multi-beat'],'published',true),
  ('v2-romantic-disaster','Make it a tender declaration of love. Commit especially hard to the least romantic word.','This is love',2,array['gentle','romance'],'published',true),
  ('v2-wrong-room','Start with bold authority. Realize halfway through you are in the wrong room; finish anyway.','Wrong audience',4,array['awkward','contrast'],'published',true),
  ('v2-tiny-argument','Try to sound reasonable while clearly losing an argument. Stress the detail nobody believes.','Losing the argument',3,array['defensive','timing'],'published',true),
  ('v2-hero-last-stand','Deliver a wounded hero’s final request. Keep the words clear and make the ending absurdly noble.','One last request',4,array['dramatic','strained'],'published',true),
  ('v2-smug-explanation','Explain it with unbearable smugness. Treat the final detail as proof of your genius.','As I predicted',3,array['confident','comedy'],'published',true),
  ('v2-terrible-good-news','Announce it as wonderful news. Let doubt flash through once, then double down on the celebration.','Great news, somehow',4,array['victorious','contrast'],'published',true),
  ('v2-voice-assistant','Use a smooth automated voice that briefly glitches into real embarrassment, then resets.','Human mode failed',3,array['robotic','contrast'],'published',true),
  ('v3-bad-interrogation','Sound calmly innocent. Rush the detail that could incriminate you, then slow down far too much.','You cannot prove it',3,array['nervous','timing','multi-beat'],'published',true),
  ('v2-angry-gratitude','Sound intensely grateful through clenched frustration. Make the courtesy unmistakable.','Thank you so much',3,array['polite','angry'],'published',true),
  ('v3-manual-serious','Read this as a vital instruction from an appliance manual. Give one absurd word painfully precise emphasis.','Read the manual',2,array['quiet','deadpan','timing'],'published',true),
  ('v2-awe-to-disgust','Start in genuine wonder. Gradually realize this is disgusting; finish with defeated acceptance.','What a miracle',4,array['contrast','disgust'],'published',true),
  ('v2-tiny-emergency','Brief someone on a crisis in a low, steady voice. Put urgency into the pace, not the volume.','Controlled emergency',2,array['quiet','controlled','urgent'],'published',true)
on conflict (slug) do nothing;

with prompt_seed(pack_slug, category, difficulty, rating, scoring_focus, slug, body, tags, metadata) as (
  values
    ('internet-originals','main-character',1,'everyone',array['commitment','accuracy'],'v2-favorite-child','I am my own emergency contact. We are both panicking.',array['main-character','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('internet-originals','main-character',1,'everyone',array['commitment','accuracy'],'v3-two-phone-calls','I faked a phone call to avoid someone. My phone rang. I answered both.',array['main-character','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('internet-originals','main-character',1,'everyone',array['commitment','accuracy'],'v2-mirror-argument','I won an argument in the shower. I have called a press conference.',array['main-character','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('internet-originals','main-character',1,'everyone',array['commitment','accuracy'],'v3-camera-relationship','I waved at a security camera. The guard waved back. I have to go there every day now.',array['main-character','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('internet-originals','main-character',2,'teen',array['commitment','accuracy'],'v2-fake-account','I made a fake account to defend myself. It got bullied into agreeing with them.',array['main-character','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('internet-originals','main-character',2,'teen',array['commitment','accuracy'],'v2-villain-budget','I cannot afford a villain era. I have to be a problem on public transport.',array['main-character','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('internet-originals','main-character',2,'teen',array['commitment','accuracy'],'v2-crying-hot','I checked the mirror while crying. The sadness can wait. I look incredible.',array['main-character','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('internet-originals','main-character',2,'mature',array['commitment','accuracy'],'v2-apology-sponsor','This apology is sponsored by the consequences of my own bullshit.',array['main-character','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('internet-originals','main-character',2,'mature',array['commitment','accuracy'],'v2-emotional-support-lie','I faked a British accent on a first date. We have been married six fucking years.',array['main-character','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('internet-originals','main-character',2,'mature',array['commitment','accuracy'],'v2-blocked-therapist','I blocked my therapist. She kept bringing up things I specifically paid her to hear.',array['main-character','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('internet-originals','main-character',2,'mature',array['commitment','accuracy'],'v3-banned-list','I told the bouncer I was on the list. It was the fucking banned list.',array['main-character','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('internet-originals','main-character',2,'mature',array['commitment','accuracy'],'v2-character-witness','I asked for a character witness. My best friend said, "For the prosecution?" Fuck.',array['main-character','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('stream-gremlins','streamer-mode',1,'everyone',array['commitment','accuracy'],'v2-muted-scream','I have been screaming on mute for six minutes. The neighbors got the exclusive.',array['streamer-mode','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('stream-gremlins','streamer-mode',1,'everyone',array['commitment','accuracy'],'v2-chat-dad','Chat, stop calling him Dad. He is here to fix the internet.',array['streamer-mode','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('stream-gremlins','streamer-mode',1,'everyone',array['commitment','accuracy'],'v3-skip-how-to-move','I clicked "skip tutorial" and immediately searched "how to move."',array['streamer-mode','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('stream-gremlins','streamer-mode',1,'everyone',array['commitment','accuracy'],'v2-sponsor-mom','My mom asked what I do for work. I showed her the clip. She said, "Besides that."',array['streamer-mode','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('stream-gremlins','streamer-mode',2,'teen',array['commitment','accuracy'],'v2-clip-grandma','Who sent that clip to my grandma? She has started saying it at church.',array['streamer-mode','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('stream-gremlins','streamer-mode',2,'teen',array['commitment','accuracy'],'v2-stream-snore','I fell asleep on stream and gained viewers. The audience has made its position clear.',array['streamer-mode','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('stream-gremlins','streamer-mode',2,'teen',array['commitment','accuracy'],'v2-ban-me','Mods, ban me before I finish this sentence.',array['streamer-mode','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('stream-gremlins','streamer-mode',2,'mature',array['commitment','accuracy'],'v3-dentist-breedable','Mute me. Mute me. Why is my dentist asking what "breedable" means?',array['streamer-mode','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('stream-gremlins','streamer-mode',2,'mature',array['commitment','accuracy'],'v3-sponsored-breakup','This breakup is sponsored. Use code ABANDONED for ten percent off my fucking mattress.',array['streamer-mode','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('stream-gremlins','streamer-mode',2,'mature',array['commitment','accuracy'],'v2-donation-confession','Thank you for the five dollars. I am not reading that fucking confession out loud.',array['streamer-mode','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('stream-gremlins','streamer-mode',2,'mature',array['commitment','accuracy'],'v2-clutch-camera','I turned the camera off to lock in. I was naked from the waist down and losing.',array['streamer-mode','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('stream-gremlins','streamer-mode',2,'mature',array['commitment','accuracy'],'v3-robot-sext','The donation robot just read my sext. It pronounced every fucking emoji.',array['streamer-mode','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('gaming-comms','gaming',1,'everyone',array['commitment','accuracy'],'v2-loot-goblin','I did not abandon the team. I heard a chest.',array['gaming','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('gaming-comms','gaming',1,'everyone',array['commitment','accuracy'],'v2-friendly-fire','The enemy team invited me back. They said I helped more than their fifth player.',array['gaming','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('gaming-comms','gaming',1,'everyone',array['commitment','accuracy'],'v2-boss-second-phase','The boss has a second phase. I have a bedtime.',array['gaming','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('gaming-comms','gaming',1,'everyone',array['commitment','accuracy'],'v3-bot-custody','The practice bot sent me a friend request. I think it wants custody.',array['gaming','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('gaming-comms','gaming',2,'teen',array['commitment','accuracy'],'v2-voice-crack','I said "watch this" and my voice cracked before my character died.',array['gaming','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('gaming-comms','gaming',2,'teen',array['commitment','accuracy'],'v2-ranked-breathing','Stop breathing into the mic. I cannot hear myself making excuses.',array['gaming','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('gaming-comms','gaming',2,'teen',array['commitment','accuracy'],'v3-single-player-lag','I blamed lag in a single-player game. Please let me finish lying.',array['gaming','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('gaming-comms','gaming',2,'mature',array['commitment','accuracy'],'v2-ranked-flirting','I said "get fucked" to the boss. My date thought I was talking to them.',array['gaming','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('gaming-comms','gaming',2,'mature',array['commitment','accuracy'],'v2-healer-payment','I am the healer. Say please or die with your fucking principles.',array['gaming','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('gaming-comms','gaming',2,'mature',array['commitment','accuracy'],'v2-skill-funeral','I uninstalled out of respect for the people who made this shit.',array['gaming','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('gaming-comms','gaming',2,'mature',array['commitment','accuracy'],'v2-fall-damage','I survived the apocalypse and died walking down some fucking stairs.',array['gaming','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('gaming-comms','gaming',2,'mature',array['commitment','accuracy'],'v2-push-to-talk','I used push-to-talk to fart. I need to leave this server and start a new life.',array['gaming','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('group-chat-evidence','group-chat',1,'everyone',array['commitment','accuracy'],'v2-voice-note-podcast','That was not a voice note. That was a hostage situation with chapters.',array['group-chat','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('group-chat-evidence','group-chat',1,'everyone',array['commitment','accuracy'],'v3-photo-audit','I liked their old photo, panicked, and liked twelve more. It is an audit now.',array['group-chat','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('group-chat-evidence','group-chat',1,'everyone',array['commitment','accuracy'],'v2-reply-everyone','I said "you too" when the dentist said "open wide." Neither of us recovered.',array['group-chat','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('group-chat-evidence','group-chat',1,'everyone',array['commitment','accuracy'],'v3-birthday-without-me','I made a group chat for my birthday. They started planning without me.',array['group-chat','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('group-chat-evidence','group-chat',2,'teen',array['commitment','accuracy'],'v3-screenshot-option-two','I sent them the screenshot of me asking how to reply to them. They said "option two."',array['group-chat','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('group-chat-evidence','group-chat',2,'teen',array['commitment','accuracy'],'v2-typing-hostage','I have been typing for eleven minutes. The message is "okay."',array['group-chat','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('group-chat-evidence','group-chat',2,'teen',array['commitment','accuracy'],'v3-full-name-sound-effect','Do not play that voice note out loud. I used your full name in the sound effect.',array['group-chat','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('group-chat-evidence','group-chat',2,'mature',array['commitment','accuracy'],'v2-toilet-unmute','I unmuted to flush so they would know I was done with this conversation.',array['group-chat','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('group-chat-evidence','group-chat',2,'mature',array['commitment','accuracy'],'v3-subpoena-award','If this chat gets subpoenaed, I was hacked. If it wins an award, I wrote the dick joke.',array['group-chat','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('group-chat-evidence','group-chat',2,'mature',array['commitment','accuracy'],'v2-nude-printer','I tried to send a nude and accidentally selected the printer. Dad is downstairs.',array['group-chat','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('group-chat-evidence','group-chat',2,'mature',array['commitment','accuracy'],'v2-poop-authorship','Someone used my bathroom and left a crime scene. I live alone.',array['group-chat','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('group-chat-evidence','group-chat',2,'mature',array['commitment','accuracy'],'v2-autocorrect-funeral','Autocorrect changed "condolences" to "congratulations." I sent a fucking balloon.',array['group-chat','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('romance-rejection','romance',1,'everyone',array['commitment','accuracy'],'v2-date-handshake','They leaned in for a kiss. I panicked and said my full legal name.',array['romance','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('romance-rejection','romance',1,'everyone',array['commitment','accuracy'],'v2-crush-door','I held the door for my crush and bowed. I do not know why I bowed.',array['romance','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('romance-rejection','romance',1,'everyone',array['commitment','accuracy'],'v3-drive-through-rehearsal','I rehearsed asking them out. They heard me through the drive-through speaker.',array['romance','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('romance-rejection','romance',1,'everyone',array['commitment','accuracy'],'v3-thumb-alibi','I watched their story in three seconds. My thumb needs an alibi.',array['romance','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('romance-rejection','romance',2,'teen',array['commitment','accuracy'],'v3-no-pressure-question-marks','I said "no pressure" and sent three question marks. Separately.',array['romance','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('romance-rejection','romance',2,'teen',array['commitment','accuracy'],'v2-read-receipt-romance','They left me on read. At least we are doing an activity together.',array['romance','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('romance-rejection','romance',2,'teen',array['commitment','accuracy'],'v3-fix-me-estimate','They said they could fix me. I asked for an estimate.',array['romance','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('romance-rejection','romance',2,'mature',array['commitment','accuracy'],'v3-dirty-service-voice','Talk dirty to me. Actually, wait. Why are you using your customer service voice?',array['romance','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('romance-rejection','romance',2,'mature',array['commitment','accuracy'],'v3-casual-wife','We are keeping it casual. I have met his wife.',array['romance','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('romance-rejection','romance',2,'mature',array['commitment','accuracy'],'v3-own-name','I tried to moan their name and said my own. Honestly? Best sex of my life.',array['romance','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('romance-rejection','romance',2,'mature',array['commitment','accuracy'],'v2-booty-call-carpool','It was a booty call. I brought snacks and asked if anyone needed a ride home.',array['romance','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('romance-rejection','romance',2,'mature',array['commitment','accuracy'],'v2-date-safe-word','Our safe word is "commitment." Apparently I said it too early.',array['romance','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('impossible-energy','wildcard',4,'everyone',array['commitment','accuracy'],'v2-final-boss-refund','I have come to collect what I am owed. It is seven dollars and you know it.',array['wildcard','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('impossible-energy','wildcard',4,'everyone',array['commitment','accuracy'],'v2-royal-laundry','I called an emergency family meeting. Nobody is allowed to ask why my eyebrows are missing.',array['wildcard','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('impossible-energy','wildcard',4,'everyone',array['commitment','accuracy'],'v3-door-single-combat','I challenged the automatic door to single combat. It only opens when I retreat.',array['wildcard','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('impossible-energy','wildcard',4,'everyone',array['commitment','accuracy'],'v2-evil-laugh','I tried to leave dramatically. The door said pull. I gave it everything.',array['wildcard','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('impossible-energy','wildcard',4,'teen',array['commitment','accuracy'],'v3-enemy-has-map','I followed my enemy to confront him. We are both lost. He has the map.',array['wildcard','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('impossible-energy','wildcard',4,'teen',array['commitment','accuracy'],'v3-hold-my-hand','Hold my glasses. And my hand. This is escalating faster than I rehearsed.',array['wildcard','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('impossible-energy','wildcard',4,'teen',array['commitment','accuracy'],'v2-power-pose','I practiced my entrance in the elevator. Someone was already in it.',array['wildcard','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('impossible-energy','wildcard',4,'mature',array['commitment','accuracy'],'v3-devil-bank-balance','I told the devil he could not afford me. He showed me my fucking bank balance.',array['wildcard','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('impossible-energy','wildcard',4,'mature',array['commitment','accuracy'],'v2-throne-toilet','I said "fear me" and my stomach made a noise like a fucking haunted drain.',array['wildcard','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('impossible-energy','wildcard',4,'mature',array['commitment','accuracy'],'v3-begging-ambulance','I dropped to my knees to beg. They cracked so loud she asked if I needed a fucking ambulance.',array['wildcard','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('impossible-energy','wildcard',4,'mature',array['commitment','accuracy'],'v3-two-men-context','I told everyone I could take two men at once. Apparently the context was important.',array['wildcard','confession'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('impossible-energy','wildcard',4,'mature',array['commitment','accuracy'],'v2-death-speech','Tell my enemies I died standing. Edit out the bit where I fell into the fucking hedge.',array['wildcard','boast'],'{"catalogVersion":"classic-content-v3","publicationStatus":"original-editorial"}'::jsonb),
    ('internet-originals','main-character',1,'everyone',array['commitment','comedy','accuracy'],'v3-ref-this-is-fine','This is fine.',array['recognizable','text-reference','short-line'],'{"catalogVersion":"classic-content-v3","publicationStatus":"short-text-editorial","recognitionSource":{"sourceUrl":"https://gunshowcomic.com/648","originalSourceUrl":"https://gunshowcomic.com/648","speaker":"KC Green; dialogue in Gunshow''s On Fire comic","context":"A character calmly denies a room on fire; original comic published January 9, 2013.","wordingVerification":"Visually read the second panel on the creator''s original page on September 5, 2026. Exact three words; sentence case normalized.","recognitionEvidence":"Documented meme history traces circulation from 2013; audience recognition has not been tested in Delivery.","recognitionSourceUrl":"https://en.wikipedia.org/wiki/Gunshow_(webcomic)","publicationRationale":"Three commonplace words used as a new player''s spoken declaration. The comic, character, fire scene, design, and merchandise identity are not reproduced.","limitations":"Editorial publication assessment, not legal clearance. Art and character rights remain outside this decision.","publicationDecision":"publish-text-only","reviewedAt":"2026-09-05"}}'::jsonb),
    ('internet-originals','main-character',1,'everyone',array['commitment','comedy','accuracy'],'v3-ref-immeasurable-disappointment','My disappointment is immeasurable and my day is ruined.',array['recognizable','text-reference','short-line'],'{"catalogVersion":"classic-content-v3","publicationStatus":"short-text-editorial","recognitionSource":{"sourceUrl":"https://www.youtube.com/watch?v=5d5NJgO38AE&t=363s","originalSourceUrl":"https://www.youtube.com/watch?v=5d5NJgO38AE","speaker":"TheReportOfTheWeek / Reviewbrah","context":"Reaction in Popeyes Cheddar Biscuit Butterfly Shrimp - Food Review, July 4, 2017.","wordingVerification":"Original upload''s English transcript at 6:03; export identifies captions as authored or unspecified. Exact nine words; punctuation normalized.","recognitionEvidence":"Source-linked meme history documents reaction-image and text reuse in July-December 2017.","recognitionSourceUrl":"https://knowyourmeme.com/memes/my-disappointment-is-immeasurable-and-my-day-is-ruined","publicationRationale":"A short, self-contained disappointed declaration used for players'' different performances. No review footage, restaurant branding, portrait, or creator imitation. The ordinary statement supports this narrow text-use decision; length alone is not the rationale.","limitations":"Creator has sold related merchandise. This is not a merchandise/branding license, endorsement, or general clearance of longer passages; rights assessment remains jurisdiction-dependent.","publicationDecision":"publish-text-only","reviewedAt":"2026-09-05"}}'::jsonb),
    ('stream-gremlins','streamer-mode',1,'everyone',array['commitment','comedy','accuracy'],'v3-ref-wednesday','It is Wednesday, my dudes.',array['recognizable','text-reference','short-line'],'{"catalogVersion":"classic-content-v3","publicationStatus":"short-text-editorial","recognitionSource":{"sourceUrl":"https://www.youtube.com/watch?v=du-TY1GUFGk","originalSourceUrl":"https://www.youtube.com/watch?v=du-TY1GUFGk","speaker":"Jimmy Here, performing an existing Wednesday meme","context":"Creator-owned upload on April 9, 2016 of his short Vine performance. The underlying frog-caption meme predates this upload.","wordingVerification":"Original creator upload''s auto-generated English transcript at 0:00 reads the exact five words. Comma and capitalization normalized; scream omitted.","recognitionEvidence":"Know Your Meme documents the 2014 Tumblr predecessor, Jimmy Here''s 2016 Vine, and more than 140 related Vine results as of March 2016.","recognitionSourceUrl":"https://knowyourmeme.com/memes/it-is-wednesday-my-dudes","publicationRationale":"A brief weekday announcement using ordinary language. Text-only performance excludes the costume, frog art, scream recording, and creator voice.","limitations":"Caption verification is not human listening. The linked YouTube upload is an authenticated creator copy, not the first publication of the meme or Vine.","publicationDecision":"publish-text-only","reviewedAt":"2026-09-05"}}'::jsonb),
    ('stream-gremlins','streamer-mode',1,'everyone',array['commitment','comedy','accuracy'],'v3-ref-emotional-damage','Emotional damage!',array['recognizable','text-reference','short-line'],'{"catalogVersion":"classic-content-v3","publicationStatus":"short-text-editorial","recognitionSource":{"sourceUrl":"https://www.youtube.com/watch?v=miD_TWmdGIY&t=66s","originalSourceUrl":"https://www.youtube.com/watch?v=miD_TWmdGIY","speaker":"Steven He","context":"Short reaction in his September 21, 2021 video-game comedy sketch.","wordingVerification":"The two words occur in the original upload''s auto-generated transcript at 1:06 and in Steven He''s own quoted explanation in YouTube''s January 10, 2024 interview.","recognitionEvidence":"In YouTube''s direct 2024 creator interview, He describes viewers repeating the phrase; this is qualitative creator testimony, not a recognition percentage.","recognitionSourceUrl":"https://blog.youtube/creator-and-artist-stories/steven-he-jeenie-weenie-collab/","publicationRationale":"Two common descriptive words. The player supplies an independent interpretation; no accent, ethnicity, character, imitation, soundbite, or targeted insult is part of the assignment.","limitations":"No use of the creator''s branded merchandise, persona, or audiovisual sketch is authorized by this text decision.","publicationDecision":"publish-text-only","reviewedAt":"2026-09-05"}}'::jsonb),
    ('stream-gremlins','streamer-mode',1,'everyone',array['commitment','comedy','accuracy'],'v3-ref-chat-is-this-real','Chat, is this real?',array['recognizable','text-reference','short-line'],'{"catalogVersion":"classic-content-v3","publicationStatus":"short-text-editorial","recognitionSource":{"sourceUrl":"https://www.urbandictionary.com/define.php?term=chat+is+this+real","originalSourceUrl":null,"speaker":"Distributed streamer/chat phrase; no single author asserted","context":"A streamer-style request for confirmation, often applied to obviously fake content.","wordingVerification":"Exact four-word question is attested in the source''s body and September 26, 2025 entry, with a June 3, 2023 ''yo'' variant. This is a documented idiom, not a verified quote from one iShowSpeed clip.","recognitionEvidence":"Know Your Meme''s June 7, 2023 entry traces streamer clips and cross-platform caption use in March-June 2023.","recognitionSourceUrl":"https://knowyourmeme.com/memes/chat-is-this-real","publicationRationale":"Ordinary question plus a generic audience address, used as distributed slang without assigning a creator or reproducing a clip.","limitations":"Earliest coinage is not established; the commonly cited iShowSpeed example only establishes one use of a related question. No 2026 popularity claim.","publicationDecision":"publish-text-only","reviewedAt":"2026-09-05"}}'::jsonb),
    ('gaming-comms','gaming',1,'teen',array['commitment','comedy','accuracy'],'v3-ref-bite-of-87','Was that the bite of ''87?!',array['recognizable','text-reference','short-line'],'{"catalogVersion":"classic-content-v3","publicationStatus":"short-text-editorial","recognitionSource":{"sourceUrl":"https://www.youtube.com/watch?v=AZgnZSmbYn0&t=580s","originalSourceUrl":"https://www.youtube.com/watch?v=AZgnZSmbYn0","speaker":"Markiplier","context":"A surprised question while playing Five Nights at Freddy''s 4, Part 5, July 27, 2015. The question is not a claim about the game''s correct chronology.","wordingVerification":"Original upload''s auto-generated English transcript at 9:40: exact six words. Apostrophe and punctuation normalized.","recognitionEvidence":"The source-linked meme entry documents remixes and quotations associated with this reaction.","recognitionSourceUrl":"https://knowyourmeme.com/memes/was-that-the-bite-of-87","publicationRationale":"A short factual-style question referencing an event name; no game dialogue sequence, game artwork, character, clip audio, or voice imitation is reproduced.","limitations":"Spicy rating acknowledges horror/injury context. This does not license Five Nights at Freddy''s assets or imply Markiplier or game-owner endorsement; captions are not human listening.","publicationDecision":"publish-text-only","reviewedAt":"2026-09-05"}}'::jsonb),
    ('gaming-comms','gaming',1,'everyone',array['commitment','comedy','accuracy'],'v3-ref-big-brain-time','Yeah, this is big brain time.',array['recognizable','text-reference','short-line'],'{"catalogVersion":"classic-content-v3","publicationStatus":"short-text-editorial","recognitionSource":{"sourceUrl":"https://www.wired.com/video/watch/markiplier-explores-his-impact-on-the-internet","originalSourceUrl":"https://www.youtube.com/watch?v=ByLrbLiSL6k","speaker":"Markiplier","context":"Boast recalled by Markiplier in WIRED''s December 18, 2019 direct interview; earlier gameplay source is Baldi''s Basics 1 Year Birthday Bash.","wordingVerification":"Exact six-word contiguous excerpt of the creator''s spoken recollection in WIRED''s published interview transcript. His preceding ''Oh'' is outside the selected excerpt. The original gameplay transcript was unavailable; not verified from its title.","recognitionEvidence":"WIRED''s interview explicitly discusses the phrase as a meme and Markiplier describes its spread. This is contemporary 2019 primary testimony.","recognitionSourceUrl":"https://www.wired.com/video/watch/markiplier-explores-his-impact-on-the-internet","publicationRationale":"Brief colloquial boast, without the edited head image, game visuals, or creator voice. Only the commonplace short expression is used.","limitations":"Source verifies the 2019 interview wording, not the first gameplay utterance. No claim that a source title verified speech or that the creator endorses Delivery.","publicationDecision":"publish-text-only","reviewedAt":"2026-09-05"}}'::jsonb),
    ('gaming-comms','gaming',1,'everyone',array['commitment','comedy','accuracy'],'v3-ref-let-him-cook','Let him cook.',array['recognizable','text-reference','short-line'],'{"catalogVersion":"classic-content-v3","publicationStatus":"short-text-editorial","recognitionSource":{"sourceUrl":"https://www.dictionary.com/culture/slang/let-him-cook","originalSourceUrl":null,"attestationUrl":"https://twitter.com/MrSmith120/status/27481570231","speaker":"Distributed slang; early use documented in Lil B fan culture","context":"Let someone continue an attempt, sincerely or with terrible confidence. Related ''let that boy cook'' wording appears in Lil B posts in 2010.","wordingVerification":"Exact three-word phrase in the dictionary''s body and embedded October 15, 2010 post. Direct historical Twitter fetch failed; not attributed as Lil B''s exact personal quote or first coinage.","recognitionEvidence":"Dictionary.com, November 7, 2023, records use across music fandom, sports, and memes with dated examples.","recognitionSourceUrl":"https://www.dictionary.com/culture/slang/let-him-cook","publicationRationale":"An ordinary three-word imperative now used as an idiom. No lyrics, music, dance, branded image, or attributed invented quote.","limitations":"Original coinage remains uncertain; the historical post is an attestation lead, not proof of authorship. Dictionary wording, not its definition, is the playable text.","publicationDecision":"publish-text-only","reviewedAt":"2026-09-05"}}'::jsonb),
    ('group-chat-evidence','group-chat',1,'everyone',array['commitment','comedy','accuracy'],'v3-ref-touch-grass','Touch grass.',array['recognizable','text-reference','short-line'],'{"catalogVersion":"classic-content-v3","publicationStatus":"short-text-editorial","recognitionSource":{"sourceUrl":"https://dictionary.cambridge.org/dictionary/english/touch-grass","originalSourceUrl":null,"speaker":"Distributed internet idiom; no individual credited","context":"A request to step away from the internet and return to the physical world.","wordingVerification":"Exact two-word idiom in Cambridge''s entry and usage examples; this is text attestation, not a creator clip quote.","recognitionEvidence":"Cambridge and Dictionary.com include the idiom; the latter dates first recording to 2015-20 and includes dated 2025-26 usage.","recognitionSourceUrl":"https://www.dictionary.com/browse/touch-grass","publicationRationale":"A two-word common imperative/idiom, without any copied definition, personal attribution, or identity asset.","limitations":"No earliest original post established. Lexicographic inclusion is evidence of use, not a measured recognition rate among players.","publicationDecision":"publish-text-only","reviewedAt":"2026-09-05"}}'::jsonb),
    ('group-chat-evidence','group-chat',1,'everyone',array['commitment','comedy','accuracy'],'v3-ref-weird-flex','Weird flex, but OK.',array['recognizable','text-reference','short-line'],'{"catalogVersion":"classic-content-v3","publicationStatus":"short-text-editorial","recognitionSource":{"sourceUrl":"https://www.dictionary.com/culture/slang/weird-flex-but-okay","originalSourceUrl":"https://twitter.com/SJSchauer/status/1044353823769268227","speaker":"Distributed internet response; prominent 2018 use by Sarah Schauer","context":"A baffled response to an unusual boast. The game does not target the people discussed in the historical tweets.","wordingVerification":"Exact four-word phrase and OK/okay variants in Dictionary.com''s entry body and embedded dated posts. Punctuation normalized; selected as an idiom, not a verbatim quote from the linked ''okay'' tweet.","recognitionEvidence":"Dictionary.com published its entry November 21, 2018 and records spread during 2018; Cambridge also includes it under flex.","recognitionSourceUrl":"https://www.dictionary.com/culture/slang/weird-flex-but-okay","publicationRationale":"Short conversational response built from common slang. No copying the longer social-media jokes, targets, avatars, or product branding.","limitations":"The linked post is a popularization source, not original coinage or exact spelling of the selected variant. Historical post access may fail.","publicationDecision":"publish-text-only","reviewedAt":"2026-09-05"}}'::jsonb),
    ('romance-rejection','romance',1,'everyone',array['commitment','comedy','accuracy'],'v3-ref-head-empty','No thoughts, head empty.',array['recognizable','text-reference','short-line'],'{"catalogVersion":"classic-content-v3","publicationStatus":"short-text-editorial","recognitionSource":{"sourceUrl":"https://www.tumblr.com/fantastic-nonsense/673568579625582592/no-thoughts-head-empty-just-remembering-wally","originalSourceUrl":null,"attestationUrl":"https://twitter.com/spruiko/status/965877427577630720","speaker":"Distributed internet caption; no creator quotation asserted","context":"A self-directed declaration of having nothing useful to say, useful for a painfully sincere or overconfident performance.","wordingVerification":"Exact four-word sequence appears in the readable body of the linked Tumblr user''s post. The reported February 20, 2018 source tweet returns 404; no first-author claim.","recognitionEvidence":"Know Your Meme''s May 20, 2020 entry documents 2018-19 caption variations and explicitly calls the origin unclear.","recognitionSourceUrl":"https://knowyourmeme.com/memes/no-thoughts-head-empty","publicationRationale":"Brief commonplace self-description used independently of the cartoon and game images associated with early captions. No attack on a named person or disability.","limitations":"The primary original post is unavailable. Published as an attested distributed phrase, not attributed to the Tumblr user as its inventor.","publicationDecision":"publish-text-only","reviewedAt":"2026-09-05"}}'::jsonb),
    ('romance-rejection','romance',1,'everyone',array['commitment','comedy','accuracy'],'v3-ref-i-like-turtles','I like turtles.',array['recognizable','text-reference','short-line'],'{"catalogVersion":"classic-content-v3","publicationStatus":"short-text-editorial","recognitionSource":{"sourceUrl":"https://shortyawards.com/16th/paramount-teenage-mutant-ninja-turtles-i-like-turtles","originalSourceUrl":null,"attestationUrl":"https://www.youtube.com/watch?v=CMNry4PE93Y","speaker":"Jonathon Ware","context":"An unexpected answer to a KGW interview at Portland''s Rose Festival in 2007; Ware reprised the phrase as an adult in 2023.","wordingVerification":"The producer''s first-person 2023 campaign case study explicitly transcribes the three-word spoken answer. The 2007 link is an archival upload by CaptJax458, not the broadcaster''s original account.","recognitionEvidence":"The 2023 campaign deliberately recreated the 2007 meme with Ware. Its award submission reports cross-platform response, which is self-reported promotional evidence, not an independent audience study.","recognitionSourceUrl":"https://shortyawards.com/16th/paramount-teenage-mutant-ninja-turtles-i-like-turtles","publicationRationale":"Three ordinary words expressing an animal preference. Player performance uses no child likeness, zombie makeup, broadcaster footage, movie characters, or endorsement; directions do not impersonate a child.","limitations":"The campaign''s agreement with Ware does not confer rights to Delivery. Publication rests on narrow ordinary-text use, not that agreement or the archival uploader''s authority.","publicationDecision":"publish-text-only","reviewedAt":"2026-09-05"}}'::jsonb),
    ('impossible-energy','wildcard',1,'everyone',array['commitment','comedy','accuracy'],'v3-ref-double-rainbow','Double rainbow all the way across the sky.',array['recognizable','text-reference','short-line'],'{"catalogVersion":"classic-content-v3","publicationStatus":"short-text-editorial","recognitionSource":{"sourceUrl":"https://www.youtube.com/watch?v=OQSNhk5ICTI&t=53s","originalSourceUrl":"https://www.youtube.com/watch?v=OQSNhk5ICTI","speaker":"Paul ''Bear'' Vasquez / Yosemitebear62","context":"Describing a rainbow outside his home in the original January 8, 2010 upload.","wordingVerification":"Exact eight-word contiguous excerpt in the original upload''s English transcript at 0:53. Captions labeled authored or unspecified. Preceding ''It''s full on'' is outside the excerpt.","recognitionEvidence":"YouTube''s December 12, 2010 year-end report placed the original sixth among its non-major-label most-watched videos as of November 2010.","recognitionSourceUrl":"https://blog.youtube/culture-and-trends/double-rainbows-annoying-oranges-and/","publicationRationale":"A short descriptive observation of a natural phenomenon. No creator audio, crying, scenery, song/remix lyrics beyond the prior spoken phrase, or identity asset is used.","limitations":"Caption verification is not human listening. The estate and music/remix rights are not licensed; only this ordinary spoken text excerpt is included.","publicationDecision":"publish-text-only","reviewedAt":"2026-09-05"}}'::jsonb),
    ('impossible-energy','wildcard',1,'mature',array['commitment','comedy','accuracy'],'v3-ref-find-out','Fuck around and find out.',array['recognizable','text-reference','short-line'],'{"catalogVersion":"classic-content-v3","publicationStatus":"short-text-editorial","recognitionSource":{"sourceUrl":"https://www.suebutler.com.au/new-words/2026/1/12/fafo","originalSourceUrl":null,"speaker":"Established vulgar idiom; no single speaker or origin claimed","context":"A warning about consequences, played as an absurd boast or restrained warning rather than a real threat toward anyone.","wordingVerification":"Exact five-word expansion in lexicographer Sue Butler''s January 12, 2026 entry and in Wiktionary''s phrase entry.","recognitionEvidence":"The dated lexicographer commentary treats the expression as established US colloquial language and discusses its acronym. That is attestation, not proof of 2026 popularity.","recognitionSourceUrl":"https://www.suebutler.com.au/new-words/2026/1/12/fafo","publicationRationale":"Common vulgar idiom with no creator attribution, quoted speech, logo, political endorsement, or copied explanatory text. Mature opt-in is required.","limitations":"Earliest coinage is disputed. Do not attach political imagery, a named target, or authentic-threat context to this performance assignment.","publicationDecision":"publish-text-only","reviewedAt":"2026-09-05"}}'::jsonb)
), upserted as (
  insert into public.prompts (slug, body, category, difficulty, rating, scoring_focus, tags, locale, state, source, draw_enabled, metadata)
  select slug, body, category, difficulty::smallint, rating::public.content_rating, scoring_focus, tags, 'en', 'published', 'built_in', true, metadata
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

-- Retire only replaced Step 1 identities; old body/state/history joins are unchanged.
update public.prompts set draw_enabled = false where slug in (
  'v2-apology-draft', 'v2-wrong-door', 'v2-god-favorites', 'v2-tutorial-betrayal', 'v2-open-mic', 'v2-sponsor-candle', 'v2-chat-receipts', 'v2-training-dummy', 'v2-controller-alibi', 'v2-accidental-like', 'v2-birthday-investigation', 'v2-screenshot-spiral', 'v2-voice-note-laugh', 'v2-group-chat-court', 'v2-date-bread', 'v2-crush-story', 'v2-date-split', 'v2-hot-red-flag', 'v2-dirty-talk-weather', 'v2-situationship-app', 'v2-sexy-voice', 'v2-destiny-password', 'v2-revenge-calendar', 'v2-fear-chihuahua', 'v2-god-receipt', 'v2-knees-cracked', 'v2-demons-rent'
);
update public.energy_modifiers set draw_enabled = false where slug in (
  'v2-hold-laugh', 'v2-last-voicemail', 'v2-press-conference-v2', 'v2-soft-threat', 'v2-bedtime-catastrophe', 'v2-documentary-scandal', 'v2-fake-casual', 'v2-sports-final', 'v2-horror-realization', 'v2-news-desk', 'v2-bad-interrogation', 'v2-delayed-laugh'
);
-- END CLASSIC V3 CATALOG
