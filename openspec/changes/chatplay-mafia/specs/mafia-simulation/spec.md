## ADDED Requirements

### Requirement: Family Management
The simulation SHALL manage the player's mafia family including money, territory control, NPC members, and organizational hierarchy.

#### Scenario: Initial family state
- **WHEN** a new game starts
- **THEN** the family starts with a defined amount of money, one controlled territory, and a set of initial NPCs (Consiglieri, soldiers, associates)

#### Scenario: Money changes from mission
- **WHEN** a mission completes with monetary result
- **THEN** the family money balance SHALL be updated accordingly
- **AND** all NPCs with relationship to the mission SHALL have their relationship values adjusted

#### Scenario: Territory acquisition
- **WHEN** a mission to take territory succeeds
- **THEN** the territory SHALL be added to the family's controlled list
- **AND** the family income rate SHALL increase

### Requirement: NPC State Management
The simulation SHALL track each NPC's state including role, health (alive/wounded/dead), relationship to player, loyalty, and current assignments.

#### Scenario: NPC death
- **WHEN** an NPC is killed (mission failure, rival action, betrayal)
- **THEN** the NPC state SHALL be set to dead
- **AND** the NPC SHALL be moved to the archive
- **AND** NPCs with relationship to the dead NPC SHALL have their state adjusted

#### Scenario: NPC promotion
- **WHEN** the player promotes an NPC to a higher role
- **THEN** the NPC's role SHALL be updated
- **AND** the NPC's capabilities in missions SHALL reflect the new role

### Requirement: Mission Execution
The simulation SHALL process mission delegation, determine outcomes based on NPC abilities and random factors, and report results.

#### Scenario: Mission delegation
- **WHEN** the player delegates a mission to an NPC with appropriate instructions
- **THEN** the mission SHALL be created with assigned NPC, objectives, and success thresholds

#### Scenario: Mission outcome determination
- **WHEN** a mission reaches its resolution point
- **THEN** the simulation SHALL calculate success/failure based on NPC skill + random factor vs difficulty
- **AND** the appropriate outcome SHALL be recorded (success, partial success, failure, catastrophic failure)

### Requirement: Relationship System
The simulation SHALL track and update relationships between NPCs and between NPCs and the player.

#### Scenario: Relationship damage from failure
- **WHEN** a mission fails
- **THEN** NPCs assigned to that mission SHALL have their relationship with the player decrease
- **AND** NPCs not assigned SHALL have their relationship slightly affected based on news

#### Scenario: Relationship improvement from success
- **WHEN** a mission succeeds
- **THEN** NPCs assigned SHALL have their relationship with the player increase