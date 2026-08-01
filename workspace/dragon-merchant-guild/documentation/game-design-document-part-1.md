---
title: Game Design Document — Part I
document: "02"
kind: design
part: I
status: Active
version: "0.1 (Living Draft)"
summary: >-
  The game's premise, core loop and player fantasy.
tags: [gdd, design]
related:
  - "[[game-design-document-part-2]]"
  - "[[dragon-codex]]"
source: "documents/Game Design Document (GDD) [Part I].pdf"
---

# Game Design Document — Part I

## Purpose

This document describes how the game works.

Unlike the Project Charter, which explains why the project exists, this document defines the game's systems, mechanics, progression, and rules.

It serves as the canonical reference when implementing features.

If implementation and this document disagree, either:

- the implementation should be updated, or
- this document should be revised if the design intentionally changed.

## Design Goals

The game should achieve five goals simultaneously.

### Goal 1 — Teach C

Every major gameplay mechanic should reinforce a programming concept.

The player should feel that every chapter studied makes the guild more capable.

### Goal 2 — Reward Curiosity

The player should frequently think:

> "I wonder if I can improve this."

Later curriculum chapters should naturally provide better solutions to earlier implementations.

### Goal 3 — Encourage Good Software Design

The project should naturally grow from small systems into larger interconnected systems.

New systems should emerge because they solve existing problems, not because they were planned from the beginning.

### Goal 4 — Be Relaxing

This is not intended to be a stressful survival game.

It should feel closer to managing a peaceful workshop than surviving a disaster.

Challenges come from logistics, planning, reputation, and efficiency rather than constant danger.

### Goal 5 — Feel Like A Real Guild

The world should continue to make sense even if the programming aspect disappeared.

Contracts should exist because merchants need goods.

Dragons should have instincts instead of acting like robots.

Workers should have meaningful professions.

Resources should have believable uses.

## Game Overview

The player becomes the founder of a newly established merchant guild.

Rather than relying on conventional machinery, the guild partners with dragons whose natural abilities perform specialized work.

As the guild grows, it gains:

- new dragons
- new workers
- new buildings
- new contracts
- greater reputation
- higher guild ranks
- access to larger regions

Progress comes from learning, experimentation, and careful expansion rather than grinding levels.

## Core Fantasy

The central fantasy is:

> "Build the most respected dragon-powered merchant guild in the kingdom."

The emphasis is merchant first.

The dragons are partners.

The guild exists to fulfill contracts, produce goods, trade fairly, and earn trust.

Combat, if it ever exists, is secondary.

## Design Pillars

Every future feature should support at least one of these pillars.

### Pillar 1 — Dragons Are Living Partners

Dragons are not machines.

Each species has:

- instincts
- preferences
- strengths
- weaknesses
- favorite environments

The player succeeds by understanding dragons rather than merely assigning work.

### Pillar 2 — Reputation Is More Valuable Than Wealth

Gold opens opportunities.

Reputation unlocks trust.

A rich guild with poor ethics should struggle to receive prestigious contracts.

### Pillar 3 — Expansion Requires Responsibility

Growth increases opportunity.

Growth also increases complexity.

More dragons require more care.

More workers require better organization.

More contracts require better logistics.

Scaling the guild should introduce meaningful decisions instead of simply increasing numbers.

### Pillar 4 — Every Resource Has Purpose

Resources should rarely exist solely for selling.

Most resources should have multiple uses.

Examples:

- construction
- food
- dragon care
- contracts
- crafting
- trading

This encourages meaningful economic choices.

### Pillar 5 — Learning Changes The World

Whenever the developer learns a new programming concept, the game should visibly improve.

The world grows alongside the developer.

## Core Gameplay Loop

The entire game revolves around a repeating management loop.

Accept Contracts │ ▼ Plan Production │ ▼ Assign Dragons & Workers │ ▼ Gather Resources │ ▼ Process Goods │ ▼ Complete Contracts │ ▼ Earn Gold & Reputation │ ▼ Expand Guild │ ▼ Unlock New Opportunities │ └───────────────┐ ▼ Accept Better Contracts

Every major feature eventually supports this loop.

## Primary Progression

The player grows through five parallel progression systems.

### Guild Rank

Represents official recognition.

Unlocks:

- larger contracts
- additional buildings
- advanced dragons
- greater responsibilities

### Reputation

Represents trust.

Earned through:

- successful contracts
- ethical behavior
- dragon welfare
- inspector evaluations

Lost through:

- failed contracts
- poor living conditions
- neglect
- dishonesty

### Wealth

Represents available capital.

Used for:

- expansion
- wages
- construction
- dragon adoption
- supplies

Gold alone cannot replace reputation.

### Knowledge

Unlike most games, the player's real-world understanding is also considered progression.

Better C# knowledge leads to:

- cleaner code
- better architecture
- easier feature development

This progression exists outside the game but is intentionally acknowledged by the project.

### Infrastructure

Buildings, facilities, storage, and logistics determine how efficiently the guild operates.

Expanding too quickly without infrastructure should create natural bottlenecks.

## Failure Philosophy

Failure should teach rather than punish.

Examples:

An unsuccessful contract should reduce reputation.

It should not erase hours of progress.

Likewise,

a poor dragon assignment should waste time or resources,

not permanently destroy the guild.

The game should encourage experimentation.

## The Player's Responsibilities

The player is responsible for managing the guild rather than directly performing labor.

Responsibilities include:

- choosing contracts
- assigning dragons
- hiring workers
- expanding facilities
- balancing finances
- maintaining reputation
- planning future growth

The player is an organizer rather than a laborer.

## Scope

### Included

- **Merchant simulation**
- **Dragon management**
- **Resource economy**
- **Worker management**
- **Guild progression**
- **Reputation system**
- **Contracts**
- **Inspections**
- **Learning integration**

### Explicitly Excluded (Initial Versions)

✗ Large-scale combat

✗ Multiplayer

✗ Romance systems

✗ Open-world exploration

✗ Skill trees

✗ Hundreds of statistics

✗ Real-time action gameplay

These may be explored much later, but they are outside the current scope.

## Long-Term Vision

The project should feel like a real software project growing alongside the developer.

Early versions will be simple.

Later curriculum chapters will naturally improve:

- architecture
- maintainability
- readability
- scalability

The game itself becomes a visible timeline of the developer's growth as a programmer.

### End of Part I

The following sections are intentionally deferred to later parts of this document:

- Dragon Species
- Worker Professions
- Buildings
- Economy
- Contracts
- Inspectors
- Guild Ranks
- Saving & Loading
- Future Expansion
- Glossary

These systems deserve dedicated sections rather than brief summaries, as they define most of the gameplay.
