---
title: Game Design Document — Part II
document: "02"
kind: design
part: II
summary: >-
  Systems, economy and progression.
tags: [gdd, design]
related:
  - "[[game-design-document-part-1]]"
  - "[[game-design-document-part-3]]"
source: "documents/Game Design Document (GDD) [Part II].pdf"
---

# Game Design Document — Part II

### Part II — The Guild

## The Guild

### Purpose

The guild is the player's organization.

Everything the player owns belongs to the guild rather than to the player personally.

The guild serves as the central hub from which all gameplay systems connect.

Every dragon, worker, building, resource, contract, and reputation change ultimately belongs to the guild.

### Design Rationale

Keeping everything centered around the guild makes future expansion easier.

Instead of adding unrelated systems, new mechanics naturally plug into the guild.

## Guild Identity

Every guild possesses several defining attributes.

These attributes grow throughout the game.

### Official Name

Chosen by the player.

Represents the guild's public identity.

### Guild Rank

Represents official recognition by the Merchant Council.

Higher ranks unlock larger opportunities.

### Reputation

Represents trust.

Unlike wealth, reputation cannot simply be purchased.

### Wealth

Represents available capital.

Used to expand operations.

### Workforce

The collection of all employed humans.

### Dragon Roster

The collection of dragons currently under the guild's care.

### Facilities

Every constructed building owned by the guild.

### Design Rationale

These seven attributes become the "identity card" of every save file.

Nearly every gameplay system either modifies or depends upon one or more of them.

## Guild Philosophy

The guild is built upon cooperation.

Humans and dragons are partners.

Neither exists merely to serve the other.

Healthy dragons produce better work.

Happy workers make fewer mistakes.

Ethical decisions should generally produce better long-term outcomes.

### Design Rationale

This distinguishes the guild from a factory simulator.

Efficiency still matters, but it is achieved through proper management rather than exploitation.

## Core Resources

Resources are divided into categories.

A resource should ideally have multiple purposes.

Selling should rarely be its only use.

### Raw Materials

Obtained directly from nature.

Examples:

- Stone
- Clay
- Iron Ore
- Copper Ore
- Coal
- Timber
- Herbs
- Water

### Processed Materials

Created by refining raw materials.

Examples:

- Iron Ingots
- Steel
- Lumber
- Flour
- Glass
- Fabric
- Leather

### Food

Consumed by humans and dragons.

Examples:

- Bread
- Fish
- Vegetables
- Fruit
- Meat
- Dragon Feed

Food quality influences morale.

### Luxury Goods

High-value products.

Often used for prestigious contracts.

Examples:

- Fine Furniture
- Jewelry
- Spices
- Silk
- Decorative Stonework

### Special Materials

Rare materials primarily associated with dragons.

Examples:

- Molted Dragon Scales
- Shed Horn Fragments
- Ember Crystals
- Frost Sap
- Echo Stones

These should be uncommon and usually originate from specific dragon species.

### Design Rationale

Resource categories reduce complexity while still allowing hundreds of individual resources later.

## Storage

Every resource occupies storage.

Storage is finite.

Expanding storage is an important investment.

When storage becomes full, production slows or eventually stops.

### Design Rationale

Finite storage creates meaningful logistical decisions without introducing unnecessary complexity.

## Dragons

### Philosophy

Dragons are living creatures with instincts.

They are not interchangeable machines.

Each dragon species naturally excels at certain work.

The player succeeds by assigning dragons to work they enjoy.

### Dragon Categories

The categories describe natural roles, not strict classes.

Future dragons may belong to multiple categories.

### Mining Dragons

Experts at excavation.

Examples:

- Burrow Drake
- Ironjaw Dragon

Possible future examples:

- Crystal Mole Dragon
- Obsidian Maw

### Forest Dragons

Excel at gathering wood and plant materials.

Examples:

- Mossback Dragon
- Barkwing Dragon

Possible future examples:

- Vine Serpent
- Canopy Drake

### Transport Dragons

Move goods efficiently.

Examples:

- Packscale Dragon
- Longtail Courier

Possible future examples:

- Sky Caravan Drake
- Iron Harness Dragon

### Fire Dragons

Produce controlled heat.

Examples:

- Ember Drake
- Furnace Dragon

Possible future examples:

- Forge Serpent
- Ashscale Dragon

### Water Dragons

Support agriculture and industry.

Examples:

- River Dragon
- Mistwing Dragon

Possible future examples:

- Tide Drake
- Spring Guardian

### Wind Dragons

Control airflow.

Examples:

- Gale Dragon
- Cloudrunner

Possible future examples:

- Storm Glider
- Whisperwing

### Earth Dragons

Heavy labor specialists.

Examples:

- Stoneback Dragon
- Granite Horn

Possible future examples:

- Mountain Drake
- Quarry Titan

### Specialty Dragons

Rare dragons with unusual abilities.

Examples:

- Filter Dragon
- Archive Dragon

Future dragons may possess abilities that don't fit traditional industries.

### Design Rationale

Categories exist to inspire new dragons rather than restrict imagination.

The player's own original dragon concepts should naturally fit somewhere within these broad archetypes.

## Dragon Needs

Every dragon possesses several needs.

Ignoring these reduces productivity.

### Hunger

Fed daily.

Different dragons prefer different food.

### Rest

Tired dragons perform poorly.

### Comfort

Proper habitats improve morale.

### Trust

Trust grows through consistent care.

Higher trust improves reliability.

### Health

Injuries and illness reduce effectiveness.

### Design Rationale

Needs encourage long-term care instead of treating dragons as disposable production units.

## Human Workers

Humans complement dragons.

They perform planning, maintenance, and specialized tasks.

**Worker Roles** — Gatherers

Collect resources unsuitable for dragons.

### Craftsmen

Transform raw materials into useful products.

### Builders

Construct new facilities.

### Caretakers

Maintain dragon welfare.

### Cooks

Prepare meals.

Higher-quality meals improve morale for both workers and dragons.

### Quartermasters

Manage inventory and storage.

Future versions may improve logistical efficiency.

### Researchers (Future)

Study dragons and improve guild knowledge.

### Design Rationale

Every profession should solve a genuine gameplay problem.

New worker roles should only be introduced when they meaningfully change decision-making.

## Morale

Both humans and dragons possess morale.

Morale affects:

- work quality
- productivity
- reliability

Good morale results from:

- sufficient food
- proper rest
- comfortable living conditions
- reasonable workloads

Poor morale should reduce efficiency before causing severe penalties.

### Design Rationale

Morale introduces soft management challenges rather than harsh punishments.

Players should notice declining efficiency before facing major consequences.

## Facilities

Facilities enable guild growth.

Every facility serves a specific purpose.

### Guild Hall

The center of operations.

### Warehouse

Stores resources.

### Workshop

Processes materials.

### Dragon Stable

Houses dragons.

### Kitchen

Produces meals.

### Marketplace

Sells excess goods.

Purchases selected supplies.

### Contract Board

Displays available work.

### Dormitory

Houses workers.

### Future Facilities

Examples include:

- Forge
- Library
- Observatory
- Greenhouse
- Hatchery
- Harbor
- Trade Office

### Design Rationale

Facilities create visible progression.

The guild should physically feel larger as new buildings become available.

### End of Part II

The next part introduces the systems that tie everything together:

- Contracts
- Economy
- Reputation
- Guild Ranks
- Merchant Council
- Inspectors
- Daily Progression
- Time System
