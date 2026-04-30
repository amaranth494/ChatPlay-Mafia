export type TraitId = typeof STARTER_TRAITS[number];

export type TargetType = 'player' | 'npc' | 'family' | 'police' | 'self' | 'world';

export type Intensity = 'minor' | 'moderate' | 'major' | 'defining';

export interface TraitDefinition {
  id: string;
  category: 'emotion' | 'relationship' | 'skill' | 'status' | 'loyalty';
  conflictsWith?: string[];
  promptHint?: string;
}

export const STARTER_TRAITS = [
  'trait_trusting',
  'trait_suspicious',
  'trait_loyal',
  'trait_disloyal',
  'trait_devoted',
  'trait_wavering',
  'trait_fearful',
  'trait_intimidated',
  'trait_afraid_to_disappoint',
  'trait_likes',
  'trait_protective',
  'trait_attracted',
  'trait_dependent',
  'trait_resentful',
  'trait_angry',
  'trait_feels_used',
  'trait_feels_abandoned',
  'trait_grateful',
  'trait_indebted',
  'trait_owed_favor',
  'trait_ambitious',
  'trait_wants_approval',
  'trait_wants_power',
  'trait_guilty',
  'trait_ashamed',
  'trait_grieving',
  'trait_blames',
  'trait_watched_by_police',
  'trait_pressured_by_police',
  'trait_has_evidence_against',
  'trait_likely_to_flip',
  'trait_has_access',
  'trait_trusted_with_secrets',
  'trait_knows_head_location',
  'trait_injured',
  'trait_exhausted',
  'trait_panicked',
  'trait_laying_low',
  'trait_compromised',
  'trait_violent',
  'trait_short_tempered',
  'trait_calculating',
  'trait_inexperienced',
  'trait_respectful'
] as const;

export const TRAIT_DEFINITIONS: Record<TraitId, TraitDefinition> = {
  trait_trusting: { id: 'trait_trusting', category: 'relationship', promptHint: 'trusts others easily' },
  trait_suspicious: { id: 'trait_suspicious', category: 'relationship', conflictsWith: ['trait_trusting'], promptHint: 'is suspicious of others' },
  trait_loyal: { id: 'trait_loyal', category: 'loyalty', conflictsWith: ['trait_disloyal'], promptHint: 'remains loyal to the family' },
  trait_disloyal: { id: 'trait_disloyal', category: 'loyalty', conflictsWith: ['trait_loyal', 'trait_devoted'], promptHint: 'questions their allegiance' },
  trait_devoted: { id: 'trait_devoted', category: 'loyalty', conflictsWith: ['trait_disloyal', 'trait_wavering'], promptHint: 'is devoted to the Boss' },
  trait_wavering: { id: 'trait_wavering', category: 'loyalty', conflictsWith: ['trait_devoted', 'trait_loyal'], promptHint: 'is wavering in loyalty' },
  trait_fearful: { id: 'trait_fearful', category: 'emotion', promptHint: 'is often fearful' },
  trait_intimidated: { id: 'trait_intimidated', category: 'emotion', promptHint: 'is easily intimidated' },
  trait_afraid_to_disappoint: { id: 'trait_afraid_to_disappoint', category: 'emotion', promptHint: 'is afraid to disappoint the Boss' },
  trait_likes: { id: 'trait_likes', category: 'relationship', promptHint: 'has positive feelings toward' },
  trait_protective: { id: 'trait_protective', category: 'relationship', promptHint: 'feels protective of' },
  trait_attracted: { id: 'trait_attracted', category: 'relationship', promptHint: 'is attracted to' },
  trait_dependent: { id: 'trait_dependent', category: 'relationship', promptHint: 'depends on' },
  trait_resentful: { id: 'trait_resentful', category: 'emotion', promptHint: 'resents' },
  trait_angry: { id: 'trait_angry', category: 'emotion', promptHint: 'is angry' },
  trait_feels_used: { id: 'trait_feels_used', category: 'emotion', promptHint: 'feels used by' },
  trait_feels_abandoned: { id: 'trait_feels_abandoned', category: 'emotion', promptHint: 'feels abandoned by' },
  trait_grateful: { id: 'trait_grateful', category: 'emotion', promptHint: 'is grateful to' },
  trait_indebted: { id: 'trait_indebted', category: 'relationship', promptHint: 'owes a debt to' },
  trait_owed_favor: { id: 'trait_owed_favor', category: 'relationship', promptHint: 'is owed a favor by' },
  trait_ambitious: { id: 'trait_ambitious', category: 'skill', promptHint: 'is ambitious' },
  trait_wants_approval: { id: 'trait_wants_approval', category: 'emotion', promptHint: 'wants approval from' },
  trait_wants_power: { id: 'trait_wants_power', category: 'skill', promptHint: 'wants power' },
  trait_guilty: { id: 'trait_guilty', category: 'emotion', promptHint: 'feels guilty' },
  trait_ashamed: { id: 'trait_ashamed', category: 'emotion', promptHint: 'is ashamed' },
  trait_grieving: { id: 'trait_grieving', category: 'emotion', promptHint: 'is grieving' },
  trait_blames: { id: 'trait_blames', category: 'emotion', promptHint: 'blames' },
  trait_watched_by_police: { id: 'trait_watched_by_police', category: 'status', promptHint: 'is being watched by police' },
  trait_pressured_by_police: { id: 'trait_pressured_by_police', category: 'status', promptHint: 'is under police pressure' },
  trait_has_evidence_against: { id: 'trait_has_evidence_against', category: 'status', promptHint: 'has evidence against' },
  trait_likely_to_flip: { id: 'trait_likely_to_flip', category: 'status', conflictsWith: ['trait_loyal', 'trait_devoted'], promptHint: 'might cooperate with authorities' },
  trait_has_access: { id: 'trait_has_access', category: 'skill', promptHint: 'has access to' },
  trait_trusted_with_secrets: { id: 'trait_trusted_with_secrets', category: 'status', promptHint: 'is trusted with secrets' },
  trait_knows_head_location: { id: 'trait_knows_head_location', category: 'skill', promptHint: 'knows where the Boss is located' },
  trait_injured: { id: 'trait_injured', category: 'status', promptHint: 'is injured' },
  trait_exhausted: { id: 'trait_exhausted', category: 'status', promptHint: 'is exhausted' },
  trait_panicked: { id: 'trait_panicked', category: 'status', promptHint: 'is panicked' },
  trait_laying_low: { id: 'trait_laying_low', category: 'status', promptHint: 'is laying low' },
  trait_compromised: { id: 'trait_compromised', category: 'status', promptHint: 'is compromised' },
  trait_violent: { id: 'trait_violent', category: 'skill', promptHint: 'is violent and dangerous' },
  trait_short_tempered: { id: 'trait_short_tempered', category: 'emotion', promptHint: 'has a short temper' },
  trait_calculating: { id: 'trait_calculating', category: 'skill', promptHint: 'is calculating and strategic' },
  trait_inexperienced: { id: 'trait_inexperienced', category: 'skill', promptHint: 'is inexperienced' },
  trait_respectful: { id: 'trait_respectful', category: 'relationship', promptHint: 'respects' },
};

export function isValidTraitId(trait: string): trait is TraitId {
  return STARTER_TRAITS.includes(trait as TraitId);
}

export function isValidTargetType(type: string): type is TargetType {
  return ['player', 'npc', 'family', 'police', 'self', 'world'].includes(type);
}

export function isValidIntensity(intensity: string): intensity is Intensity {
  return ['minor', 'moderate', 'major', 'defining'].includes(intensity);
}