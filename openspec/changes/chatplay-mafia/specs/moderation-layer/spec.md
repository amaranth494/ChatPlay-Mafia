## ADDED Requirements

### Requirement: Player Input Moderation
The system SHALL filter player messages through OpenAI's moderation endpoint before processing.

#### Scenario: Safe content
- **WHEN** the player sends a message
- **AND** the moderation endpoint returns no flags
- **THEN** the message SHALL be processed normally

#### Scenario: Harmful content detected
- **WHEN** the player sends a message
- **AND** the moderation endpoint returns flagged categories
- **THEN** the message SHALL be blocked
- **AND** the player SHALL receive a diegetic warning through Consiglieri

### Requirement: NPC Output Moderation
The system SHALL filter AI-generated NPC messages before delivering to the player.

#### Scenario: AI generates inappropriate content
- **WHEN** the AI generates a response
- **AND** the moderation endpoint flags the content
- **THEN** the response SHALL be regenerated with safety instructions
- **AND** if regeneration fails after N attempts, a fallback generic response SHALL be used

### Requirement: Moderation Logging
The system SHALL log moderation events for review.

#### Scenario: Flagged content
- **WHEN** content is flagged by moderation
- **AND** the event SHALL be logged with timestamp, player ID, content preview, and flag categories
- **AND** accessible to admin tools for review

### Requirement: Escalation Path
The system SHALL provide a path for manual review of borderline content.

#### Scenario: Borderline detection
- **WHEN** content scores near but below threshold
- **AND** the event SHALL be flagged for manual review
- **AND** an admin SHALL be able to approve or reject the content