---
title: Game Design Document — Part III
document: "02"
kind: design
part: III
summary: >-
  Long-term structure, endgame and presentation layers.
tags: [gdd, design]
related:
  - "[[game-design-document-part-2]]"
  - "[[implementation-roadmap]]"
source: "documents/Game Design Document (GDD) [PART III].pdf"
---

# Game Design Document — Part III

### Part III — Economy, Reputation & Progression

## The Merchant Council

### Purpose

The Merchant Council is the governing body responsible for recognizing, regulating, and evaluating merchant guilds throughout the kingdom.

It establishes standards, issues guild licenses, promotes guilds through official ranks, assigns inspectors, and approves prestigious contracts.

The Council does not interfere with the guild's daily operations unless standards are violated.

### Responsibilities

The Council oversees:

- Guild registration
- Guild promotions
- Inspector assignments
- Reputation records
- High-value contracts
- Merchant regulations

### Design Rationale

The Merchant Council provides an in-world explanation for progression systems that would otherwise feel artificial.

Instead of "the game unlocks something," the world acknowledges the player's achievements.

## Economy

The economy is the foundation of the guild.

Everything ultimately produces value through trade.

Gold is important, but it is not the only measure of success.

### Sources of Income

Primary income comes from:

- Completed contracts
- Selling surplus resources
- Selling crafted goods
- Special merchant requests
- Rare discoveries

### Expenses

The guild must regularly pay for:

- Worker wages
- Food supplies
- Building construction
- Dragon adoption
- Equipment
- Facility maintenance

### Economic Philosophy

Resources should generally follow one question:

> "Should I use this, or should I sell it?"

Both choices should be reasonable.

There should rarely be one obvious correct answer.

### Design Rationale

Interesting economies emerge from opportunity cost.

Every resource spent on one purpose cannot immediately serve another.

## Contracts

Contracts are the guild's primary objective.

They represent agreements between the guild and clients.

Completing contracts increases both wealth and reputation.

**Contract Categories** — Supply Contracts

Deliver requested goods.

Examples:

- Timber
- Stone
- Food
- Iron

### Construction Contracts

Provide materials for large projects.

Examples:

- Bridges
- Towers
- Roads
- Harbors

### Agricultural Contracts

Support farms and villages.

Examples:

- Irrigation
- Fertilizer
- Livestock Feed

### Emergency Contracts

Urgent requests requiring quick response.

Examples:

- Storm recovery
- Fire rebuilding
- Winter supplies

Emergency contracts generally provide larger rewards.

### Royal Contracts

Rare, prestigious assignments issued through the Merchant Council.

Reserved for highly respected guilds.

### Design Rationale

Contract variety prevents the game from becoming "collect X resources forever."

Different contracts encourage different strategies.

## Reputation

Reputation measures trust.

Unlike gold, it cannot simply be purchased.

### Reputation Increases Through

- Successful contracts
- Honest trade
- Healthy dragons
- Happy workers
- Positive inspections
- Community assistance

### Reputation Decreases Through

- Failed contracts
- Neglected dragons
- Worker mistreatment
- Missed deadlines
- Poor inspections

### Effects of Reputation

Higher reputation unlocks:

- Better contracts
- Larger clients
- Guild promotions
- Rare dragons
- Merchant discounts

### Design Rationale

Separating reputation from wealth encourages ethical management.

A rich guild should not automatically become respected.

## Guild Rank

Guild Rank represents official recognition by the Merchant Council.

Promotions are intentionally difficult.

Ranks should feel earned.

**Rank Structure** — Independent Workshop

The starting organization.

A newly registered operation with little influence.

Can only accept basic contracts.

### Novice Guild

A recognized local guild.

Trusted within nearby settlements.

### Journeyman Guild

A proven regional merchant organization.

Begins attracting specialized contracts.

### Established Guild

A respected commercial organization.

Trusted with valuable trade.

### Grand Guild

One of the kingdom's leading merchant guilds.

Frequently consulted by the Merchant Council.

### Royal Guild

A legendary guild whose reputation extends across the kingdom.

Reserved for only the greatest organizations.

### Promotion Requirements

Promotions are never based on one statistic.

Instead they evaluate a combination of:

- Reputation
- Wealth
- Contract completion
- Dragon welfare
- Worker welfare
- Facility development
- Inspection history

The Merchant Council evaluates the guild as a whole.

### Design Rationale

Multiple requirements prevent players from maximizing only one system.

Balanced development is rewarded.

## Inspectors

Inspectors represent the Merchant Council.

Their role is to verify that guilds maintain acceptable standards.

### Inspector Visits

Inspections occur randomly.

However, they follow one important rule:

An inspector may not visit again until at least four in-game days have passed since the previous inspection.

This prevents inspections from becoming frustrating while preserving unpredictability.

### What Inspectors Evaluate

- Dragon welfare
- Worker welfare
- Facility conditions
- Storage organization
- Contract reliability
- Guild cleanliness
- General professionalism

### Outcomes

Excellent inspections:

- Increase reputation
- Improve Council trust
- Unlock prestigious opportunities

Poor inspections:

- Reduce reputation
- Delay promotions
- Trigger follow-up inspections

Inspectors never destroy the guild.

They create pressure rather than punishment.

### Design Rationale

Randomness creates uncertainty.

The minimum cooldown preserves fairness.

## Daily Progression

Time advances in days.

Each day consists of several phases.

### Morning

- Review reports
- Accept contracts
- Feed dragons
- Assign workers

### Daytime

- Resource gathering
- Crafting
- Construction
- Transportation

### Evening

- Deliver contracts
- Prepare meals
- Update storage
- Review finances

### Night

- Dragons rest
- Workers sleep
- Daily summaries appear
- Random events may occur

### Design Rationale

Structured days naturally organize gameplay while remaining easy to expand later.

## Random Events

Occasionally, unexpected situations occur.

Examples include:

- Traveling merchant arrives
- Wandering dragon appears
- Festival increases demand
- Heavy rain slows work
- Harvest season
- Mine collapse
- Merchant caravan requests aid

Random events should encourage adaptation rather than punishment.

### Design Rationale

Random events make the world feel alive without overwhelming the player.

## Winning

The game intentionally has no traditional ending.

Instead, players pursue increasingly ambitious goals.

Possible long-term milestones include:

- Reach Royal Guild rank.
- Complete every major contract category.
- Discover every dragon species.
- Build every facility.
- Become the kingdom's most trusted merchant guild.

The journey is the focus.

## Future Expansion

Possible future additions include:

- Trade routes
- Neighboring kingdoms
- Dragon breeding
- Seasonal weather
- Festivals
- Research trees
- Multiple guild branches
- Cooperative multiplayer
- Procedural world generation

These ideas remain intentionally outside the current project scope.

### End of Part III

The remaining sections focus on implementation-facing systems rather than world-building.

Upcoming topics include:

- Saving & Loading Philosophy
- Difficulty Philosophy
- Curriculum Integration
- Developer Rules
- Glossary
- Future Refactoring Opportunities
