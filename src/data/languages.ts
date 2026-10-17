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
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', family: 'Germanic', tier: 1, voice: 'de-DE-KatjaNeural', fact: 'German capitalises every noun, not just proper names.' },
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
]
