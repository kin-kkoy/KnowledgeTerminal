---
title: Project Journal
document: "09"
kind: journal
status: Living Development Journal
version: "1.0"
summary: >-
  The running development log — what was built, what broke, what was learned.
tags: [journal]
related:
  - "[[development-workflow]]"
  - "[[meeting-minutes]]"
source: "documents/Project Journal.pdf"
---

# Project Journal

## Purpose

The Project Journal records the evolution of both the game and its developer.

Unlike Meeting Minutes, which document individual discussions and decisions, the Project Journal captures personal progress throughout development.

It answers questions such as:

- What did I build today?
- What did I learn?
- What problems did I encounter?
- What ideas should Future Me revisit?
- How has my understanding improved?

This journal is not intended to be a diary.

Instead, it serves as a technical record of growth.

## Guiding Principle

Code changes the project. Reflection changes the developer.

## When to Create an Entry

Create a journal entry whenever you:

- Finish a curriculum chapter.
- Complete a milestone.
- Finish a significant feature.
- Solve a difficult bug.
- Discover a better design.
- Learn an important programming concept.
- Decide against implementing an idea.

Small daily commits do not always require journal entries.

Focus on meaningful progress rather than frequency.

**Journal Entry Template** — Entry Number

Example:

**Entry #014** — Date

**YYYY-MM-DD** — Curriculum Topic

Example:

**Methods & the C-corner** — Feature(s) Built

Briefly describe what was implemented.

Example:

- Implemented dragon assignment.
- Added contract acceptance.
- Added hunger system.

## What I Learned

Summarize the most important lesson.

Focus on understanding rather than syntax.

Example:

"I finally understand why ref modifies the caller's variable while ordinary parameters don't."

## Challenges

Describe what caused difficulty.

Examples:

- Confusing compiler error.
- Poor class design.
- Unexpected bug.
- Difficult algorithm.

## How I Solved It

Record the reasoning.

Future You may encounter similar problems again.

## Refactoring Ideas

Ideas worth revisiting later.

Example:

"The Dragon class currently stores hunger directly. This may eventually become a Need system."

Do not immediately implement these ideas.

Simply record them.

## Future Ideas

Interesting thoughts that are outside the current project scope.

Examples:

- Seasonal migration.
- Dragon festivals.
- Guild politics.

Avoid implementing them immediately.

## Personal Reflection

Finish every entry by answering:

"What do I understand today that I didn't understand yesterday?"

This is the most important section of the journal.

**Example Entry** — Entry #006

## Date

2026-08-12

**Curriculum** — Collections & Generics

## Features

- Dragon roster
- Worker roster
- Contract board

## Lesson

Collections make the game feel alive because the guild is no longer limited to fixed numbers of dragons or workers.

## Challenge

I initially tried storing everything in separate variables instead of lists.

## Solution

After replacing those variables with collections, the code became much simpler.

Future Refactor

Buildings should probably become their own hierarchy once inheritance is introduced.

Future Idea

Some dragons may eventually refuse certain contracts if they dislike the environment.

## Reflection

Today I stopped thinking about individual objects and started thinking about systems.

## Things Worth Recording

Not every important lesson comes from success.

Also record:

- Bugs that taught something.
- Failed experiments.
- Bad ideas.
- Assumptions that proved wrong.
- Surprising discoveries.

Mistakes often become the most valuable entries.

## Looking Back

At the end of every completed curriculum module, reread previous journal entries.

Ask yourself:

- What assumptions changed?
- Which problems seem easy now?
- Which ideas still excite me?
- How much has my coding improved?

Growth is easiest to appreciate in hindsight.

## Closing Thought

A finished game tells the story of the world.

> A project journal tells the story of the developer who built it.

Both stories are worth preserving.
