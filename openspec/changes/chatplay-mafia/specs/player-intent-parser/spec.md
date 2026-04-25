## ADDED Requirements

### Requirement: Intent Parsing
The system SHALL parse player messages to identify game actions, distinguishing between narrative chat and actionable commands.

#### Scenario: Explicit command
- **WHEN** the player sends a message starting with "/" (e.g., "/mission steal the shipment")
- **THEN** the system SHALL parse the command type and arguments
- **AND** execute the corresponding game action

#### Scenario: Implicit intent detection
- **WHEN** the player sends natural language without "/" prefix
- **THEN** the system SHALL attempt to classify the intent (advice request, mission delegation, general chat)
- **AND** route to appropriate handler

#### Scenario: Ambiguous intent
- **WHEN** the player message cannot be confidently classified
- **THEN** the system SHALL route to Consiglieri for clarification response
- **AND** not execute any game action

### Requirement: Command Recognition
The system SHALL recognize and execute player commands for common game actions.

#### Scenario: Mission delegation
- **WHEN** player uses /mission command with target and objective
- **THEN** the system SHALL create a pending mission assigned to the specified NPC

#### Scenario: NPC management
- **WHEN** player uses /promote, /demote, or /remove commands
- **THEN** the system SHALL modify the NPC's role in the family

#### Scenario: Information request
- **WHEN** player asks about family state, territory, or NPCs
- **AND** uses appropriate command or question format
- **THEN** the system SHALL provide diegetic response through Consiglieri

### Requirement: Validation
The system SHALL validate player intents before execution.

#### Scenario: Invalid target
- **WHEN** player targets an NPC that doesn't exist
- **THEN** the system SHALL return an error message through game dialogue

#### Scenario: Insufficient resources
- **WHEN** player attempts an action requiring resources they don't have
- **THEN** the system SHALL explain the constraint diegetically