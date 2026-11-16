import { GroundedCompetitorData } from "./chat-context";

export interface VerificationResult {
  isValid: boolean;
  violations: string[];
  sanitizedText: string;
}

// Known common frontier LLM models that must NOT be mentioned unless backed by database records
const RESTRICTED_MODEL_PATTERNS = [
  /\bgpt-5\b/i,
  /\bgpt-4\.5\b/i,
  /\bgpt-4o\b/i,
  /\bgpt-4\b/i,
  /\bgpt-3\.5\b/i,
  /\bo1\b/i,
  /\bo3\b/i,
  /\bclaude 3\.7\b/i,
  /\bclaude 3\.5 sonnet\b/i,
  /\bclaude 3\.5 haiku\b/i,
  /\bclaude 3 opus\b/i,
  /\bclaude 3 sonnet\b/i,
  /\bclaude 2\b/i,
  /\bgemini 2\.0\b/i,
  /\bgemini 1\.5 pro\b/i,
  /\bgemini 1\.5 flash\b/i,
  /\bgemini 1\.0 ultra\b/i,
  /\bgemini pro\b/i,
  /\bgemini ultra\b/i,
  /\bgemini flash\b/i,
  /\bdeepseek-r1\b/i,
  /\bdeepseek-v3\b/i,
  /\bllama 3\.3\b/i,
  /\bllama 3\.1\b/i,
  /\bllama 3\b/i,
];

/**
 * Extracts all verified feature strings, plan names, descriptions, and values
 * from the grounded competitor database context.
 */
function buildVerifiedVocabulary(competitorsData: GroundedCompetitorData[]): Set<string> {
  const verifiedTerms = new Set<string>();

  for (const c of competitorsData) {
    verifiedTerms.add(c.name.toLowerCase());
    if (c.description) {
      c.description.toLowerCase().split(/\s+/).forEach((w) => verifiedTerms.add(w));
    }
    for (const p of c.plans) {
      verifiedTerms.add(p.planName.toLowerCase());
      for (const f of p.features) {
        verifiedTerms.add(f.toLowerCase());
      }
      for (const fs of p.featureSnapshots) {
        verifiedTerms.add(fs.name.toLowerCase());
        if (fs.value) verifiedTerms.add(fs.value.toLowerCase());
      }
    }
    for (const uf of c.unassociatedFeatures) {
      verifiedTerms.add(uf.name.toLowerCase());
      if (uf.value) verifiedTerms.add(uf.value.toLowerCase());
    }
  }

  return verifiedTerms;
}

/**
 * Verifies and enforces evidence grounding on generated LLM responses.
 * 1. Checks for ungrounded AI model names not present in verified database records.
 * 2. Prevents unsupported "unlimited" claims when quotas are missing.
 * 3. Sanitizes unsupported claims and appends an explicit grounding disclaimer if needed.
 */
export function verifyAndSanitizeResponse(
  generatedText: string,
  competitorsData: GroundedCompetitorData[]
): VerificationResult {
  const violations: string[] = [];
  const verifiedVocab = buildVerifiedVocabulary(competitorsData);
  let sanitizedText = generatedText;

  // 1. Verify restricted model names
  for (const pattern of RESTRICTED_MODEL_PATTERNS) {
    const match = sanitizedText.match(pattern);
    if (match) {
      const modelClaim = match[0];
      // Check if this model is actually verified in the competitor database context
      const isVerified = Array.from(verifiedVocab).some((term) =>
        term.includes(modelClaim.toLowerCase())
      );

      if (!isVerified) {
        violations.push(`Unsupported model claim detected: "${modelClaim}"`);
        // Replace unsupported model claim with "model (unspecified in database records)"
        sanitizedText = sanitizedText.replace(
          new RegExp(`\\b${modelClaim}\\b`, "gi"),
          `${modelClaim} [Not specified in database records]`
        );
      }
    }
  }

  // 2. Prevent unwarranted claims of "unlimited" usage when the competitor's quotas are not specified
  // We check for "unlimited" on a per-competitor or per-quota basis
  const unlimitedRegex = /\b(unlimited (queries|tokens|requests|messages|prompts|usage|credits|generations))\b/gi;
  sanitizedText = sanitizedText.replace(unlimitedRegex, (match, p1) => {
    // Check if the specific unlimited claim (e.g. "unlimited tokens") is supported in DB features
    const isExactMatch = Array.from(verifiedVocab).some((term) =>
      term.includes(match.toLowerCase())
    );
    if (!isExactMatch) {
      violations.push(`Unverified claim of unlimited quota: "${match}"`);
      return `${p1} [Quota not specified in database records]`;
    }
    return match;
  });

  // 3. Ensure mandatory sections exist (Verified Database Facts, Derived Observations, Strategic Recommendations)
  const hasFacts = /### 1\. Verified Database Facts|### 1\. Executive Summary/i.test(sanitizedText);
  const hasRecommendations = /### 3\. Strategic Recommendations|### 4\. Strategic/i.test(sanitizedText);

  if (!hasFacts || !hasRecommendations) {
    violations.push("Response lacked explicit section separation between verified facts and recommendations.");
  }

  return {
    isValid: violations.length === 0,
    violations,
    sanitizedText,
  };
}
