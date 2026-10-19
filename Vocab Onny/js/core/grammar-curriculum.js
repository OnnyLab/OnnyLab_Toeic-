export const TOEIC_GRAMMAR_CHAPTERS = Object.freeze([
  {
    id: "word-forms",
    no: "01",
    title: "Word Forms & Parts of Speech",
    shortTitle: "Word Forms",
    thai: "ชนิดคำและการเปลี่ยนรูปคำ",
    description: "Noun, Verb, Adjective, Adverb และการเลือกชนิดคำให้เข้ากับตำแหน่งในประโยค"
  },
  {
    id: "nouns-quantifiers",
    no: "02",
    title: "Nouns & Quantifiers",
    shortTitle: "Nouns",
    thai: "คำนามและคำบอกปริมาณ",
    description: "Countable/Uncountable, singular/plural, much, many, few, little, each, every"
  },
  {
    id: "pronouns",
    no: "03",
    title: "Pronouns",
    shortTitle: "Pronouns",
    thai: "คำสรรพนาม",
    description: "Subject, Object, Possessive, Reflexive และการเลือก pronoun ให้ตรงหน้าที่"
  },
  {
    id: "articles-determiners",
    no: "04",
    title: "Articles & Determiners",
    shortTitle: "Articles",
    thai: "คำนำหน้านาม",
    description: "a, an, the, this, that, these, those และ determiners ที่พบบ่อย"
  },
  {
    id: "subject-verb",
    no: "05",
    title: "Subject–Verb Agreement",
    shortTitle: "S–V Agreement",
    thai: "ประธานและกริยา",
    description: "เอกพจน์/พหูพจน์, each/every/neither และโครงสร้างที่ทำให้ประธานสับสน"
  },
  {
    id: "tenses",
    no: "06",
    title: "Verb Tenses",
    shortTitle: "Tenses",
    thai: "กาลของกริยา",
    description: "Present, Past, Future, Perfect และ Continuous ในบริบทธุรกิจ"
  },
  {
    id: "passive",
    no: "07",
    title: "Passive Voice",
    shortTitle: "Passive Voice",
    thai: "ประโยค Passive",
    description: "be + past participle และการเลือก Active/Passive ให้ตรงความหมาย"
  },
  {
    id: "modals",
    no: "08",
    title: "Modals & Auxiliaries",
    shortTitle: "Modals",
    thai: "กริยาช่วย",
    description: "can, could, may, might, must, should, will, would และ auxiliary verbs"
  },
  {
    id: "gerunds-infinitives",
    no: "09",
    title: "Gerunds & Infinitives",
    shortTitle: "Gerund / Infinitive",
    thai: "Gerund และ Infinitive",
    description: "verb + -ing, to + verb และรูปกริยาหลังคำที่พบบ่อยใน TOEIC"
  },
  {
    id: "participles",
    no: "10",
    title: "Participles",
    shortTitle: "Participles",
    thai: "V-ing / V-ed",
    description: "Present/Past participles ที่ทำหน้าที่ขยายคำนามและใช้ใน reduced clauses"
  },
  {
    id: "adj-adv-comparison",
    no: "11",
    title: "Adjectives, Adverbs & Comparisons",
    shortTitle: "Adj / Adv",
    thai: "คำคุณศัพท์ คำกริยาวิเศษณ์ และการเปรียบเทียบ",
    description: "ตำแหน่ง adjective/adverb, comparative และ superlative"
  },
  {
    id: "prepositions",
    no: "12",
    title: "Prepositions",
    shortTitle: "Prepositions",
    thai: "คำบุพบท",
    description: "เวลา สถานที่ ทิศทาง และ prepositional phrases ที่พบในบริบทธุรกิจ"
  },
  {
    id: "conjunctions",
    no: "13",
    title: "Conjunctions & Connectors",
    shortTitle: "Connectors",
    thai: "คำเชื่อม",
    description: "because, although, while, unless, therefore, however และตัวเชื่อมข้อความ"
  },
  {
    id: "relative-clauses",
    no: "14",
    title: "Relative Clauses",
    shortTitle: "Relative Clauses",
    thai: "อนุประโยคขยายคำนาม",
    description: "who, whom, whose, which, that, where และ reduced relative clauses"
  },
  {
    id: "conditionals",
    no: "15",
    title: "Conditionals",
    shortTitle: "Conditionals",
    thai: "ประโยคเงื่อนไข",
    description: "if, unless และโครงสร้างเงื่อนไขที่ใช้กับสถานการณ์ปัจจุบัน/อนาคต"
  },
  {
    id: "sentence-clauses",
    no: "16",
    title: "Sentence Structure & Clauses",
    shortTitle: "Sentence Structure",
    thai: "โครงสร้างประโยคและอนุประโยค",
    description: "Independent/Dependent clauses, noun clauses, embedded questions และ parallel structure"
  }
]);

export function getGrammarChapter(id) {
  return TOEIC_GRAMMAR_CHAPTERS.find(
    (chapter) => chapter.id === id
  ) || null;
}

export function getGrammarChapterOptions() {
  return TOEIC_GRAMMAR_CHAPTERS.map((chapter) => ({
    value: chapter.id,
    label: chapter.no + " · " + chapter.title
  }));
}

export function inferGrammarChapterId(topic = "") {
  const text = String(topic || "").trim().toLowerCase();

  const rules = [
    ["word-forms", ["word form", "parts of speech", "noun form", "verb form", "adjective form", "adverb form"]],
    ["nouns-quantifiers", ["noun", "quantifier", "countable", "uncountable", "many", "much"]],
    ["pronouns", ["pronoun", "possessive", "reflexive"]],
    ["articles-determiners", ["article", "determiner"]],
    ["subject-verb", ["subject", "agreement", "neither", "either"]],
    ["tenses", ["tense", "present", "past", "future", "perfect"]],
    ["passive", ["passive", "active voice"]],
    ["modals", ["modal", "auxiliary", "should", "must", "could"]],
    ["gerunds-infinitives", ["gerund", "infinitive"]],
    ["participles", ["participle", "v-ing", "v-ed"]],
    ["adj-adv-comparison", ["adjective", "adverb", "comparative", "superlative"]],
    ["prepositions", ["preposition"]],
    ["conjunctions", ["conjunction", "connector", "although", "because"]],
    ["relative-clauses", ["relative", "who", "which", "that clause"]],
    ["conditionals", ["conditional", "if clause", "unless"]],
    ["sentence-clauses", ["word order", "question form", "sentence", "clause", "parallel"]]
  ];

  for (const [id, keywords] of rules) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      return id;
    }
  }

  return "sentence-clauses";
}
