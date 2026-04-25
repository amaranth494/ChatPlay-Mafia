## ADDED Requirements

### Requirement: Thread-Based Messaging
The client SHALL display the game as a set of message threads, each representing a conversation with an NPC.

#### Scenario: Thread list display
- **WHEN** the player opens the client
- **THEN** they SHALL see a list of active NPC threads sorted by recent activity
- **AND** each thread SHALL show the NPC name and last message preview
- **AND** unread indicators SHALL appear for threads with new messages

#### Scenario: Message display
- **WHEN** the player opens a thread
- **THEN** they SHALL see a scrollable list of messages
- **AND** messages from NPCs SHALL be visually distinct from player messages
- **AND** timestamps SHALL be displayed diegetically (e.g., "Tuesday, 11:42 PM")

### Requirement: Diegetic Interface
The client SHALL present all information through in-world elements without breaking immersion.

#### Scenario: No HUD elements
- **WHEN** displaying the game
- **AND** the client SHALL NOT show health bars, stat panels, or game menus
- **AND** all game information SHALL be conveyed through NPC messages

#### Scenario: Consiglieri thread
- **WHEN** the player has a question or needs guidance
- **THEN** the Consiglieri thread SHALL always be accessible
- **AND** the Consiglieri SHALL provide diegetic answers to direct questions

#### Scenario: Archive access
- **WHEN** an NPC dies
- **THEN** the NPC thread SHALL be moved to an archive section
- **AND** the player SHALL be able to review past conversations
- **AND** the archive SHALL be labeled diegetically (e.g., "Rest in Peace")

### Requirement: Real-Time Updates
The client SHALL receive and display new messages via WebSocket without page refresh.

#### Scenario: New NPC message
- **WHEN** the server pushes a new NPC message
- **THEN** the message SHALL appear in the thread immediately
- **AND** the thread SHALL move to top of list if not currently viewed

### Requirement: Message Composition
The client SHALL provide a simple interface for composing and sending messages.

#### Scenario: Send message
- **WHEN** the player types a message and sends
- **THEN** the message SHALL be transmitted to the server
- **AND** appear immediately in the thread as "sending"
- **AND** update to "sent" on server confirmation

#### Scenario: Command assistance
- **WHEN** the player types "/" to start a command
- **THEN** the client SHALL show available commands
- **AND** provide hints for command syntax