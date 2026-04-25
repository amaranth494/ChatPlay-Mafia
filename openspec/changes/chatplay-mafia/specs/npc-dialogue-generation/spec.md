## ADDED Requirements

### Requirement: NPC Dialogue Generation
The AI layer SHALL generate NPC dialogue that expresses simulation results in character-appropriate ways, using the OpenAI Responses API.

#### Scenario: Mission result narration
- **WHEN** a mission completes and the simulation provides the outcome (success/failure, money change, injuries)
- **THEN** the AI SHALL generate dialogue from the assigned NPC expressing that outcome in their voice
- **AND** the dialogue SHALL NOT reference game mechanics directly (no "mission failed", no stat numbers)

#### Scenario: Consiglieri advice
- **WHEN** the player asks for advice or a significant game event occurs
- **THEN** the Consiglieri NPC SHALL generate contextually appropriate advice
- **AND** the Consiglieri SHALL have knowledge of the overall game state

#### Scenario: NPC reaction to death
- **WHEN** an NPC dies (any NPC in the family)
- **THEN** other NPCs SHALL generate dialogue reacting to the death
- **AND** the tone SHALL match their relationship to the deceased

### Requirement: Character Voice Consistency
The AI SHALL maintain consistent personality and speech patterns for each NPC across sessions.

#### Scenario: Return player session
- **WHEN** a player returns after time away
- **THEN** NPCs SHALL reference past events appropriately
- **AND** dialogue SHALL maintain the same personality traits

#### Scenario: NPC personality variation
- **WHEN** generating dialogue for different NPCs
- **THEN** each NPC SHALL have distinct vocabulary, speech patterns, and emotional responses
- **AND** these traits SHALL be consistent with their role (enforcer speaks differently than accountant)

### Requirement: Context Injection
The AI SHALL receive appropriate context including NPC personality, recent events, and relationship states for each response.

#### Scenario: Context for dialogue generation
- **WHEN** generating NPC dialogue
- **THEN** the prompt SHALL include NPC name, role, personality traits, current relationship to player, and relevant recent events
- **AND** the prompt SHALL NOT include information the NPC would not know

### Requirement: Response Rate Limiting
The system SHALL limit NPC response frequency to maintain realism.

#### Scenario: NPC message cooldown
- **WHEN** an NPC has recently sent a message
- **THEN** the system SHALL wait a defined cooldown period before that NPC can respond again