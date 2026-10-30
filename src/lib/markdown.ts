function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeUrl(raw: string): string | null {
  const url = raw.trim()
  if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) return url
  return null
}

function inlineMarkdown(text: string): string {
  let value = escapeHtml(text)
  const codes: string[] = []
  value = value.replace(/`([^`]+)`/g, (_, code: string) => {
    const token = `\u0000${codes.length}\u0000`
    codes.push(`<code>${code}</code>`)
    return token
  })
  value = value.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, href: string) => {
    const url = safeUrl(href.replace(/&amp;/g, '&'))
    if (!url) return match
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${label}</a>`
  })
  value = value.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  value = value.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  value = value.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  value = value.replace(/\u0000(\d+)\u0000/g, (_, index: string) => codes[Number(index)] ?? '')
  return value
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const output: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let inCode = false
  let codeLines: string[] = []

  const closeList = () => {
    if (listType) {
      output.push(`</${listType}>`)
      listType = null
    }
  }

  const openList = (type: 'ul' | 'ol') => {
    if (listType === type) return
    closeList()
    output.push(`<${type}>`)
    listType = type
  }

  const isBlockStart = (line: string) =>
    /^(#{1,6})\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^([-*])\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    /^```/.test(line) ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(line)

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]

    if (/^```/.test(line)) {
      if (inCode) {
        output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
        codeLines = []
        inCode = false
      } else {
        closeList()
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeLines.push(line)
      continue
    }

    if (!line.trim()) {
      closeList()
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      closeList()
      const level = heading[1].length
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`)
      continue
    }

    if (/^>\s?/.test(line)) {
      closeList()
      const quote: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ''))
        i += 1
      }
      i -= 1
      output.push(`<blockquote>${quote.map((item) => inlineMarkdown(item)).join('<br>')}</blockquote>`)
      continue
    }

    if (/^([-*])\s+/.test(line)) {
      const task = /^([-*])\s+\[([ xX])\]\s+(.*)$/.exec(line)
      openList('ul')
      if (task) {
        const checked = task[2].toLowerCase() === 'x'
        output.push(
          `<li class="md-task"><input type="checkbox" disabled${checked ? ' checked' : ''}>${inlineMarkdown(task[3])}</li>`,
        )
      } else {
        output.push(`<li>${inlineMarkdown(line.replace(/^([-*])\s+/, ''))}</li>`)
      }
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      openList('ol')
      output.push(`<li>${inlineMarkdown(line.replace(/^\d+\.\s+/, ''))}</li>`)
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      closeList()
      output.push('<hr>')
      continue
    }

    closeList()
    const paragraph: string[] = [line]
    while (
      i + 1 < lines.length &&
      lines[i + 1].trim() &&
      !isBlockStart(lines[i + 1]) &&
      !/^\d+\.\s+/.test(lines[i + 1])
    ) {
      i += 1
      paragraph.push(lines[i])
    }
    output.push(`<p>${paragraph.map((item) => inlineMarkdown(item)).join('<br>')}</p>`)
  }

  if (inCode) output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
  closeList()
  return output.join('\n')
}

export function stripMarkdown(markdown: string, length = 90): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~\-]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, length)
}
