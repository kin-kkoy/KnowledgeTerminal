/**
 * Toggling a task checkbox in the source Markdown.
 *
 * The file is the single source of truth. There is no shadow database of tick
 * marks — flipping a box rewrites `- [ ]` to `- [x]` in place, so progress
 * lives with your notes, survives in git, and reads correctly in any other
 * Markdown app.
 *
 * The edit is surgical by construction: ONE character on ONE line, located by
 * counting task items rather than by line number, so it stays correct even if
 * the rendered tree and the source disagree about blank lines.
 */

const FENCE = /^\s{0,3}(```+|~~~+)/
const TASK = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\]\s?)/

/**
 * Flip the nth task item (0-indexed, in document order).
 *
 * Returns null when the index does not exist or the line is not what we
 * expected — the caller then leaves the file completely alone rather than
 * writing a guess.
 */
export function toggleTaskAt(source: string, index: number, done: boolean): string | null {
  const lines = source.split('\n')
  let seen = -1
  let fence: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    // A `- [ ]` inside a fenced block is sample text, not a task.
    const fenceMatch = FENCE.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]!
      if (fence === null) fence = marker[0]!
      else if (marker[0] === fence) fence = null
      continue
    }
    if (fence !== null) continue

    const task = TASK.exec(line)
    if (!task) continue

    seen++
    if (seen !== index) continue

    const [, open, , close] = task
    const rest = line.slice(task[0].length)
    lines[i] = `${open}${done ? 'x' : ' '}${close}${rest}`
    return lines.join('\n')
  }

  return null
}

/** Every task in a document, in the order the renderer will number them. */
export function readTasks(source: string): Array<{ text: string; done: boolean }> {
  const out: Array<{ text: string; done: boolean }> = []
  let fence: string | null = null

  for (const line of source.split('\n')) {
    const fenceMatch = FENCE.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]!
      if (fence === null) fence = marker[0]!
      else if (marker[0] === fence) fence = null
      continue
    }
    if (fence !== null) continue

    const task = TASK.exec(line)
    if (!task) continue
    out.push({
      done: task[2]!.toLowerCase() === 'x',
      text: line.slice(task[0].length).trim(),
    })
  }
  return out
}
