import nlp from 'compromise';

export function extractProjectCandidates(rawText: string): string[] {
    const candidates: Set<string> = new Set();
    const doc = nlp(rawText);

    // Helper to aggressive clean punctuation and whitespace
    const cleanText = (t: string) => t.replace(/[?.!,"]+$/, "").trim();

    // 1. Regex Strategy (Prioritized - Structural match)
    // Matches "projeto X", "sobre o projeto X", "do projeto X"
    const regexMatch = rawText.match(/(?:projeto|sobre o projeto|do projeto)\s+(.+)/i);
    if (regexMatch) {
        let clean = cleanText(regexMatch[1]);
        candidates.add(clean);

        // Also add version without prepositions if not already there
        // "do FENATI" -> "FENATI"
        // "sobre o FENATI" -> "FENATI"
        const withoutPrep = clean.replace(/^(do|da|de|sobre o|no)\s+/i, "");
        if (withoutPrep !== clean) {
            candidates.add(withoutPrep);
        }
    }

    // 2. NLP Topic/Noun extraction (Secondary)
    // These might catch "FENATI" correctly but also junk like "Como ta o projeto"
    // We filter out long phrases to avoid full sentences
    const addClean = (list: string[]) => {
        list.forEach(item => {
            const c = cleanText(item);
            // Heuristic: If it has > 4 words, it's probably not a project name, it's a sentence snippet
            if (c.split(/\s+/).length < 5) {
                candidates.add(c);
            }
        });
    };

    addClean(doc.topics().out('array'));
    addClean(doc.nouns().out('array'));

    // 3. Fallback: The whole clean text if it's short (likely just the name)
    const rawClean = cleanText(rawText);
    if (rawClean.length < 50 && rawClean.split(/\s+/).length < 6) {
        candidates.add(rawClean);
    }

    // Filter out very short words (<= 2 chars)
    return Array.from(candidates).filter(c => c.length > 2);
}
