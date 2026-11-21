export type LangCode =
  | 'en-US'
  | 'es-ES'
  | 'fr-FR'
  | 'de-DE'
  | 'it-IT'
  | 'pt-BR'
  | 'nl-NL'
  | 'sv-SE'
  | 'da-DK'
  | 'no-NO'
  | 'fi-FI'
  | 'pl-PL'
  | 'cs-CZ'
  | 'sk-SK'
  | 'hu-HU'
  | 'ro-RO'
  | 'ru-RU'
  | 'uk-UA'
  | 'bg-BG'
  | 'el-GR'
  | 'tr-TR'
  | 'ar-EG'
  | 'he-IL'
  | 'fa-IR'
  | 'hi-IN'
  | 'bn-BD'
  | 'ur-PK'
  | 'ta-IN'
  | 'th-TH'
  | 'vi-VN'
  | 'id-ID'
  | 'ms-MY'
  | 'fil-PH'
  | 'zh-CN'
  | 'zh-TW'
  | 'ja-JP'
  | 'ko-KR'
  | 'sw-KE'
  | 'af-ZA'
  | 'cy-GB'
  | 'am-ET'
  | 'az-AZ'
  | 'bs-BA'
  | 'ca-ES'
  | 'et-EE'
  | 'ga-IE'
  | 'gl-ES'
  | 'hr-HR'
  | 'is-IS'
  | 'jv-ID'
  | 'ka-GE'
  | 'kk-KZ'
  | 'km-KH'
  | 'lo-LA'
  | 'lt-LT'
  | 'lv-LV'
  | 'mk-MK'
  | 'mn-MN'
  | 'mt-MT'
  | 'my-MM'
  | 'ne-NP'
  | 'ps-AF'
  | 'si-LK'
  | 'sl-SI'
  | 'so-SO'
  | 'sq-AL'
  | 'sr-RS'
  | 'su-ID'
  | 'te-IN'
  | 'uz-UZ'
  | 'zh-HK'
  | 'zu-ZA'

/** 1 = instantly recognisable, 2 = recognisable, 3 = expert (confusable pairs). */
export type Tier = 1 | 2 | 3

export interface Language {
  code: LangCode
  name: string
  nativeName: string
  flag: string
  family: string
  tier: Tier
  /**
   * Default edge-tts voice id, validated against `edge-tts --list-voices`. Clips
   * are recorded with `VOICES_BY_LANG` (voices.ts); this is the fallback and
   * defines the locale family those voices are drawn from.
   */
  voice: string
  /** One-line fact shown on the reveal screen. */
  fact: string
}

export const LANGUAGES: Language[] = [
  // Tier 1 — instantly recognisable
  { code: 'en-US', name: 'English', nativeName: 'English', flag: '🇺🇸', family: 'Germanic', tier: 1, voice: 'en-US-AriaNeural', fact: 'English is the most widely studied foreign language in the world.' },
  { code: 'es-ES', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', family: 'Romance', tier: 1, voice: 'es-ES-ElviraNeural', fact: 'Spanish is the official language of 20 countries.' },
  { code: 'fr-FR', name: 'French', nativeName: 'Français', flag: '🇫🇷', family: 'Romance', tier: 1, voice: 'fr-FR-DeniseNeural', fact: 'French was the language of the English court for about 300 years after 1066.' },
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', family: 'Germanic', tier: 1, voice: 'de-DE-TanjaNeural', fact: 'German capitalises every noun, not just proper names.' },
  { code: 'it-IT', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', family: 'Romance', tier: 1, voice: 'it-IT-ElsaNeural', fact: 'Standard Italian grew out of the Tuscan dialect of Dante.' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português', flag: '🇧🇷', family: 'Romance', tier: 1, voice: 'pt-BR-FranciscaNeural', fact: 'Brazil has more Portuguese speakers than Portugal by a factor of about twenty.' },
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', family: 'Japonic', tier: 1, voice: 'ja-JP-NanamiNeural', fact: 'Japanese mixes three scripts: kanji, hiragana and katakana.' },
  { code: 'ko-KR', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', family: 'Koreanic', tier: 1, voice: 'ko-KR-SunHiNeural', fact: 'The Hangul alphabet was designed deliberately in the 15th century under King Sejong.' },
  { code: 'ar-EG', name: 'Arabic (Egypt)', nativeName: 'العربية', flag: '🇪🇬', family: 'Semitic', tier: 1, voice: 'ar-EG-SalmaNeural', fact: 'Egyptian Arabic is widely understood across the Arab world thanks to Egyptian film and TV.' },

  // Tier 2 — recognisable
  { code: 'nl-NL', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', family: 'Germanic', tier: 2, voice: 'nl-NL-FennaNeural', fact: 'Dutch gave English words like "cookie", "boss" and "yacht".' },
  { code: 'fi-FI', name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮', family: 'Uralic', tier: 2, voice: 'fi-FI-NooraNeural', fact: 'Finnish has 15 grammatical cases and no grammatical gender.' },
  { code: 'pl-PL', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', family: 'Slavic', tier: 2, voice: 'pl-PL-ZofiaNeural', fact: 'Polish stress almost always falls on the second-to-last syllable.' },
  { code: 'hu-HU', name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺', family: 'Uralic', tier: 2, voice: 'hu-HU-NoemiNeural', fact: 'Hungarian always stresses the first syllable of a word.' },
  { code: 'ro-RO', name: 'Romanian', nativeName: 'Română', flag: '🇷🇴', family: 'Romance', tier: 2, voice: 'ro-RO-AlinaNeural', fact: 'Romanian is the only major Romance language that attaches the definite article to the end of nouns.' },
  { code: 'bg-BG', name: 'Bulgarian', nativeName: 'Български', flag: '🇧🇬', family: 'Slavic', tier: 2, voice: 'bg-BG-KalinaNeural', fact: 'The Cyrillic script was developed in the First Bulgarian Empire.' },
  { code: 'el-GR', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷', family: 'Hellenic', tier: 2, voice: 'el-GR-AthinaNeural', fact: 'Greek has over 3,000 years of written history.' },
  { code: 'tr-TR', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', family: 'Turkic', tier: 2, voice: 'tr-TR-EmelNeural', fact: 'Turkish switched from Arabic to Latin script in 1928.' },
  { code: 'he-IL', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱', family: 'Semitic', tier: 2, voice: 'he-IL-HilaNeural', fact: 'Hebrew was revived as an everyday spoken language in the late 19th century.' },
  { code: 'fa-IR', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷', family: 'Indo-Iranian', tier: 2, voice: 'fa-IR-DilaraNeural', fact: 'Persian has no grammatical gender — one pronoun covers "he" and "she".' },
  { code: 'th-TH', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭', family: 'Kra–Dai', tier: 2, voice: 'th-TH-PremwadeeNeural', fact: 'Thai has five lexical tones and writes without spaces between words.' },
  { code: 'vi-VN', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', family: 'Austroasiatic', tier: 2, voice: 'vi-VN-HoaiMyNeural', fact: 'Vietnamese uses a Latin alphabet with diacritics to mark six tones.' },
  { code: 'fil-PH', name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭', family: 'Austronesian', tier: 2, voice: 'fil-PH-BlessicaNeural', fact: 'Filipino borrows heavily from Spanish and English — "Taglish" mixing is common.' },
  { code: 'sw-KE', name: 'Swahili', nativeName: 'Kiswahili', flag: '🇰🇪', family: 'Bantu', tier: 2, voice: 'sw-KE-ZuriNeural', fact: 'Swahili is a lingua franca for over 100 million people in East Africa.' },
  { code: 'af-ZA', name: 'Afrikaans', nativeName: 'Afrikaans', flag: '🇿🇦', family: 'Germanic', tier: 2, voice: 'af-ZA-AdriNeural', fact: 'Afrikaans developed from 17th-century Dutch spoken in the Cape Colony.' },
  { code: 'cy-GB', name: 'Welsh', nativeName: 'Cymraeg', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', family: 'Celtic', tier: 2, voice: 'cy-GB-NiaNeural', fact: 'Welsh changes the first sound of words in certain contexts, a feature called mutation.' },
  { code: 'ca-ES', name: 'Catalan', nativeName: 'Català', flag: '🇪🇸', family: 'Romance', tier: 2, voice: 'ca-ES-JoanaNeural', fact: 'Andorra is the only country in the world where Catalan is the sole official language.' },
  { code: 'hr-HR', name: 'Croatian', nativeName: 'Hrvatski', flag: '🇭🇷', family: 'Slavic', tier: 2, voice: 'hr-HR-GabrijelaNeural', fact: 'Croatian dialect groups are named after their word for "what": što, kaj and ča.' },
  { code: 'sr-RS', name: 'Serbian', nativeName: 'Српски', flag: '🇷🇸', family: 'Slavic', tier: 2, voice: 'sr-RS-SophieNeural', fact: 'Serbian is fully digraphic: Cyrillic and Latin are both in everyday use, often on the same street.' },
  { code: 'sl-SI', name: 'Slovenian', nativeName: 'Slovenščina', flag: '🇸🇮', family: 'Slavic', tier: 2, voice: 'sl-SI-PetraNeural', fact: 'Slovenian still has the dual: separate word forms for exactly two of something.' },
  { code: 'et-EE', name: 'Estonian', nativeName: 'Eesti', flag: '🇪🇪', family: 'Uralic', tier: 2, voice: 'et-EE-AnuNeural', fact: 'Estonian distinguishes three lengths of sound — short, long and overlong — a rarity among languages.' },
  { code: 'lv-LV', name: 'Latvian', nativeName: 'Latviešu', flag: '🇱🇻', family: 'Baltic', tier: 2, voice: 'lv-LV-EveritaNeural', fact: 'Latvian and Lithuanian are the last surviving Baltic languages; Old Prussian died out around 1700.' },
  { code: 'lt-LT', name: 'Lithuanian', nativeName: 'Lietuvių', flag: '🇱🇹', family: 'Baltic', tier: 2, voice: 'lt-LT-OnaNeural', fact: 'Lithuanian keeps so many ancient Indo-European features that linguists compare it with Sanskrit.' },
  { code: 'is-IS', name: 'Icelandic', nativeName: 'Íslenska', flag: '🇮🇸', family: 'Germanic', tier: 2, voice: 'is-IS-GudrunNeural', fact: 'Icelandic coins native words instead of borrowing: "tölva" (computer) blends "tala" (number) and "völva" (prophetess).' },
  { code: 'sq-AL', name: 'Albanian', nativeName: 'Shqip', flag: '🇦🇱', family: 'Albanian', tier: 2, voice: 'sq-AL-AnilaNeural', fact: 'Albanian forms its own branch of the Indo-European family, with no close living relatives.' },
  { code: 'ka-GE', name: 'Georgian', nativeName: 'ქართული', flag: '🇬🇪', family: 'Kartvelian', tier: 2, voice: 'ka-GE-EkaNeural', fact: 'The Georgian verb გვფრცქვნი ("you peel us") stacks eight consonants without a single vowel.' },
  { code: 'az-AZ', name: 'Azerbaijani', nativeName: 'Azərbaycanca', flag: '🇦🇿', family: 'Turkic', tier: 2, voice: 'az-AZ-BanuNeural', fact: 'Azerbaijani changed alphabet three times in the 20th century: Arabic to Latin, to Cyrillic, and back to Latin in 1991.' },
  { code: 'zh-HK', name: 'Cantonese', nativeName: '廣東話', flag: '🇭🇰', family: 'Sino-Tibetan', tier: 2, voice: 'zh-HK-HiuGaaiNeural', fact: 'Cantonese keeps the final -p, -t and -k sounds of Middle Chinese that Mandarin lost, and has six tones.' },
  { code: 'zu-ZA', name: 'Zulu', nativeName: 'isiZulu', flag: '🇿🇦', family: 'Bantu', tier: 2, voice: 'zu-ZA-ThandoNeural', fact: 'Zulu has three click consonants, written c, q and x, borrowed from neighbouring Khoisan languages.' },
  { code: 'uz-UZ', name: 'Uzbek', nativeName: 'Oʻzbekcha', flag: '🇺🇿', family: 'Turkic', tier: 2, voice: 'uz-UZ-MadinaNeural', fact: 'Uzbek is the most widely spoken Turkic language after Turkish.' },
  { code: 'kk-KZ', name: 'Kazakh', nativeName: 'Қазақ тілі', flag: '🇰🇿', family: 'Turkic', tier: 2, voice: 'kk-KZ-AigulNeural', fact: 'Kazakhstan is gradually moving Kazakh from the Cyrillic alphabet to a Latin one.' },

  // Tier 3 — expert: confusable groups live together here
  { code: 'sv-SE', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪', family: 'Germanic', tier: 3, voice: 'sv-SE-SofieNeural', fact: 'Swedish has a pitch accent that can distinguish otherwise identical words.' },
  { code: 'da-DK', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰', family: 'Germanic', tier: 3, voice: 'da-DK-ChristelNeural', fact: 'Danish has the "stød", a creaky glottal feature that can change word meaning.' },
  { code: 'no-NO', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴', family: 'Germanic', tier: 3, voice: 'nb-NO-PernilleNeural', fact: 'Norwegian has two official written standards: Bokmål and Nynorsk.' },
  { code: 'cs-CZ', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿', family: 'Slavic', tier: 3, voice: 'cs-CZ-VlastaNeural', fact: 'Czech has the sound "ř", found in almost no other language.' },
  { code: 'sk-SK', name: 'Slovak', nativeName: 'Slovenčina', flag: '🇸🇰', family: 'Slavic', tier: 3, voice: 'sk-SK-ViktoriaNeural', fact: 'Slovak and Czech are largely mutually intelligible.' },
  { code: 'ru-RU', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', family: 'Slavic', tier: 3, voice: 'ru-RU-SvetlanaNeural', fact: 'Russian is the most widely spoken Slavic language.' },
  { code: 'uk-UA', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦', family: 'Slavic', tier: 3, voice: 'uk-UA-PolinaNeural', fact: 'Ukrainian uses the letters і, ї and є, which Russian does not.' },
  { code: 'id-ID', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', family: 'Austronesian', tier: 3, voice: 'id-ID-GadisNeural', fact: 'Indonesian is a standardised form of Malay, chosen as a national language in 1928.' },
  { code: 'ms-MY', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾', family: 'Austronesian', tier: 3, voice: 'ms-MY-YasminNeural', fact: 'Malay was a trade language across the Strait of Malacca for centuries.' },
  { code: 'zh-CN', name: 'Mandarin (Mainland)', nativeName: '普通话', flag: '🇨🇳', family: 'Sino-Tibetan', tier: 3, voice: 'zh-CN-XiaoxiaoNeural', fact: 'Mainland China writes Mandarin in simplified characters.' },
  { code: 'zh-TW', name: 'Mandarin (Taiwan)', nativeName: '國語', flag: '🇹🇼', family: 'Sino-Tibetan', tier: 3, voice: 'zh-TW-HsiaoChenNeural', fact: 'Taiwanese Mandarin uses traditional characters and has a softer, less retroflex accent.' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', family: 'Indo-Aryan', tier: 3, voice: 'hi-IN-SwaraNeural', fact: 'Spoken Hindi and Urdu are close enough that they are often called Hindustani.' },
  { code: 'ur-PK', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰', family: 'Indo-Aryan', tier: 3, voice: 'ur-PK-UzmaNeural', fact: 'Urdu is written right-to-left in the Nastaliq style of Perso-Arabic script.' },
  { code: 'bn-BD', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩', family: 'Indo-Aryan', tier: 3, voice: 'bn-BD-NabanitaNeural', fact: 'International Mother Language Day commemorates the 1952 Bengali Language Movement.' },
  { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', family: 'Dravidian', tier: 3, voice: 'ta-IN-PallaviNeural', fact: 'Tamil is Dravidian, not Indo-Aryan, and has a literary tradition over 2,000 years old.' },
  { code: 'bs-BA', name: 'Bosnian', nativeName: 'Bosanski', flag: '🇧🇦', family: 'Slavic', tier: 3, voice: 'bs-BA-VesnaNeural', fact: 'Bosnian keeps an "h" its neighbours dropped: coffee is "kahva", where Croatian says "kava" and Serbian "kafa".' },
  { code: 'mk-MK', name: 'Macedonian', nativeName: 'Македонски', flag: '🇲🇰', family: 'Slavic', tier: 3, voice: 'mk-MK-MarijaNeural', fact: 'Macedonian has three definite articles, depending on whether the thing is near, far or neither.' },
  { code: 'ga-IE', name: 'Irish', nativeName: 'Gaeilge', flag: '🇮🇪', family: 'Celtic', tier: 3, voice: 'ga-IE-OrlaNeural', fact: 'Irish has no words for "yes" and "no" — you answer by repeating the verb of the question.' },
  { code: 'gl-ES', name: 'Galician', nativeName: 'Galego', flag: '🇪🇸', family: 'Romance', tier: 3, voice: 'gl-ES-SabelaNeural', fact: 'King Alfonso X of Castile wrote his Cantigas de Santa Maria in Galician-Portuguese, then the language of Iberian lyric poetry.' },
  { code: 'mt-MT', name: 'Maltese', nativeName: 'Malti', flag: '🇲🇹', family: 'Semitic', tier: 3, voice: 'mt-MT-GraceNeural', fact: 'Maltese is the only Semitic language written in the Latin alphabet and the only one official in the EU.' },
  { code: 'mn-MN', name: 'Mongolian', nativeName: 'Монгол', flag: '🇲🇳', family: 'Mongolic', tier: 3, voice: 'mn-MN-YesuiNeural', fact: 'Traditional Mongolian script is written vertically, top to bottom, and is still taught alongside Cyrillic.' },
  { code: 'ne-NP', name: 'Nepali', nativeName: 'नेपाली', flag: '🇳🇵', family: 'Indo-Aryan', tier: 3, voice: 'ne-NP-HemkalaNeural', fact: 'Nepali is also an official language of the Indian state of Sikkim.' },
  { code: 'si-LK', name: 'Sinhala', nativeName: 'සිංහල', flag: '🇱🇰', family: 'Indo-Aryan', tier: 3, voice: 'si-LK-ThiliniNeural', fact: 'Sinhala is related to Hindi and Bengali, but has developed in isolation on Sri Lanka for over 2,000 years.' },
  { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳', family: 'Dravidian', tier: 3, voice: 'te-IN-ShrutiNeural', fact: 'Because almost every Telugu word ends in a vowel, it has been nicknamed "the Italian of the East".' },
  { code: 'ps-AF', name: 'Pashto', nativeName: 'پښتو', flag: '🇦🇫', family: 'Indo-Iranian', tier: 3, voice: 'ps-AF-LatifaNeural', fact: 'Pashto adds letters found in no other Arabic-script language, such as ټ and ړ, marked with a small ring.' },
  { code: 'am-ET', name: 'Amharic', nativeName: 'አማርኛ', flag: '🇪🇹', family: 'Semitic', tier: 3, voice: 'am-ET-MekdesNeural', fact: 'Amharic is the second most spoken Semitic language after Arabic; each Ge’ez character is a consonant–vowel pair.' },
  { code: 'so-SO', name: 'Somali', nativeName: 'Soomaali', flag: '🇸🇴', family: 'Cushitic', tier: 3, voice: 'so-SO-UbaxNeural', fact: 'Somali got an official alphabet only in 1972; in it, "c" and "x" stand for throat sounds.' },
  { code: 'km-KH', name: 'Khmer', nativeName: 'ភាសាខ្មែរ', flag: '🇰🇭', family: 'Austroasiatic', tier: 3, voice: 'km-KH-SreymomNeural', fact: 'Unlike its neighbours Thai, Lao and Vietnamese, Khmer is not a tonal language.' },
  { code: 'lo-LA', name: 'Lao', nativeName: 'ພາສາລາວ', flag: '🇱🇦', family: 'Kra–Dai', tier: 3, voice: 'lo-LA-KeomanyNeural', fact: 'More native Lao speakers live in northeastern Thailand (Isan) than in Laos itself.' },
  { code: 'my-MM', name: 'Burmese', nativeName: 'မြန်မာဘာသာ', flag: '🇲🇲', family: 'Sino-Tibetan', tier: 3, voice: 'my-MM-NilarNeural', fact: 'Burmese letters are built from circles, a shape often credited to writing on palm leaves, which straight strokes would tear.' },
  { code: 'jv-ID', name: 'Javanese', nativeName: 'Basa Jawa', flag: '🇮🇩', family: 'Austronesian', tier: 3, voice: 'jv-ID-SitiNeural', fact: 'Javanese has speech levels — ngoko and krama — that can swap out most of the words depending on whom you address.' },
  { code: 'su-ID', name: 'Sundanese', nativeName: 'Basa Sunda', flag: '🇮🇩', family: 'Austronesian', tier: 3, voice: 'su-ID-TutiNeural', fact: 'Sundanese is the second-largest regional language of Indonesia, after Javanese, with tens of millions of speakers.' },
]
